import {
  isItemSection,
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

/**
 * 같은 일화가 여러 섹션에 되풀이되지 않게 묶음을 순서대로 보낸다.
 * 사건을 자세히 쓰는 섹션(에피소드·논란)이 먼저 쓰고, 뒤 순서 묶음은 앞에서 다룬 이야기 목록(covered)을 받아
 * 다시 풀어 쓰지 않는다. 같은 순서 안의 묶음은 동시에 보낸다. 인물 문서는 단톡방 문서와 따로 읽히므로 첫 순서에 보낸다.
 */
const COVER_ORDER: Record<string, number> = {
  episodes: 0,
  controversy: 0,
  members: 0,
  overview: 1,
  naming: 1,
  history: 1,
  culture: 1,
  slang: 1,
};
/** 위에 없는 섹션(명예의 전당·여담)은 마지막에 앞의 모든 이야기를 받고 쓴다. */
const LAST_ORDER = 2;
const COVERED_LIMIT = 80;
const COVERED_TEXT_LIMIT = 300;
const FOOTNOTE = /\[\*\s*([^\]]+)\]/g;

function orderOf(job: ProseJob) {
  if (job.kind === "person") return 0;
  return Math.max(
    ...job.request.sections.map((s) => COVER_ORDER[s.key] ?? LAST_ORDER),
  );
}

/** 응답에서 "이미 다룬 이야기"를 뽑는다: 사건 항목 제목·날짜, 연표, 각주 인용, 장면 인용의 첫 줄 */
function coveredFrom(result: RoomProseResult): string[] {
  const lines: string[] = [];
  const fromText = (text: string) => {
    for (const match of text.matchAll(FOOTNOTE)) lines.push(`인용 ${match[1]}`);
    const first = text.split(/\r?\n/).find((line) => line.trim().startsWith(">"));
    if (first) lines.push(`장면 ${first.trim()}`);
  };
  for (const section of result.sections)
    for (const sub of section.subs) {
      if (isItemSection(section.key) && sub.title)
        lines.push(
          `${section.key === "culture" ? "문화" : "사건"} "${sub.title}"${sub.dates?.length ? ` (${sub.dates.join(", ")})` : ""}`,
        );
      sub.paragraphs.forEach(fromText);
      (sub.parts ?? []).forEach((part) => part.paragraphs.forEach(fromText));
      (sub.rows ?? []).forEach((row) => row.forEach(fromText));
    }
  (result.timeline ?? []).forEach((event) =>
    lines.push(`연표 ${event.date} ${event.name}`),
  );
  return lines.map((line) => line.slice(0, COVERED_TEXT_LIMIT));
}

/** 묶음을 CONCURRENCY개씩 동시에 요청하고, 하나 끝날 때마다 onDone을 부른다. */
async function runJobs(
  jobs: ProseJob[],
  onDone: (result: ProseJobResult | null) => void,
  signal?: AbortSignal,
): Promise<{ results: (ProseJobResult | null)[]; quotaExhausted: boolean }> {
  const results: (ProseJobResult | null)[] = [];
  let next = 0;

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
      onDone(result);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker),
  );
  return { results, quotaExhausted };
}

/** COVER_ORDER 순서대로 묶음을 보내고, 앞 순서에서 다룬 이야기를 뒤 순서 단톡방 묶음에 넘긴다. */
async function runInOrder(
  jobs: ProseJob[],
  onProgress: AiProseProgressHandler,
  signal?: AbortSignal,
): Promise<(ProseJobResult | null)[]> {
  const results: (ProseJobResult | null)[] = new Array(jobs.length).fill(null);
  const covered: string[] = [];
  let done = 0;
  onProgress(done, jobs.length);

  const orders = [...new Set(jobs.map(orderOf))].sort((a, b) => a - b);
  for (const order of orders) {
    if (signal?.aborted) break;
    const indexes = jobs.flatMap((job, i) => (orderOf(job) === order ? [i] : []));
    const coveredNow = [...new Set(covered)].slice(0, COVERED_LIMIT);
    const batch = indexes.map((i): ProseJob => {
      const job = jobs[i];
      return job.kind === "room" && coveredNow.length
        ? { ...job, request: { ...job.request, covered: coveredNow } }
        : job;
    });
    const { results: batchResults, quotaExhausted } = await runJobs(
      batch,
      () => onProgress(++done, jobs.length),
      signal,
    );
    batchResults.forEach((result, k) => {
      results[indexes[k]] = result ?? null;
      if (result?.kind === "room" && result.result)
        covered.push(...coveredFrom(result.result));
    });
    if (quotaExhausted) {
      onProgress(jobs.length, jobs.length);
      break;
    }
  }
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
  const results = await runInOrder(jobs, onProgress, signal);

  const roomSections: RoomProseResult["sections"] = [];
  const people: PersonProseResult["people"] = [];
  /** 결과를 받지 못한 묶음의 섹션·인물. 화면에 "통계로만 작성했다"고 알린다. */
  const missingSections = new Set<string>();
  const missingPeople = new Set<string>();
  jobs.forEach((job, index) => {
    if (results[index]?.result) return;
    if (job.kind === "room")
      job.request.sections.forEach((section) => missingSections.add(section.key));
    else job.request.people.forEach((person) => missingPeople.add(person.name));
  });
  // 여러 묶음에 나뉜 섹션(명예의 전당)은 한 묶음이라도 성공했으면 실패로 보지 않는다.
  jobs.forEach((job, index) => {
    if (job.kind === "room" && results[index]?.result)
      job.request.sections.forEach((section) => missingSections.delete(section.key));
  });
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
      missingSections,
    ),
    personProse,
    aiMissingPeople: [...missingPeople],
    aiWritten:
      roomSections.length > 0 ||
      overviewInfo !== null ||
      timeline !== null ||
      Object.keys(personProse).length > 0,
  };
}
