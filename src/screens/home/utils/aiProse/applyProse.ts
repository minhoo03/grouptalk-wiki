import {
  HALL_OF_FAME_KEY,
  isItemSection,
  type OverviewInfo,
  type PersonProseResult,
  type RoomProseResult,
  type TimelineEvent,
} from "@/services/wikiWriter/wikiWriter.schema";
import {
  OVERVIEW_INFO_LABELS,
  TIMELINE_HEAD,
} from "@/screens/home/utils/roomWiki/sectionsIntro";
import { TRIVIA_SUB_KEY } from "@/screens/home/utils/roomWiki/sectionsMisc";
import type {
  Block,
  DialogueLine,
  Inline,
  NumberedSec,
  NumberedSub,
  PersonProse,
  Rich,
  RoomWiki,
  WikiNote,
} from "@/types/wiki";

/**
 * LLM이 쓴 문단을 문서에 합친다. 인용 검증은 서버(verifyQuotes.ts)에서 이미 끝났다.
 * 표·그래프·인용 상자는 그대로 두고 서술(p 블록)만 바꾼다. LLM이 쓰지 않은 부분은 규칙 기반 문장이 남는다.
 *
 * 허용 표기(style.md): **굵게**, ~~취소선~~, [[구성원 이름]], [* 각주], "> 이름: 메시지" 대화 장면,
 * [[#YYYY-MM-DD|문구]] 사건 문단 링크(그 날짜가 든 에피소드·논란 항목으로 연결한다).
 */

const TOKEN =
  /(\*\*[^*\n]+\*\*|~~[^~\n]+~~|\[\[[^\]\n]+\]\]|\[\*[^\]\n]*\])/;
const SCENE_LINE = /^>\s*([^:]+?)\s*:\s*(.*)$/;
/** 프롬프트에서 금지했지만 섞여 나올 수 있는 Markdown·나무위키 문법 흔적 */
const STRAY_MARKUP = /^\s*(#{1,6}\s+|={2,}.*?={2,}\s*|[-*]\s+|\d+\.\s+)/;

/** 각주 내용을 문서의 각주 목록에 추가하고 그 번호(1부터)를 돌려준다. */
type AddNote = (text: string) => number;
/** 사건 날짜로 문단 id를 찾는다. 없으면 null이고, 링크는 문구만 남는다. */
type ResolveAnchor = (date: string) => string | null;

const noAnchor: ResolveAnchor = () => null;

function parseInline(
  text: string,
  memberNames: Set<string>,
  addNote: AddNote,
  resolveAnchor: ResolveAnchor,
): Inline[] {
  const rich: Inline[] = [];
  for (const part of text.replace(STRAY_MARKUP, "").split(TOKEN)) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      rich.push({ t: "b", text: part.slice(2, -2) });
    } else if (part.startsWith("~~") && part.endsWith("~~")) {
      rich.push({ t: "del", text: part.slice(2, -2) });
    } else if (part.startsWith("[[#") && part.endsWith("]]")) {
      const [target, label] = part.slice(3, -2).split("|");
      const text = (label ?? target).trim();
      const id = resolveAnchor(target.trim());
      if (text) rich.push(id ? { t: "anchor", id, text } : text);
    } else if (part.startsWith("[[") && part.endsWith("]]")) {
      const name = part.slice(2, -2).trim();
      rich.push(memberNames.has(name) ? { t: "link", name } : name);
    } else if (part.startsWith("[*") && part.endsWith("]")) {
      const note = part.slice(2, -1).trim();
      if (note) rich.push({ t: "fn", n: addNote(note) });
    } else {
      rich.push(part);
    }
  }
  return rich;
}

function parseScene(lines: string[]): DialogueLine[] {
  return lines.flatMap((line) => {
    const match = SCENE_LINE.exec(line);
    return match ? [{ author: match[1].trim(), text: match[2].trim() }] : [];
  });
}

/** 문단 하나를 블록으로 바꾼다. 모든 줄이 "> 이름: 메시지"면 대화 장면, 아니면 서술 문단이다. */
export function parseParagraph(
  text: string,
  memberNames: Set<string>,
  addNote: AddNote,
  resolveAnchor: ResolveAnchor = noAnchor,
): Block | null {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return null;
  if (lines.every((line) => SCENE_LINE.test(line))) {
    return { type: "dialogue", lines: parseScene(lines) };
  }
  const content = parseInline(
    lines.join(" "),
    memberNames,
    addNote,
    resolveAnchor,
  );
  return content.length ? { type: "p", content } : null;
}

function parseParagraphs(
  texts: string[],
  memberNames: Set<string>,
  addNote: AddNote,
  resolveAnchor: ResolveAnchor = noAnchor,
): Block[] {
  return texts
    .map((text) => parseParagraph(text, memberNames, addNote, resolveAnchor))
    .filter((block): block is Block => block !== null);
}

/**
 * AI가 쓴 하위 문단에서는 서술이 통계 목록을 대신한다.
 * 문장·목록·표·막대는 AI에게 사실로 넘긴 내용이므로 지우고, 인용 상자와 시간대 차트만 남긴다.
 */
