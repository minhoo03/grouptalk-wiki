import {
  generateJson,
  isDailyQuotaError,
} from "@/services/wikiWriter/gemini";
import {
  loadPrompts,
  type DocumentPrompts,
} from "@/services/wikiWriter/prompts";
import { QuoteVerifier } from "@/services/wikiWriter/verifyQuotes";
import {
  type PreferredModel,
  type ProseJob,
  type OverviewInfo,
  type ProseJobResult,
  type TimelineEvent,
  HALL_OF_FAME_KEY,
  isItemSection,
  personProseResultSchema,
  roomProseResultSchema,
  type Excerpt,
  type PersonProseRequest,
  type PersonProseResult,
  type RoomProseRequest,
  type RoomProseResult,
} from "@/services/wikiWriter/wikiWriter.schema";

/**
 * 섹션별 Markdown 지시문과 분석 자료를 조립해 Gemini에 서술 문단을 요청한다. 서버 전용.
 *
 * 호출 단위: 브라우저가 문서를 묶음(ROOM_JOB_GROUPS, PEOPLE_PER_JOB)으로 나눠
 * 묶음마다 한 번씩 요청한다. 여기서는 묶음 하나 = Gemini 호출 1회다.
 * 실패한 묶음은 null을 돌려주고, 그 부분은 화면에서 규칙 기반 문장이 남는다.
 */

const PERSON_EXCERPT_LIMIT = 40;

/** 장면 표시. naming은 한 줄 발췌에만 붙으므로 장면 제목에는 쓰지 않는다. */
const SCENE_TAG_LABEL: Record<NonNullable<Excerpt["tag"]>, string> = {
  opening: "첫 기록",
  closing: "마지막 기록",
  naming: "방 이름",
  custom: "관행 단서",
};

/** 연속된 대화 장면. "> 이름: 메시지" 인용은 여기서만 그대로 옮겨 쓸 수 있다. */
function formatScenes(excerpts: Excerpt[]) {
  const scenes = new Map<number, Excerpt[]>();
  for (const excerpt of excerpts) {
    if (excerpt.scene === null) continue;
    const list = scenes.get(excerpt.scene) ?? [];
    list.push(excerpt);
    scenes.set(excerpt.scene, list);
  }
  if (!scenes.size) return "(장면 없음)";
  return [...scenes.entries()]
    .map(([scene, lines]) => {
      const dates = [...new Set(lines.map((l) => l.date ?? "날짜 미상"))];
      const body = lines.map((l) => `> ${l.author}: ${l.text}`).join("\n");
      const tag = lines[0].tag ? ` [${SCENE_TAG_LABEL[lines[0].tag]}]` : "";
      return `### 장면 ${scene + 1}${tag} (${dates.join(" ~ ")})\n${body}`;
    })
    .join("\n\n");
}

/** 따로 뽑은 한 줄 발췌 */
function formatSingles(
  excerpts: Excerpt[],
  tag: "naming" | "custom" | null = null,
) {
  const singles = excerpts.filter(
    (e) => e.scene === null && (e.tag ?? null) === tag,
  );
  if (!singles.length) return "(발췌 없음)";
  return singles
    .map((e) => `- [${e.date ?? "날짜 미상"}] ${e.author}: ${e.text}`)
    .join("\n");
}

/** 검증에 실패한 인용을 지운 결과와, 지운 개수를 로그로 남긴다. */
function logRemoved(label: string, verifier: QuoteVerifier) {
  if (verifier.removed > 0)
    console.warn(
      `[단톡위키] AI ${label}: 발췌와 일치하지 않는 인용 ${verifier.removed}개를 지웠습니다.`,
    );
}

function formatMembers(members: RoomProseRequest["members"]) {
  return members.map((m) => `- ${m.name}: ${m.summary}`).join("\n");
}

function systemInstruction(style: string, doc: DocumentPrompts) {
  return `${style}\n\n# 이번 작업\n\n${doc.document}`;
}

// ---------- 단톡방 문서 ----------

