import { generateJson } from "@/services/wikiWriter/gemini";
import {
  loadPrompts,
  type DocumentPrompts,
} from "@/services/wikiWriter/prompts";
import { QuoteVerifier } from "@/services/wikiWriter/verifyQuotes";
import {
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
 * 호출 단위: 무료 등급은 모델별 분당 요청 수가 5회 수준이라, 업로드 한 번에 보통
 * 단톡방 1회 + 인물 1회 = 2회만 호출한다. 응답 하나가 길어지는 대신 한도와 재시도 여유를 남긴다.
 * 구성원이 아주 많을 때만 인물을 여러 묶음으로 나눈다.
 * 한 묶음이 실패해도 나머지 결과는 사용하고, 실패한 부분은 규칙 기반 문장이 남는다.
 */

const ROOM_SECTIONS_PER_CALL = 40;
const PEOPLE_PER_CALL = 12;
const PERSON_EXCERPT_LIMIT = 40;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    chunks.push(items.slice(i, i + size));
  return chunks;
}

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
      return `### 장면 ${scene + 1} (${dates.join(" ~ ")})\n${body}`;
    })
    .join("\n\n");
}

/** 따로 뽑은 한 줄 발췌 */
function formatSingles(excerpts: Excerpt[]) {
  const singles = excerpts.filter((e) => e.scene === null);
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

/** 묶음 결과를 하나로 합친다. 모든 묶음이 실패하면 null. */
async function settleAll<T>(
  label: string,
  calls: Promise<T>[],
): Promise<T[] | null> {
  const settled = await Promise.allSettled(calls);
  const results: T[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") results.push(result.value);
    else
      console.error(
        `[단톡위키] AI ${label} 묶음 ${index + 1}/${settled.length} 실패`,
        result.reason,
      );
  });
  return results.length ? results : null;
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

# 작성할 섹션
아래 섹션의 각 하위 문단마다 paragraphs를 쓴다.

${sectionText}`;
}

function roomJsonSchema(sections: RoomProseRequest["sections"]) {
  return {
    type: "object",
    properties: {
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
    required: ["sections"],
  };
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
    sections: result.sections
      .filter((s) => allowed.has(s.key))
      .map((s) => ({
        key: s.key,
        subs: s.subs
          .filter((sub) => allowed.get(s.key)?.has(sub.key))
          .map((sub) => ({
            key: sub.key,
            paragraphs: verifier.verifyParagraphs(sub.paragraphs),
          })),
      })),
  };
}

export async function writeRoomProse(
  request: RoomProseRequest,
): Promise<RoomProseResult | null> {
  const { style, room } = await loadPrompts();
  const sections = request.sections.filter(
    (section) => room.sections.has(section.key) && section.subs.length > 0,
  );
  if (!sections.length) return null;

  const system = systemInstruction(style, room);
  const results = await settleAll(
    "단톡방 문서",
    chunk(sections, ROOM_SECTIONS_PER_CALL).map(async (group) => {
      const result = await generateJson({
        system,
        prompt: roomPrompt(request, group, room),
        jsonSchema: roomJsonSchema(group),
        schema: roomProseResultSchema,
      });
      const verifier = new QuoteVerifier(request.excerpts);
      const sanitized = sanitizeRoom(result, group, verifier);
      logRemoved("단톡방 문서", verifier);
      return sanitized;
    }),
  );
  return results && { sections: results.flatMap((r) => r.sections) };
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

export async function writePersonProse(
  request: PersonProseRequest,
): Promise<PersonProseResult | null> {
  const { style, person } = await loadPrompts();
  const people = request.people
    .map((p) => ({
      ...p,
      sections: p.sections.filter((s) => person.sections.has(s.key)),
    }))
    .filter((p) => p.sections.length > 0);
  if (!people.length) return null;

  const system = systemInstruction(style, person);
  const results = await settleAll(
    "인물 문서",
    chunk(people, PEOPLE_PER_CALL).map(async (group) => {
      const result = await generateJson({
        system,
        prompt: personPrompt(request, group, person),
        jsonSchema: personJsonSchema(group),
        schema: personProseResultSchema,
      });
      const allowed = new Map(
        group.map((p) => [p.name, new Set<string>(p.sections.map((s) => s.key))]),
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
    }),
  );
  return results && { people: results.flatMap((r) => r.people) };
}