const REPLACED_BY_PROSE = new Set<Block["type"]>(["p", "list", "table", "bars"]);

/** 첫 대체 대상 자리에 새 블록을 넣고 나머지 대체 대상은 지운다. 대체할 블록이 없으면 맨 뒤에 붙인다. */
function replaceParagraphs(blocks: Block[], prose: Block[]): Block[] {
  const first = blocks.findIndex((block) => REPLACED_BY_PROSE.has(block.type));
  if (first === -1) return [...blocks, ...prose];
  return blocks.flatMap((block, index) => {
    if (index === first) return prose;
    return REPLACED_BY_PROSE.has(block.type) ? [] : [block];
  });
}

const OVERVIEW_INFO_SUB = "overview/info";
const TRIVIA_SUB = `trivia/${TRIVIA_SUB_KEY}`;

/**
 * 여담은 글머리표 목록이다. AI의 서술 문단 하나가 글머리표 하나가 되고,
 * 대화 장면은 목록을 잠시 끊고 그 항목 바로 아래에 둔다.
 */
function toBulletList(blocks: Block[]): Block[] {
  const result: Block[] = [];
  let items: Rich[] = [];
  const flush = () => {
    if (items.length) result.push({ type: "list", items });
    items = [];
  };
  for (const block of blocks) {
    if (block.type === "p") items.push(block.content);
    else {
      flush();
      result.push(block);
    }
  }
  flush();
  return result;
}
const TIMELINE_SUB = "history/timeline";
const HISTORY_ERA_SUB = /^history\/era\d+$/;

/** 연표 표를 AI가 고른 사건으로 바꾼다. */
function timelineBlocks(events: TimelineEvent[]): Block[] {
  return [
    {
      type: "table",
      head: [...TIMELINE_HEAD],
      rows: events.map((event) => [[event.date], [event.name], [event.summary]]),
    },
  ];
}

/** 표 행의 항목 이름(첫 칸의 첫 조각) */
function rowLabel(row: Rich[]) {
  const first = row[0]?.[0];
  return typeof first === "string" ? first : "";
}

/**
 * 개요 > 기본 정보 표의 AI 칸을 바꾼다. 행은 항목 이름(OVERVIEW_INFO_LABELS)으로 찾는다.
 * 전성기 칸은 [시기명, 기간] 두 조각이라 시기명만 바꾼다.
 * 화제 행이 없으면(자주 쓴 단어가 없던 방) 분위기 행 앞에 넣는다.
 */
function applyOverviewInfo(blocks: Block[], info: OverviewInfo): Block[] {
  const replacers: Record<string, (cell: Rich) => Rich> = {
    [OVERVIEW_INFO_LABELS.relationship]: (cell) =>
      info.relationship ? [info.relationship] : cell,
    [OVERVIEW_INFO_LABELS.topics]: (cell) =>
      info.topics.length ? [info.topics.join(", ")] : cell,
    [OVERVIEW_INFO_LABELS.mood]: (cell) =>
      info.mood.length ? [info.mood.join(", ")] : cell,
    [OVERVIEW_INFO_LABELS.peak]: (cell) =>
      info.peakName ? [info.peakName, ...cell.slice(1)] : cell,
  };
  return blocks.map((block) => {
    if (block.type !== "table") return block;
    const rows = block.rows.map((row) => {
      const replace = replacers[rowLabel(row)];
      return replace ? [row[0], replace(row[1] ?? [])] : row;
    });
    const hasTopics = rows.some(
      (row) => rowLabel(row) === OVERVIEW_INFO_LABELS.topics,
    );
    if (!hasTopics && info.topics.length) {
      const moodIndex = rows.findIndex(
        (row) => rowLabel(row) === OVERVIEW_INFO_LABELS.mood,
      );
      rows.splice(moodIndex >= 0 ? moodIndex : rows.length, 0, [
        [OVERVIEW_INFO_LABELS.topics],
        [info.topics.join(", ")],
      ]);
    }
    return { ...block, rows };
  });
}

type RoomSub = RoomProseResult["sections"][number]["subs"][number];

/** 항목 섹션(에피소드·논란)의 AI 항목. 번호와 id는 문서에 붙일 때 정한다. */
type Item = RoomSub & { id: string; number: string };

/** 섹션별 AI 항목에 번호·id를 붙인다. 같은 섹션이 여러 응답에 나뉘어 와도 이어서 센다. */
function numberItems(wiki: RoomWiki, result: RoomProseResult) {
  const items = new Map<string, Item[]>();
  for (const section of result.sections) {
    if (!isItemSection(section.key)) continue;
    const target = wiki.sections.find((s) => s.key === section.key);
    if (!target) continue;
    const list = items.get(section.key) ?? [];
    for (const sub of section.subs) {
      const index = list.length + 1;
      list.push({
        ...sub,
        key: `item${index}`,
        id: `w-${section.key}-item${index}`,
        number: `${target.number}.${index}`,
      });
    }
    items.set(section.key, list);
  }
  return items;
}

