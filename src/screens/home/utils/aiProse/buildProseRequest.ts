import {
  isItemSection,
  type Excerpt,
  type PersonProseRequest,
  type PersonSectionKey,
  type WikiProseRequest,
} from "@/services/wikiWriter/wikiWriter.schema";
import type { PersonProfile, RoomProfile } from "@/types/chat";
import type { Block, Rich, RoomWiki } from "@/types/wiki";
import { formatDateKey, formatHour, formatTime } from "@/utils/format";

/**
 * 규칙 기반으로 완성한 문서와 통계를 LLM이 읽을 "사실" 평문으로 옮긴다.
 * 숫자는 이미 계산된 값을 그대로 넘겨, LLM이 숫자를 새로 만들지 않게 한다.
 */

const FACTS_LIMIT = 6000;
/** 숫자·목록 위주라 서술 자료로 의미가 없고 분량만 큰 섹션 */
const ROOM_SECTIONS_WITHOUT_PROSE = new Set(["method", "related"]);
const LONGEST_MESSAGE_LIMIT = 300;
/**
 * AI가 문단으로 바꾸면 안 되는 하위 문단(표를 그대로 둔다). 내용은 같은 섹션 첫 하위 문단의 사실로 넘긴다.
 * 개요 > 기본 정보: AI는 표의 일부 칸만 overviewInfo로 채운다.
 * 역사 > 주요 사건 연표: AI는 표의 행을 timeline으로 채운다.
 * 명칭 > 역대 방 이름: 시스템 메시지로 확인한 변경 이력이라 목록을 그대로 둔다.
 */
const FACTS_ONLY_SUBS = new Set([
  "overview/info",
  "history/timeline",
  "naming/renames",
]);

