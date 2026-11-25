import type { Excerpt } from "@/services/wikiWriter/wikiWriter.schema";

/**
 * LLM이 쓴 인용이 실제로 보낸 발췌에 있는지 검사한다. 프롬프트의 "인용은 원본에 실제로 있는 문장이어야 한다"를 코드로 보장한다.
 * - 대화 장면 줄("> 이름: 메시지"): 같은 사람의 발췌와 내용이 맞지 않으면 그 줄을 지운다.
 * - 각주("[* YYYY.MM.DD 이름: "인용"]"): 사람·날짜·인용이 발췌와 맞지 않으면 각주를 지운다.
 * 문장 속 일반 따옴표 인용은 문장 구조를 깨지 않고 지울 수 없어 검사하지 않는다.
 */

const SCENE_LINE = /^>\s*([^:]+?)\s*:\s*(.*)$/;
/** 접기로 감싼 장면 인용: 첫 줄 "{{{#!folding [ 제목 ]", 마지막 줄 "}}}" */
export const FOLD_OPEN = /^\{\{\{#!folding\s*\[\s*(.*?)\s*\]\s*$/;
export const FOLD_CLOSE = /^\}\}\}\s*$/;

/** 접기 줄을 떼어 낸 본문 줄과 접기 제목. 접기가 아니면 fold는 null. */
export function unwrapFold(lines: string[]): {
  fold: string | null;
  body: string[];
} {
  const open = lines.length >= 2 ? FOLD_OPEN.exec(lines[0].trim()) : null;
  if (!open || !FOLD_CLOSE.test(lines[lines.length - 1].trim()))
    return { fold: null, body: lines };
  return { fold: open[1] || "펼치기", body: lines.slice(1, -1) };
}
const FOOTNOTE = /\[\*\s*([^\]]*)\]/g;
const FOOTNOTE_BODY =
  /^(\d{4})[.-](\d{1,2})[.-](\d{1,2})\.?\s+([^:]+?)\s*:\s*["“'‘](.+)["”'’]\s*$/;
const ELLIPSIS = /(…|\.\.\.)$/;
const MEDIA_PLACEHOLDER = /^\((사진|동영상|이모티콘|파일|링크|삭제된 메시지)\)$/;

function normalize(text: string) {
  return text.replace(ELLIPSIS, "").replace(/\s+/g, " ").trim();
}

function toDateKey(year: string, month: string, day: string) {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

type Match = { author: string; text: string; date?: string | null };

export class QuoteVerifier {
  private readonly byAuthor = new Map<string, Excerpt[]>();
  removed = 0;

  constructor(excerpts: Excerpt[]) {
    for (const excerpt of excerpts) {
      const list = this.byAuthor.get(excerpt.author) ?? [];
      list.push(excerpt);
      this.byAuthor.set(excerpt.author, list);
    }
  }

  private exists({ author, text, date }: Match) {
    const quote = normalize(text);
    if (!quote) return false;
    return (this.byAuthor.get(author.trim()) ?? []).some(
      (excerpt) =>
        normalize(excerpt.text).includes(quote) &&
        (date === undefined || excerpt.date === date),
    );
  }

  private verifyFootnotes(text: string) {
    return text.replace(FOOTNOTE, (whole, body: string) => {
      const match = FOOTNOTE_BODY.exec(body.trim());
      const ok =
        match &&
        // "(사진)" 같은 미디어 표시는 근거가 될 내용이 없다.
        !MEDIA_PLACEHOLDER.test(match[5].trim()) &&
        this.exists({
          date: toDateKey(match[1], match[2], match[3]),
          author: match[4],
          text: match[5],
        });
      if (ok) return whole;
      this.removed += 1;
      return "";
    });
  }

  /** 검증을 통과한 문단을 돌려준다. 남는 내용이 없으면 null. */
  verifyParagraph(paragraph: string): string | null {
    const { fold, body: lines } = unwrapFold(
      paragraph.split(/\r?\n/).filter((line) => line.trim()),
    );
    const isScene = lines.length > 0 && lines.every((l) => SCENE_LINE.test(l));

    if (isScene) {
      const kept = lines.filter((line) => {
        const [, author, text] = SCENE_LINE.exec(line) ?? [];
        const ok = Boolean(author) && this.exists({ author, text });
        if (!ok) this.removed += 1;
        return ok;
      });
      if (!kept.length) return null;
      return fold === null
        ? kept.join("\n")
        : [`{{{#!folding [ ${fold} ]`, ...kept, "}}}"].join("\n");
    }

    // 장면이 아닌 내용을 접은 것은 접기를 풀고 서술로 둔다.
    const prose = fold === null ? paragraph : lines.join("\n");
    const verified = this.verifyFootnotes(prose).trim();
    return verified || null;
  }

  verifyParagraphs(paragraphs: string[]): string[] {
    return paragraphs
      .map((p) => this.verifyParagraph(p))
      .filter((p): p is string => p !== null);
  }
}
