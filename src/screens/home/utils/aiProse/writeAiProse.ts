import {
  proseJobResultSchema,
  type Excerpt,
  type OverviewInfo,
  type PersonProseResult,
  type ProseJob,
  type ProseJobResult,
  type RoomProseResult,
  type TimelineEvent,
} from "@/services/wikiWriter/wikiWriter.schema";
import type { GeneratedWiki } from "@/store/wikiStore";
import type { RoomProfile } from "@/types/chat";
import type { RoomWiki } from "@/types/wiki";
import {
  applyRoomProse,
  toPersonProse,
} from "@/screens/home/utils/aiProse/applyProse";
import { buildProseRequest } from "@/screens/home/utils/aiProse/buildProseRequest";
import { splitProseJobs } from "@/screens/home/utils/aiProse/splitProseJobs";

type WriteAiProseInput = {
  room: RoomProfile;
  wiki: RoomWiki;
  excerpts: Excerpt[];
};

/** 끝난 묶음 수와 전체 묶음 수 */
export type AiProseProgressHandler = (done: number, total: number) => void;

const PROSE_ENDPOINT = "/api/wiki-prose";
/**
 * 동시에 보내는 묶음 수. 보통의 방은 묶음이 5개(단톡방 3 + 인물 2)라 한 번에 모두 보낸다.
 * 묶음은 두 모델에 번갈아 배정되므로 모델마다 최대 3개씩 동시에 돌아, 무료 등급 분당 한도(5회) 안이다.
 */
const CONCURRENCY = 6;

/** 묶음 하나를 요청한다. 실패하면 null이고, 그 부분은 규칙 기반 문장이 남는다. */
async function requestJob(
  job: ProseJob,
  signal?: AbortSignal,
): Promise<ProseJobResult | null> {
  const startedAt = Date.now();
  try {
    const payload = JSON.stringify(job);
    console.info(
      `[단톡위키] AI ${job.kind} 서술 묶음 요청 시작 (본문 ${(payload.length / 1024).toFixed(1)}KB)`,
    );
    const response = await fetch(PROSE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      signal,
    });
    const elapsed = Date.now() - startedAt;
    if (!response.ok) {
      // Vercel 함수 시간 초과(504)나 본문 크기 초과(413)는 JSON이 아닌 본문과 x-vercel-error 헤더로 온다.
      const text = await response.text().catch(() => "");
      console.error(
        `[단톡위키] AI ${job.kind} 서술 묶음 HTTP ${response.status} (${elapsed}ms)`,
        {
          vercelError: response.headers.get("x-vercel-error"),
          vercelId: response.headers.get("x-vercel-id"),
          body: text.slice(0, 500),
        },
      );
      throw new Error(`HTTP ${response.status}`);
    }
    const result = proseJobResultSchema.parse(await response.json());
    if (result.result) {
      console.info(`[단톡위키] AI ${job.kind} 서술 묶음 성공 (${elapsed}ms)`);
    } else {
      console.warn(
        `[단톡위키] AI ${job.kind} 서술 묶음 결과 없음 (${elapsed}ms)`,
        result.error ?? "서버가 이유를 알려 주지 않았습니다.",
      );
    }
    return result;
  } catch (error) {
    if (!signal?.aborted)
      console.error(`[단톡위키] AI ${job.kind} 서술 묶음 요청 실패`, error);
    return null;
  }
}

/** 묶음을 CONCURRENCY개씩 동시에 요청하고, 하나 끝날 때마다 진행률을 알린다. */
async function runJobs(
  jobs: ProseJob[],
  onProgress: AiProseProgressHandler,
  signal?: AbortSignal,
): Promise<(ProseJobResult | null)[]> {
  const results: (ProseJobResult | null)[] = [];
  let next = 0;
  let done = 0;
  onProgress(done, jobs.length);

  // 일일 한도가 끝나면 남은 묶음도 모두 거절되므로 보내지 않는다.
  let quotaExhausted = false;

  async function worker() {
    while (next < jobs.length && !signal?.aborted && !quotaExhausted) {
      const index = next;
      next += 1;
      const result = await requestJob(jobs[index], signal);
      results[index] = result;
      if (result?.quotaExhausted && !quotaExhausted) {
        quotaExhausted = true;
        console.warn(
          "[단톡위키] AI 일일 사용 한도가 끝나 남은 서술 요청을 보내지 않습니다. 규칙 기반 문장을 사용합니다.",
        );
      }
      done += 1;
      onProgress(quotaExhausted ? jobs.length : done, jobs.length);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker),
  );
  return results;
}

/**
 * 규칙 기반 문서에 AI 서술을 입힌다.
 * AI 서술은 부가 기능이므로 어떤 실패도 throw하지 않고, 실패한 묶음은 규칙 기반 문장을 그대로 둔다.
 */
export async function writeAiProse(
  { room, wiki, excerpts }: WriteAiProseInput,
  onProgress: AiProseProgressHandler,
  signal?: AbortSignal,
): Promise<GeneratedWiki> {
  const jobs = splitProseJobs(buildProseRequest(room, wiki, excerpts));
  const results = await runJobs(jobs, onProgress, signal);

  const roomSections: RoomProseResult["sections"] = [];
  const people: PersonProseResult["people"] = [];
  let overviewInfo: OverviewInfo | null = null;
  let timeline: TimelineEvent[] | null = null;
  for (const response of results) {
    if (response?.kind === "room" && response.result) {
      roomSections.push(...response.result.sections);
      overviewInfo ??= response.result.overviewInfo ?? null;
      timeline ??= response.result.timeline ?? null;
    }
    if (response?.kind === "person" && response.result)
      people.push(...response.result.people);
  }

  const memberNames = new Set(room.participants.map((p) => p.name));
  const personProse = toPersonProse({ people }, memberNames);
  return {
    room,
    wiki: applyRoomProse(
      wiki,
      { sections: roomSections, overviewInfo, timeline },
      memberNames,
    ),
    personProse,
    aiWritten:
      roomSections.length > 0 ||
      overviewInfo !== null ||
      timeline !== null ||
      Object.keys(personProse).length > 0,
  };
}
