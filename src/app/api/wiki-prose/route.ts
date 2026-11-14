import { isLlmConfigured } from "@/services/wikiWriter/gemini";
import { proseJobSchema } from "@/services/wikiWriter/wikiWriter.schema";
import { writeProseJob } from "@/services/wikiWriter/wikiWriter";

/**
 * AI 서술 묶음 하나를 쓴다.
 * Server Action은 클라이언트가 한 번에 하나씩만 보내므로, 묶음을 병렬로 보내고
 * 묶음마다 진행률을 보여 주기 위해 Route Handler로 둔다.
 * 공개 endpoint이므로 입력을 다시 검증한다.
 */

/** gemini.ts의 CALL_DEADLINE_MS(170초)보다 길게 둔다. */
export const maxDuration = 200;

export async function POST(request: Request) {
  const startedAt = Date.now();
  // 배포 환경 진단용. 키 값 자체는 남기지 않고 존재 여부와 길이만 남긴다.
  console.info("[단톡위키] AI 서술 요청 수신", {
    vercelEnv: process.env.VERCEL_ENV ?? "(없음)",
    region: process.env.VERCEL_REGION ?? "(없음)",
    hasLlmApiKey: isLlmConfigured(),
    llmApiKeyLength: process.env.LLMAPI_KEY?.trim().length ?? 0,
    llmModel: process.env.LLM_MODEL || "(기본값)",
    contentLength: request.headers.get("content-length"),
  });

  const body: unknown = await request.json().catch(() => null);
  const parsed = proseJobSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[단톡위키] AI 서술 요청 형식 오류", parsed.error.issues);
    return Response.json({ error: "invalid request" }, { status: 400 });
  }
  if (!isLlmConfigured()) {
    const error =
      "LLMAPI_KEY 환경변수가 서버에 없습니다. Vercel 프로젝트 환경변수(해당 Environment)를 확인하고 재배포하세요.";
    console.error(`[단톡위키] ${error}`);
    return Response.json({ kind: parsed.data.kind, result: null, error });
  }
  const result = await writeProseJob(parsed.data);
  console.info(
    `[단톡위키] AI ${parsed.data.kind} 서술 묶음 응답 (${Date.now() - startedAt}ms)`,
    result.result ? "성공" : `실패: ${result.error ?? "결과 없음"}`,
  );
  return Response.json(result);
}