function clip(text: string, limit = FACTS_LIMIT) {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function richToText(rich: Rich, notes: RoomWiki["notes"]): string {
  return rich
    .map((part) => {
      if (typeof part === "string") return part;
      switch (part.t) {
        case "b":
        case "muted":
        case "anchor":
          return part.text;
        case "del":
          return `~~${part.text}~~`;
        case "link":
          return part.name;
        case "fn": {
          const note = notes[part.n - 1];
          return note ? ` (각주: ${note.text})` : "";
        }
      }
    })
    .join("");
}

function blockToText(block: Block, notes: RoomWiki["notes"]): string {
  switch (block.type) {
    case "p":
      return richToText(block.content, notes);
    case "list":
      return block.items.map((item) => `- ${richToText(item, notes)}`).join("\n");
    case "table":
      return [
        block.head.join(" | "),
        ...block.rows.map((row) =>
          row.map((cell) => richToText(cell, notes)).join(" | "),
        ),
      ].join("\n");
    case "bars":
      return block.items
        .map((item) => `- ${richToText(item.label, notes)}: ${item.raw}`)
        .join("\n");
    case "hours":
      return `${block.label} (0시~23시): ${block.data.join(", ")}`;
    case "quote":
      return `인용 “${block.quote}” — ${richToText(block.caption, notes)}`;
    case "dialogue":
      return block.lines
        .map((line) => `> ${line.author}: ${line.text}`)
        .join("\n");
  }
}

function memberSummary(person: PersonProfile, memberCount: number) {
  const parts = [
    `메시지 ${person.messageCount.toLocaleString()}개(지분 ${person.share}%, ${person.rank}위/${memberCount}명)`,
    `주 활동 ${formatHour(person.peakHour)}`,
  ];
  if (person.badges.length)
    parts.push(`별명: ${person.badges.map((b) => b.name).join(", ")}`);
  if (person.catchphrases.length)
    parts.push(
      `말버릇: ${person.catchphrases
        .slice(0, 3)
        .map((c) => `“${c.word}”`)
        .join(", ")}`,
    );
  return parts.join(" / ");
}

function personFacts(
  person: PersonProfile,
  room: RoomProfile,
): Record<PersonSectionKey, string> {
  const memberCount = room.participants.length;
  const topPartner = person.replyPartners[0];
  const nightPercent = person.messageCount
    ? Math.round((person.nightCount / person.messageCount) * 100)
    : 0;
  const lines = (...items: (string | false | null | undefined)[]) =>
    items.filter(Boolean).join("\n");

  return {
    overview: lines(
      `단톡방 "${room.roomTitle}"의 구성원(총 ${memberCount}명).`,
      `메시지 ${person.messageCount.toLocaleString()}개, 전체의 ${person.share}%, 발언량 ${person.rank}위.`,
      person.rank === 1 && "발언량 1위.",
      memberCount >= 3 && person.rank === memberCount && "발언량 꼴찌.",
      `주로 ${formatHour(person.peakHour)} 무렵 활동.`,
      topPartner &&
        `가장 자주 말을 받아 주는 상대: ${topPartner.name}(${topPartner.count}회).`,
      person.catchphrases[0] &&
        `대표 말버릇: “${person.catchphrases[0].word}”(${person.catchphrases[0].count}회).`,
    ),
    traits: lines(
      "구성원 비교 항목 (단톡방 1위를 100으로 환산한 값과 실제 값):",
      ...person.stats.map((s) => `- ${s.label}: ${s.value}/100 (${s.raw})`),
      `주 활동 시간: ${formatHour(person.peakHour)} 무렵.`,
      `새벽(23시~5시) 메시지 비율: ${nightPercent}%.`,
      `출석: 대화가 있었던 ${room.activeDays}일 중 ${person.activeDays}일 발언.`,
    ),
    nicknames: lines(
      ...person.badges.map(
        (b) => `- ${b.name}: ${b.description}${b.joke ? ` (~~${b.joke}~~)` : ""}`,
      ),
    ),
    quotes: lines(
      "말버릇:",
      ...person.catchphrases.map((c) => `- “${c.word}” ${c.count}회`),
      person.longestMessage &&
        `가장 긴 메시지(${person.longestMessage.length}자): “${clip(person.longestMessage, LONGEST_MESSAGE_LIMIT)}”`,
    ),
    relationships: person.replyPartners.length
      ? lines(
          "바로 앞 발언자가 다른 사람일 때 대답한 횟수:",
          ...person.replyPartners.map((p) => `- ${p.name}: ${p.count}회`),
        )
      : "다른 구성원과 주고받은 기록이 없다.",
    trivia: lines(
      person.firstMessage &&
        `첫 발언: ${formatDateKey(person.firstMessage.dateKey)} ${formatTime(person.firstMessage.hour, person.firstMessage.minute)} “${person.firstMessage.text}”`,
      person.lastMessage && `가장 최근 발언: “${person.lastMessage.text}”`,
      `‘ㅋㅋ’ 포함 메시지 ${person.laughCount}개, 사진 ${person.photoCount}장, 이모티콘 ${person.emoticonCount}개, 물음표 메시지 ${person.questionCount}개.`,
      person.topWords.length > 0 &&
        `자주 쓰는 단어: ${person.topWords
          .slice(0, 10)
          .map((w) => `${w.word}(${w.count})`)
          .join(", ")}`,
    ),
  };
}

export function buildProseRequest(
  room: RoomProfile,
  wiki: RoomWiki,
  excerpts: Excerpt[],
): WikiProseRequest {
  const members = room.participants.map((person) => ({
    name: person.name,
    summary: memberSummary(person, room.participants.length),
  }));

  const sections = wiki.sections
    .filter((section) => !ROOM_SECTIONS_WITHOUT_PROSE.has(section.key))
    .map((section) => {
      const subText = (sub: (typeof section.subs)[number]) =>
        sub.blocks.map((block) => blockToText(block, wiki.notes)).join("\n");
      const isFactsOnly = (sub: (typeof section.subs)[number]) =>
        FACTS_ONLY_SUBS.has(`${section.key}/${sub.key}`);
      const extraFacts = section.subs
        .filter(isFactsOnly)
        .map((sub) => `[${sub.title}]\n${subText(sub)}`)
        .join("\n\n");
      // 항목 섹션: AI가 항목을 새로 정하므로 규칙 기반 하위 문단을 사실 묶음 하나로 합친다.
      // 한 섹션이 여러 요청으로 나뉘어 같은 사건이 두 번 쓰이는 일도 막는다.
      if (isItemSection(section.key))
        return {
          key: section.key,
          title: section.title,
          subs: [
            {
              key: "facts",
              title: section.title,
              facts: clip(
                section.subs
                  .map((sub) => `[${sub.title}]\n${subText(sub)}`)
                  .join("\n\n"),
              ),
            },
          ],
        };
      return {
        key: section.key,
        title: section.title,
        subs: section.subs
          .filter((sub) => !isFactsOnly(sub))
          .map((sub, index) => ({
            key: sub.key,
            title: sub.title,
            facts: clip(
              index === 0 && extraFacts
                ? `${subText(sub)}\n\n${extraFacts}`
                : subText(sub),
            ),
          })),
      };
    });

  const people: PersonProseRequest["people"] = room.participants.map(
    (person) => {
      const facts = personFacts(person, room);
      return {
        name: person.name,
        sections: (Object.keys(facts) as PersonSectionKey[])
          .filter((key) => facts[key])
          .map((key) => ({ key, facts: clip(facts[key]) })),
      };
    },
  );

  return {
    room: { roomTitle: room.roomTitle, members, sections, excerpts },
    person: { roomTitle: room.roomTitle, members, people, excerpts },
  };
}