/** 항목 본문 뒤에 해명·여파 같은 하위 문단을 "번호. 제목" 굵은 줄로 붙인다. */
function itemSub(
  section: NumberedSec,
  item: Item,
  parse: (texts: string[]) => Block[],
): NumberedSub {
  const blocks = parse(item.paragraphs);
  (item.parts ?? []).forEach((part, index) => {
    const partBlocks = parse(part.paragraphs);
    if (!partBlocks.length) return;
    blocks.push(
      {
        type: "p",
        content: [{ t: "b", text: `${item.number}.${index + 1}. ${part.title}` }],
      },
      ...partBlocks,
    );
  });
  return {
    key: item.key,
    title: item.title ?? section.title,
    id: item.id,
    number: item.number,
    blocks,
  };
}

/** 명예의 전당 제목은 주인공 이름으로 시작하게 한다. 규칙 기반 제목은 "이름 — …"이다. */
function hallOfFameTitle(ruleTitle: string, aiTitle: string) {
  const name = ruleTitle.split(" — ")[0];
  return aiTitle.startsWith(name) ? aiTitle : `${name} — ${aiTitle}`;
}

export function applyRoomProse(
  wiki: RoomWiki,
  result: RoomProseResult | null,
  memberNames: Set<string>,
): RoomWiki {
  if (!result) return wiki;

  // 기존 각주 뒤에 AI 각주를 이어 붙여 번호가 겹치지 않게 한다.
  const notes: WikiNote[] = [...wiki.notes];
  const addNote: AddNote = (text) => notes.push({ text });

  // 사건 문단 링크([[#날짜|…]])는 그 날짜가 든 첫 항목으로 연결한다.
  const items = numberItems(wiki, result);
  const anchorByDate = new Map<string, string>();
  items.forEach((list) =>
    list.forEach((item) =>
      (item.dates ?? []).forEach((date) => {
        if (!anchorByDate.has(date)) anchorByDate.set(date, item.id);
      }),
    ),
  );
  const resolveAnchor: ResolveAnchor = (date) => anchorByDate.get(date) ?? null;
  const parse = (texts: string[]) =>
    parseParagraphs(texts, memberNames, addNote, resolveAnchor);

  const bySub = new Map<string, Block[]>();
  /** AI가 정한 하위 문단 제목(역사 시기명, 명예의 전당 제목) */
  const aiTitles = new Map<string, string>();
  for (const section of result.sections) {
    if (isItemSection(section.key)) continue;
    for (const sub of section.subs) {
      const subKey = `${section.key}/${sub.key}`;
      if (sub.title) aiTitles.set(subKey, sub.title);
      const blocks = parse(sub.paragraphs);
      if (blocks.length)
        bySub.set(
          subKey,
          subKey === TRIVIA_SUB ? toBulletList(blocks) : blocks,
        );
    }
  }

  const sections = wiki.sections.map((section): NumberedSec => {
    const sectionItems = items.get(section.key);
    if (sectionItems?.length)
      return {
        ...section,
        subs: sectionItems
          .map((item) => itemSub(section, item, parse))
          .filter((sub) => sub.blocks.length > 0),
      };
    return {
      ...section,
      subs: section.subs.map((sub) => {
        const subKey = `${section.key}/${sub.key}`;
        if (subKey === OVERVIEW_INFO_SUB && result.overviewInfo)
          return {
            ...sub,
            blocks: applyOverviewInfo(sub.blocks, result.overviewInfo),
          };
        if (subKey === TIMELINE_SUB && result.timeline?.length)
          return { ...sub, blocks: timelineBlocks(result.timeline) };
        const aiTitle = aiTitles.get(subKey);
        const title = !aiTitle
          ? sub.title
          : HISTORY_ERA_SUB.test(subKey)
            ? `${aiTitle} (${sub.title})`
            : section.key === HALL_OF_FAME_KEY
              ? hallOfFameTitle(sub.title, aiTitle)
              : sub.title;
        const prose = bySub.get(subKey);
        return {
          ...sub,
          title,
          blocks: prose ? replaceParagraphs(sub.blocks, prose) : sub.blocks,
        };
      }),
    };
  });

  // 항목 섹션의 하위 문단이 바뀌면 규칙 기반 각주가 가리키던 문단이 사라질 수 있다. 그 링크는 뗀다.
  const subIds = new Set(sections.flatMap((s) => s.subs.map((sub) => sub.id)));
  return {
    sections,
    notes: notes.map((note) =>
      note.link && !subIds.has(note.link.id) ? { text: note.text } : note,
    ),
  };
}

export function toPersonProse(
  result: PersonProseResult | null,
  memberNames: Set<string>,
): PersonProse {
  const prose: PersonProse = {};
  for (const person of result?.people ?? []) {
    const notes: string[] = [];
    const addNote: AddNote = (text) => notes.push(text);
    const sections: Record<string, Block[]> = {};
    for (const section of person.sections) {
      const blocks = parseParagraphs(section.paragraphs, memberNames, addNote);
      if (blocks.length) sections[section.key] = blocks;
    }
    if (Object.keys(sections).length) prose[person.name] = { sections, notes };
  }
  return prose;
}