function roomPrompt(
  request: RoomProseRequest,
  sections: RoomProseRequest["sections"],
  prompts: DocumentPrompts,
) {
  const sectionText = sections
    .map((section) => {
      const subs = section.subs
        .map(
          (sub) =>
            `### 하위 문단 \`${sub.key}\` — ${sub.title}\n사실:\n${sub.facts}`,
        )
        .join("\n\n");
      return `## 섹션 \`${section.key}\` — ${section.title}\n\n지시:\n${prompts.sections.get(section.key)}\n\n${subs}`;
    })
    .join("\n\n");

  return `# 단톡방: ${request.roomTitle}

## 구성원 (이 목록의 이름만 [[이름]]으로 쓸 수 있다)
${formatMembers(request.members)}

## 대화 장면 (원본에서 연속된 메시지. 장면 인용은 여기서만 그대로 옮긴다)
${formatScenes(request.excerpts)}

## 한 줄 발췌 (형식: [날짜] 이름: 내용)
${formatSingles(request.excerpts)}

## 방 이름·방 지칭 발언 (방 이름이나 "우리 방"처럼 방을 가리키는 표현이 나온 메시지. 형식은 한 줄 발췌와 같다)
${formatSingles(request.excerpts, "naming")}

## 관행·규칙 단서 발언 (사과·지적·생일·정산·도착 인증·인사처럼 반복되는 관행의 단서가 될 만한 메시지. 형식은 한 줄 발췌와 같다)
${formatSingles(request.excerpts, "custom")}

# 작성할 섹션
아래 섹션의 각 하위 문단마다 paragraphs를 쓴다.

${sectionText}`;
}

/**
 * 표 칸을 함께 받는 묶음. 표의 사실은 섹션 첫 하위 문단에 붙어 가므로(buildProseRequest),
 * 그 하위 문단이 든 묶음 하나에서만 요청한다.
 */
const OVERVIEW_INFO_ANCHOR = { section: "overview", sub: "intro" };
const TIMELINE_ANCHOR = { section: "history", sub: "before" };
const HISTORY_ERA_KEY = /^era\d+$/;
const ITEM_LIMIT = 12;
const ITEM_TITLE_LIMIT = 40;
const ITEM_DATES_LIMIT = 10;
/** 방의 성격과 문화의 "주요 대화 주제"는 화제 3~5개를 하위 문단으로 둔다. */
const ITEM_PARTS_LIMIT = 6;
const INFO_TEXT_LIMIT = 30;
const INFO_LIST_LIMIT = 3;
const TIMELINE_LIMIT = 15;
const TIMELINE_NAME_LIMIT = 30;
const TIMELINE_SUMMARY_LIMIT = 80;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const timelineJsonSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      date: { type: "string" },
      name: { type: "string" },
      summary: { type: "string" },
    },
    required: ["date", "name", "summary"],
  },
};

const overviewInfoJsonSchema = {
  type: "object",
  properties: {
    relationship: { type: "string" },
    topics: { type: "array", items: { type: "string" } },
    mood: { type: "array", items: { type: "string" } },
    peakName: { type: "string" },
  },
  required: ["relationship", "topics", "mood", "peakName"],
};

function hasSub(
  sections: RoomProseRequest["sections"],
  anchor: { section: string; sub: string },
) {
  return sections.some(
    (s) =>
      s.key === anchor.section && s.subs.some((sub) => sub.key === anchor.sub),
  );
}

function roomJsonSchema(sections: RoomProseRequest["sections"]) {
  const withInfo = hasSub(sections, OVERVIEW_INFO_ANCHOR);
  const withTimeline = hasSub(sections, TIMELINE_ANCHOR);
  return {
    type: "object",
    properties: {
      ...(withInfo && { overviewInfo: overviewInfoJsonSchema }),
      ...(withTimeline && { timeline: timelineJsonSchema }),
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string", enum: sections.map((s) => s.key) },
            subs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  title: { type: "string" },
                  dates: { type: "array", items: { type: "string" } },
                  parts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        paragraphs: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                      required: ["title", "paragraphs"],
                    },
                  },
                  paragraphs: { type: "array", items: { type: "string" } },
                },
                required: ["key", "paragraphs"],
              },
            },
          },
          required: ["key", "subs"],
        },
      },
    },
    required: [
      "sections",
      ...(withInfo ? ["overviewInfo"] : []),
      ...(withTimeline ? ["timeline"] : []),
    ],
  };
}

/** 표 칸에 들어갈 짧은 평문으로 다듬는다. 표 안에서는 앱 표기(굵게·링크 등)를 해석하지 않는다. */
function cleanCell(text: string, limit = INFO_TEXT_LIMIT) {
  const plain = text.replace(/[*~[\]>]/g, "").replace(/\s+/g, " ").trim();
  return plain.length > limit ? `${plain.slice(0, limit)}…` : plain;
}

type RoomSub = RoomProseResult["sections"][number]["subs"][number];

/** 제목을 AI가 정하는 하위 문단 */
function hasAiTitle(sectionKey: string, subKey: string) {
  return (
    (sectionKey === "history" && HISTORY_ERA_KEY.test(subKey)) ||
    sectionKey === HALL_OF_FAME_KEY
  );
}

/**
 * 항목 섹션의 응답을 다듬는다. 요청한 하위 문단 key("facts")와 상관없이 AI가 만든 항목을 받되,
 * 제목과 검증을 통과한 본문이 있는 항목만 남기고 key를 item1, item2, ...로 다시 붙인다.
 */
