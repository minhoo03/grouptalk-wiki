import type {
  PersonProseResult,
  RoomProseResult,
} from "@/services/wikiWriter/wikiWriter.schema";
import type {
  Block,
  DialogueLine,
  Inline,
  PersonProse,
  RoomWiki,
  WikiNote,
} from "@/types/wiki";

/**
 * LLM이 쓴 문단을 문서에 합친다. 인용 검증은 서버(verifyQuotes.ts)에서 이미 끝났다.
 * 표·그래프·인용 상자는 그대로 두고 서술(p 블록)만 바꾼다. LLM이 쓰지 않은 부분은 규칙 기반 문장이 남는다.
 *
 * 허용 표기(style.md): **굵게**, ~~취소선~~, [[구성원 이름]], [* 각주], "> 이름: 메시지" 대화 장면.
 */

const TOKEN =
  /(\*\*[^*\n]+\*\*|~~[^~\n]+~~|\[\[[^\]\n]+\]\]|\[\*[^\]\n]*\])/;
const SCENE_LINE = /^>\s*([^:]+?)\s*:\s*(.*)$/;
/** 프롬프트에서 금지했지만 섞여 나올 수 있는 Markdown·나무위키 문법 흔적 */
const STRAY_MARKUP = /^\s*(#{1,6}\s+|={2,}.*?={2,}\s*|[-*]\s+|\d+\.\s+)/;

/** 각주 내용을 문서의 각주 목록에 추가하고 그 번호(1부터)를 돌려준다. */
type AddNote = (text: string) => number;

function parseInline(
  text: string,
  memberNames: Set<string>,
  addNote: AddNote,
): Inline[] {
  const rich: Inline[] = [];
  for (const part of text.replace(STRAY_MARKUP, "").split(TOKEN)) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      rich.push({ t: "b", text: part.slice(2, -2) });
    } else if (part.startsWith("~~") && part.endsWith("~~")) {
      rich.push({ t: "del", text: part.slice(2, -2) });
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
): Block | null {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return null;
  if (lines.every((line) => SCENE_LINE.test(line))) {
    return { type: "dialogue", lines: parseScene(lines) };
  }
  const content = parseInline(lines.join(" "), memberNames, addNote);
  return content.length ? { type: "p", content } : null;
}

function parseParagraphs(
  texts: string[],
  memberNames: Set<string>,
  addNote: AddNote,
): Block[] {
  return texts
    .map((text) => parseParagraph(text, memberNames, addNote))
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

export function applyRoomProse(
  wiki: RoomWiki,
  result: RoomProseResult | null,
  memberNames: Set<string>,
): RoomWiki {
  if (!result) return wiki;

  // 기존 각주 뒤에 AI 각주를 이어 붙여 번호가 겹치지 않게 한다.
  const notes: WikiNote[] = [...wiki.notes];
  const addNote: AddNote = (text) => notes.push({ text });

  const bySub = new Map<string, Block[]>();
  for (const section of result.sections) {
    for (const sub of section.subs) {
      const blocks = parseParagraphs(sub.paragraphs, memberNames, addNote);
      if (blocks.length) bySub.set(`${section.key}/${sub.key}`, blocks);
    }
  }

  return {
    notes,
    sections: wiki.sections.map((section) => ({
      ...section,
      subs: section.subs.map((sub) => {
        const prose = bySub.get(`${section.key}/${sub.key}`);
        return prose
          ? { ...sub, blocks: replaceParagraphs(sub.blocks, prose) }
          : sub;
      }),
    })),
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
