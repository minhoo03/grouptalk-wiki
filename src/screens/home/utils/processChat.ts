import type { RoomProfile } from "@/types/chat";
import type { Excerpt } from "@/services/wikiWriter/wikiWriter.schema";
import type { RoomWiki } from "@/types/wiki";
import { sampleExcerpts } from "@/screens/home/utils/aiProse/sampleExcerpts";
import { ChatStreamParser } from "@/screens/home/utils/parseChat";
import { analyzeChatSteps } from "@/screens/home/utils/analyzeChat";
import {
  applyParticipantDecisions,
  defaultDecisions,
  findParticipantCandidates,
  hasCandidates,
  type ParticipantCandidates,
  type ParticipantDecisions,
} from "@/screens/home/utils/participants";
import { buildRoomWikiSteps } from "@/screens/home/utils/roomWiki/buildRoomWiki";
import { readFileChunks } from "@/screens/home/utils/chunkReader";
import {
  isAbortError,
  runSliced,
  throwIfAborted,
  yieldToMain,
} from "@/screens/home/utils/slicing";

export type LoadStage = "read" | "parse" | "analyze" | "build" | "ai" | "done";

export type ChatSource = { file: File } | { text: string; fileName: string };

/** 봇 후보를 사용자에게 보여 주고 결정을 받는다. 취소하면 AbortError로 reject한다. */
export type ParticipantReviewHandler = (
  candidates: ParticipantCandidates,
) => Promise<ParticipantDecisions>;

export type ProgressHandler = (
  percent: number,
  stage: LoadStage,
  detail?: string,
) => void;

export const STAGE_LABEL: Record<LoadStage, string> = {
  read: "파일 읽기",
  parse: "대화 정리",
  analyze: "인물 분석",
  build: "문서 작성",
  ai: "AI 서술",
  done: "완료",
};

const TEXT_CHUNK_CHARS = 512 * 1024;

export class ChatLoadError extends Error {
  readonly isChatLoadError = true;
  readonly stage?: LoadStage;
  readonly original?: unknown;

  constructor(message: string, stage?: LoadStage, original?: unknown) {
    super(message);
    this.name = "ChatLoadError";
    this.stage = stage;
    this.original = original;
  }
}

export function isChatLoadError(err: unknown): err is ChatLoadError {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { isChatLoadError?: boolean }).isChatLoadError === true
  );
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

/**
 * Upload pipeline:
 *  1. read   (0–40%)  — 1MB byte chunks → streaming UTF-8 decode → streaming parse.
 *                       Never holds the whole file as one string.
 *  2. parse  (40–42%) — flush the last buffered line / CSV row, then drop bot accounts
 *                       (asks the user via onReview when there are candidates).
 *  3. analyze(42–60%) — per-person profiles, time-sliced.
 *  4. build  (60–100%)— room insights + wiki sections, time-sliced.
 * Results are returned only once everything succeeded, so callers can commit state atomically.
 */
export async function processChat(
  source: ChatSource,
  onProgress: ProgressHandler,
  signal?: AbortSignal,
  onReview?: ParticipantReviewHandler,
): Promise<{ room: RoomProfile; wiki: RoomWiki; excerpts: Excerpt[] }> {
  let stage: LoadStage = "read";
  const report = (percent: number, next: LoadStage, detail?: string) => {
    stage = next;
    onProgress(Math.min(100, Math.max(0, Math.round(percent))), next, detail);
  };

  try {
    const fileName = "file" in source ? source.file.name : source.fileName;
    const parser = new ChatStreamParser(fileName);
    report(0, "read");

    if ("file" in source) {
      const size = source.file.size || 1;
      for await (const chunk of readFileChunks(source.file)) {
        throwIfAborted(signal);
        parser.push(chunk.text);
        report(
          (chunk.bytesRead / size) * 40,
          "read",
          `${mb(chunk.bytesRead)} / ${mb(size)} · 메시지 ${parser.messageCount.toLocaleString()}개`,
        );
        await yieldToMain();
      }
    } else {
      const { text } = source;
      for (let i = 0; i < text.length; i += TEXT_CHUNK_CHARS) {
        throwIfAborted(signal);
        parser.push(text.slice(i, i + TEXT_CHUNK_CHARS));
        report(
          (Math.min(i + TEXT_CHUNK_CHARS, text.length) / text.length) * 40,
          "read",
          `메시지 ${parser.messageCount.toLocaleString()}개`,
        );
        await yieldToMain();
      }
    }

    report(40, "parse");
    const parsed = parser.end();
    if (parsed.messages.length === 0) {
      throw new ChatLoadError(
        '대화 내용을 찾지 못했어요. 카카오톡 "대화 내보내기"로 저장한 .csv 또는 .txt 파일인지 확인해 주세요.',
        "parse",
      );
    }

    // 봇을 뺀 뒤에 분석해야 모든 통계에 반영된다.
    const candidates = findParticipantCandidates(parsed.messages);
    let decisions = defaultDecisions(candidates);
    if (hasCandidates(candidates) && onReview) {
      decisions = await onReview(candidates);
      throwIfAborted(signal);
    }
    const messages = applyParticipantDecisions(parsed.messages, decisions);
    if (messages.length === 0) {
      throw new ChatLoadError("제외하고 나니 분석할 메시지가 남지 않았어요.", "parse");
    }
    const cleaned = { ...parsed, messages };
    const excludedBots = new Set(decisions.excludedBots);
    const bots = {
      excluded: decisions.excludedBots,
      kept: candidates.bots
        .map((bot) => bot.name)
        .filter((name) => !excludedBots.has(name)),
    };

    const authorCount = new Set(messages.map((m) => m.author)).size;
    report(
      42,
      "parse",
      `메시지 ${messages.length.toLocaleString()}개 · 참여자 ${authorCount}명`,
    );
    await yieldToMain();

    const room = await runSliced(
      analyzeChatSteps(cleaned),
      (f) =>
        report(
          42 + f * 18,
          "analyze",
          `참여자 ${authorCount}명의 말버릇과 기록 분석 중`,
        ),
      signal,
    );
    const wiki = await runSliced(
      buildRoomWikiSteps(room, messages, bots),
      (f) =>
        report(
          60 + f * 39,
          "build",
          f < 0.5
            ? "단톡방 전체 통계 계산 중"
            : "문단 작성 중",
        ),
      signal,
    );

    // 전체 메시지는 여기서 버리고, AI 서술에 쓸 대표 발언만 남긴다.
    const excerpts = sampleExcerpts(messages, cleaned.roomTitle);

    report(100, "done");
    await yieldToMain();
    return { room, wiki, excerpts };
  } catch (err) {
    if (isAbortError(err) || isChatLoadError(err)) throw err;
    console.error(`[단톡위키] '${STAGE_LABEL[stage]}' 단계 오류`, err);
    const detail =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new ChatLoadError(
      `'${STAGE_LABEL[stage]}' 단계에서 오류가 발생했어요. (${detail})`,
      stage,
      err,
    );
  }
}