function sanitizeItems(subs: RoomSub[], verifier: QuoteVerifier): RoomSub[] {
  return subs
    .flatMap((sub) => {
      const title = cleanCell(sub.title ?? "", ITEM_TITLE_LIMIT);
      const paragraphs = verifier.verifyParagraphs(sub.paragraphs);
      if (!title || !paragraphs.length) return [];
      const parts = (sub.parts ?? [])
        .flatMap((part) => {
          const partTitle = cleanCell(part.title, ITEM_TITLE_LIMIT);
          const partParagraphs = verifier.verifyParagraphs(part.paragraphs);
          return partTitle && partParagraphs.length
            ? [{ title: partTitle, paragraphs: partParagraphs }]
            : [];
        })
        .slice(0, ITEM_PARTS_LIMIT);
      const dates = (sub.dates ?? [])
        .map((date) => date.trim())
        .filter((date) => DATE_KEY.test(date))
        .slice(0, ITEM_DATES_LIMIT);
      return [{ key: "", title, dates, parts, paragraphs }];
    })
    .slice(0, ITEM_LIMIT)
    .map((item, index) => ({ ...item, key: `item${index + 1}` }));
}

/** 요청한 하위 문단만 남기고, 제목은 AI가 정하는 하위 문단(hasAiTitle)에서만 받는다. */
function sanitizeSubs(
  sectionKey: string,
  subs: RoomSub[],
  allowedKeys: Set<string> | undefined,
  verifier: QuoteVerifier,
): RoomSub[] {
  return subs
    .filter((sub) => allowedKeys?.has(sub.key))
    .map((sub) => {
      const title =
        hasAiTitle(sectionKey, sub.key) && sub.title
          ? cleanCell(sub.title, ITEM_TITLE_LIMIT)
          : "";
      return {
        key: sub.key,
        ...(title && { title }),
        paragraphs: verifier.verifyParagraphs(sub.paragraphs),
      };
    });
}

/** 날짜 형식이 맞고 이름이 있는 행만 날짜순으로 남긴다. 같은 날 사건은 하나만 둔다. */
function sanitizeTimeline(
  events: TimelineEvent[] | null | undefined,
): TimelineEvent[] | null {
  const seen = new Set<string>();
  const cleaned = (events ?? [])
    .map((event) => ({
      date: event.date.trim(),
      name: cleanCell(event.name, TIMELINE_NAME_LIMIT),
      summary: cleanCell(event.summary, TIMELINE_SUMMARY_LIMIT),
    }))
    .filter((event) => {
      if (!DATE_KEY.test(event.date) || !event.name || seen.has(event.date))
        return false;
      seen.add(event.date);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, TIMELINE_LIMIT);
  return cleaned.length ? cleaned : null;
}

function sanitizeOverviewInfo(
  info: OverviewInfo | null | undefined,
): OverviewInfo | null {
  if (!info) return null;
  const list = (items: string[]) =>
    items
      .map((item) => cleanCell(item))
      .filter(Boolean)
      .slice(0, INFO_LIST_LIMIT);
  const cleaned = {
    relationship: cleanCell(info.relationship),
    topics: list(info.topics),
    mood: list(info.mood),
    peakName: cleanCell(info.peakName),
  };
  const isEmpty =
    !cleaned.relationship &&
    !cleaned.topics.length &&
    !cleaned.mood.length &&
    !cleaned.peakName;
  return isEmpty ? null : cleaned;
}

/** 요청하지 않은 섹션·하위 문단 key는 버리고, 발췌와 맞지 않는 인용을 지운다. */
function sanitizeRoom(
  result: RoomProseResult,
  sections: RoomProseRequest["sections"],
  verifier: QuoteVerifier,
): RoomProseResult {
  const allowed = new Map(
    sections.map((s) => [s.key, new Set(s.subs.map((sub) => sub.key))]),
  );
  return {
    overviewInfo: hasSub(sections, OVERVIEW_INFO_ANCHOR)
      ? sanitizeOverviewInfo(result.overviewInfo)
      : null,
    timeline: hasSub(sections, TIMELINE_ANCHOR)
      ? sanitizeTimeline(result.timeline)
      : null,
    sections: result.sections
      .filter((s) => allowed.has(s.key))
      .map((s) => ({
        key: s.key,
        subs: isItemSection(s.key)
          ? sanitizeItems(s.subs, verifier)
          : sanitizeSubs(s.key, s.subs, allowed.get(s.key), verifier),
      })),
  };
}

async function writeRoomProse(
  request: RoomProseRequest,
  preferredModel: PreferredModel,
): Promise<RoomProseResult | null> {
  const { style, room } = await loadPrompts();
  const sections = request.sections.filter(
    (section) => room.sections.has(section.key) && section.subs.length > 0,
  );
  if (!sections.length) return null;

  const result = await generateJson({
    system: systemInstruction(style, room),
    prompt: roomPrompt(request, sections, room),
    jsonSchema: roomJsonSchema(sections),
    schema: roomProseResultSchema,
    preferredModel,
  });
  const verifier = new QuoteVerifier(request.excerpts);
  const sanitized = sanitizeRoom(result, sections, verifier);
  logRemoved("단톡방 문서", verifier);
  return sanitized;
}

// ---------- 인물 문서 ----------

function personPrompt(
  request: PersonProseRequest,
  people: PersonProseRequest["people"],
  prompts: DocumentPrompts,
) {
  const sectionKeys = new Set(
    people.flatMap((person) => person.sections.map((s) => s.key)),
  );
  const instructions = [...sectionKeys]
    .map((key) => `### 섹션 \`${key}\`\n${prompts.sections.get(key)}`)
    .join("\n\n");

  const peopleText = people
    .map((person) => {
      const singles = request.excerpts
        .filter((e) => e.scene === null && e.author === person.name)
        .slice(0, PERSON_EXCERPT_LIMIT);
      const sections = person.sections
        .map((s) => `### 섹션 \`${s.key}\` 사실\n${s.facts}`)
        .join("\n\n");
      return `## 인물: ${person.name}\n\n### 이 사람의 한 줄 발췌\n${formatSingles(singles)}\n\n${sections}`;
    })
    .join("\n\n");

  return `# 단톡방: ${request.roomTitle}

## 구성원 (이 목록의 이름만 [[이름]]으로 쓸 수 있다)
${formatMembers(request.members)}

## 대화 장면 (원본에서 연속된 메시지. 장면 인용은 여기서만 그대로 옮긴다)
${formatScenes(request.excerpts)}

# 섹션별 지시 (모든 인물에 공통)
${instructions}

# 작성할 인물
각 인물마다, 사실이 주어진 섹션의 paragraphs를 쓴다. name은 아래 이름을 철자 그대로 쓴다.

${peopleText}`;
}

function personJsonSchema(people: PersonProseRequest["people"]) {
  return {
    type: "object",
    properties: {
      people: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", enum: people.map((p) => p.name) },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  paragraphs: { type: "array", items: { type: "string" } },
                },
                required: ["key", "paragraphs"],
              },
            },
          },
          required: ["name", "sections"],
        },
      },
    },
    required: ["people"],
  };
}

