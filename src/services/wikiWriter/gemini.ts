import { z } from "zod";

/**
 * Gemini REST API(generateContent) 호출.
 * SDK 없이 fetch로 호출해 의존성을 늘리지 않고, 응답은 Zod로 검증한다.
 * 서버 전용: LLM_API_KEY를 읽는다.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
/** 2026-11 기준 이 키로 안정적으로 응답한 모델. LLM_MODEL로 바꿀 수 있다. */
const DEFAULT_MODEL = "gemini-3.5-flash";
/** 기본 모델이 혼잡(503)·한도 초과(429)·시간 초과일 때 한 번 더 시도할 모델 */
const FALLBACK_MODEL = "gemini-2.5-flash";
const ATTEMPT_TIMEOUT_MS = 120_000;
/** 한 번의 generateJson 호출(재시도 포함)에 쓸 수 있는 전체 시간 */
const CALL_DEADLINE_MS = 160_000;
/** 남은 시간이 이보다 짧으면 새로 시도해도 응답을 받기 어렵다. */
const MIN_ATTEMPT_MS = 30_000;
/** 기본 모델 → 대체 모델 → (대기) 기본 모델 → 대체 모델 */
const MAX_ATTEMPTS = 4;
const BASE_RETRY_DELAY_MS = 4_000;
const MAX_RETRY_DELAY_MS = 30_000;
/** 섹션 여러 개를 한 번에 요청하므로 넉넉히 둔다. */
const MAX_OUTPUT_TOKENS = 32_768;
const RETRYABLE_STATUS = new Set([429, 500, 503, 504]);

export class LlmError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    /** 429 응답이 알려 준 대기 시간 */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

const responseSchema = z.object({
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        content: z
          .object({
            parts: z.array(z.object({ text: z.string().optional() })),
          })
          .optional(),
      }),
    )
    .min(1),
});

const errorSchema = z.object({
  error: z.object({
    status: z.string(),
    message: z.string(),
    // google.rpc.RetryInfo: { retryDelay: "24s" }
    details: z
      .array(z.object({ retryDelay: z.string().optional() }).loose())
      .optional(),
  }),
});

function parseRetryDelayMs(
  details: { retryDelay?: string }[] | undefined,
): number | undefined {
  const delay = details?.find((d) => d.retryDelay)?.retryDelay;
  const seconds = delay ? Number.parseFloat(delay) : Number.NaN;
  return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type GenerateJsonOptions<T> = {
  system: string;
  prompt: string;
  /** Gemini responseJsonSchema (JSON Schema) */
  jsonSchema: Record<string, unknown>;
  /** 모델 출력을 앱 경계에서 다시 검증할 schema */
  schema: z.ZodType<T>;
};

export function isLlmConfigured() {
  return Boolean(process.env.LLM_API_KEY);
}

function thinkingConfig(model: string) {
  // 문체 변환 작업이라 깊은 추론보다 응답 속도를 우선한다.
  return model.startsWith("gemini-3")
    ? { thinkingLevel: "low" }
    : { thinkingBudget: 0 };
}

async function generateOnce<T>(
  model: string,
  apiKey: string,
  timeoutMs: number,
  { system, prompt, jsonSchema, schema }: GenerateJsonOptions<T>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          thinkingConfig: thinkingConfig(model),
        },
      }),
    });
  } catch (error) {
    // 시간 초과와 네트워크 오류는 다른 모델로 다시 시도할 수 있다.
    throw new LlmError(`${model} 요청 실패: ${String(error)}`, true);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsedError = errorSchema.safeParse(body);
    // 429 메시지는 여러 줄의 한도 설명이 붙어 길어서 첫 줄만 남긴다.
    const detail = parsedError.success
      ? `${parsedError.data.error.status} ${parsedError.data.error.message.split(/\r?\n/)[0]}`
      : String(response.status);
    throw new LlmError(
      `${model} 응답 오류: ${detail}`,
      RETRYABLE_STATUS.has(response.status),
      parsedError.success
        ? parseRetryDelayMs(parsedError.data.error.details)
        : undefined,
    );
  }

  const candidate = responseSchema.parse(body).candidates[0];
  if (candidate.finishReason !== "STOP") {
    throw new LlmError(
      `${model} 응답이 완료되지 않았습니다: ${candidate.finishReason ?? "unknown"}`,
      false,
    );
  }
  const text = (candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("");
  return schema.parse(JSON.parse(text));
}

/**
 * JSON 출력을 요청하고 schema로 검증한다.
 * 혼잡(503)·한도 초과(429)·시간 초과면 기본 모델과 대체 모델을 번갈아 다시 시도한다.
 * 같은 모델을 다시 부르기 전에는 429가 알려 준 시간 또는 점점 늘어나는 간격만큼 기다린다.
 * 무료 등급은 모델별 분당 요청 수가 작으므로(예: 5회) 호출하는 쪽에서 요청 수 자체를 줄여야 한다.
 */
export async function generateJson<T>(
  options: GenerateJsonOptions<T>,
): Promise<T> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new LlmError("LLM_API_KEY 환경변수가 없습니다.", false);

  const models = [
    ...new Set([process.env.LLM_MODEL || DEFAULT_MODEL, FALLBACK_MODEL]),
  ];
  const deadline = Date.now() + CALL_DEADLINE_MS;
  /** 모델별로 다음 시도 전에 기다려야 하는 시각 */
  const notBefore = new Map<string, number>();

  for (let attempt = 0; ; attempt += 1) {
    const model = models[attempt % models.length];
    const waitMs = Math.max(0, (notBefore.get(model) ?? 0) - Date.now());
    if (waitMs > 0) await sleep(waitMs);

    const remaining = deadline - Date.now();
    try {
      return await generateOnce(
        model,
        apiKey,
        Math.min(ATTEMPT_TIMEOUT_MS, remaining),
        options,
      );
    } catch (error) {
      if (!(error instanceof LlmError && error.retryable)) throw error;

      const round = Math.floor(attempt / models.length);
      const delay = Math.min(
        error.retryAfterMs ?? BASE_RETRY_DELAY_MS * 2 ** round,
        MAX_RETRY_DELAY_MS,
      );
      notBefore.set(model, Date.now() + delay);

      const nextModel = models[(attempt + 1) % models.length];
      const nextWait = Math.max(
        0,
        (notBefore.get(nextModel) ?? 0) - Date.now(),
      );
      const canRetry =
        attempt + 1 < MAX_ATTEMPTS &&
        deadline - Date.now() - nextWait >= MIN_ATTEMPT_MS;

      if (!canRetry) {
        console.warn(`[단톡위키] ${error.message} → 재시도 한도에 닿아 포기`);
        throw error;
      }
      console.warn(
        `[단톡위키] ${error.message} → ${nextModel}로 재시도${nextWait ? ` (${Math.ceil(nextWait / 1000)}초 후)` : ""}`,
      );
    }
  }
}