async function writePersonProse(
  request: PersonProseRequest,
  preferredModel: PreferredModel,
): Promise<PersonProseResult | null> {
  const { style, person } = await loadPrompts();
  const people = request.people
    .map((p) => ({
      ...p,
      sections: p.sections.filter((s) => person.sections.has(s.key)),
    }))
    .filter((p) => p.sections.length > 0);
  if (!people.length) return null;

  const result = await generateJson({
    system: systemInstruction(style, person),
    prompt: personPrompt(request, people, person),
    jsonSchema: personJsonSchema(people),
    schema: personProseResultSchema,
    preferredModel,
  });
  const allowed = new Map(
    people.map((p) => [p.name, new Set<string>(p.sections.map((s) => s.key))]),
  );
  const verifier = new QuoteVerifier(request.excerpts);
  const sanitized = {
    people: result.people
      .filter((p) => allowed.has(p.name))
      .map((p) => ({
        name: p.name,
        sections: p.sections
          .filter((s) => allowed.get(p.name)?.has(s.key))
          .map((s) => ({
            key: s.key,
            paragraphs: verifier.verifyParagraphs(s.paragraphs),
          })),
      })),
  };
  logRemoved("인물 문서", verifier);
  return sanitized;
}

// ---------- 묶음 하나 ----------

/**
 * 묶음 하나를 쓴다. AI 서술은 부가 기능이라 어떤 실패도 throw하지 않고 result: null을 돌려준다.
 * 그때 화면은 그 묶음의 규칙 기반 문장을 유지한다.
 */
export async function writeProseJob(job: ProseJob): Promise<ProseJobResult> {
  const label = job.kind === "room" ? "단톡방" : "인물";
  try {
    if (job.kind === "room")
      return {
        kind: "room",
        result: await writeRoomProse(job.request, job.preferredModel),
      };
    return {
      kind: "person",
      result: await writePersonProse(job.request, job.preferredModel),
    };
  } catch (error) {
    const quotaExhausted = isDailyQuotaError(error);
    console.error(
      `[단톡위키] AI ${label} 서술 묶음 실패${quotaExhausted ? " (일일 한도 소진)" : ""}`,
      error,
    );
    return job.kind === "room"
      ? { kind: "room", result: null, quotaExhausted }
      : { kind: "person", result: null, quotaExhausted };
  }
}
