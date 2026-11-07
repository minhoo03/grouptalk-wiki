import type { ChatMessage, ParsedChat } from "@/types/chat";

const TITLE = /^(.+?)\s*(?:님과)?\s*카카오톡\s*대화/;
const PC_DATE = /^-{3,}\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일.*$/;
const PC_MSG = /^\[(.+?)\]\s*\[(오전|오후)\s*(\d{1,2}):(\d{2})\]\s?(.*)$/;
const MOBILE_MSG =
  /^(\d{4})[.년-]\s*(\d{1,2})[.월-]\s*(\d{1,2})[.일]?\s*(?:(오전|오후)\s*)?(\d{1,2}):(\d{2}),\s*(.+?)\s:\s(.*)$/;
const MOBILE_DATE = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일(?:\s*\S+요일)?\s*$/;
const MOBILE_SYSTEM = /^(\d{4})[.년-]\s*(\d{1,2})[.월-]\s*(\d{1,2})/;
const CSV_DATE =
  /(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})[^\d]*?(?:(오전|오후|AM|PM)\s*)?(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i;

const QUOTE = 34; // "
const COMMA = 44; // ,
const LF = 10;
const CR = 13;

/** Parses a whole export in one call. Uses the same streaming parser as chunked uploads. */
export function parseChat(raw: string, fileName: string): ParsedChat {
  const parser = new ChatStreamParser(fileName);
  parser.push(raw);
  return parser.end();
}

/**
 * Incremental KakaoTalk export parser. Feed decoded text chunks of ANY size via `push`;
 * the result of `end()` is identical to parsing the full text at once:
 * - TXT: the unfinished last line of each chunk is buffered until its newline arrives.
 * - CSV: the quote/cell/row state machine persists across chunks, so quoted multi-line
 *   messages, escaped quotes ("") and CRLF split across a boundary are handled.
 */
export class ChatStreamParser {
  private mode: "csv" | "txt" | null = null;
  private started = false;
  private pending = "";
  private lineBuffer = "";
  private txt = new TxtLineParser();
  private csv = new CsvChatBuilder();
  private csvRows = new CsvRowParser((row) => this.csv.row(row));

  constructor(private readonly fileName: string) {}

  get messageCount(): number {
    return this.mode === "csv"
      ? this.csv.messages.length
      : this.txt.messages.length;
  }

  push(chunk: string) {
    if (!chunk) return;
    let text = chunk;
    if (!this.started) {
      text = text.replace(/^\uFEFF/, "");
      this.started = true;
    }
    if (!this.mode) {
      this.pending += text;
      const nl = this.pending.search(/\r?\n/);
      if (nl < 0) return; // first line not complete yet
      this.decideMode(this.pending.slice(0, nl));
      text = this.pending;
      this.pending = "";
    }
    this.feed(text);
  }

  end(): ParsedChat {
    if (!this.mode) {
      this.decideMode(this.pending);
      const rest = this.pending;
      this.pending = "";
      this.feed(rest);
    }
    if (this.mode === "csv") {
      this.csvRows.end();
      return {
        roomTitle: cleanTitle("", this.fileName),
        messages: this.csv.messages,
      };
    }
    if (this.lineBuffer) this.txt.line(stripCr(this.lineBuffer));
    this.lineBuffer = "";
    return {
      roomTitle: cleanTitle(this.txt.roomTitle, this.fileName),
      messages: this.txt.messages,
    };
  }

  private decideMode(firstLine: string) {
    this.mode =
      /\.csv$/i.test(this.fileName) || /^(date|날짜)\s*,/i.test(firstLine)
        ? "csv"
        : "txt";
  }

  private feed(text: string) {
    if (!text) return;
    if (this.mode === "csv") {
      this.csvRows.push(text);
      return;
    }
    const combined = this.lineBuffer + text;
    let start = 0;
    let nl = combined.indexOf("\n", start);
    while (nl >= 0) {
      this.txt.line(stripCr(combined.slice(start, nl)));
      start = nl + 1;
      nl = combined.indexOf("\n", start);
    }
    this.lineBuffer = combined.slice(start);
  }
}

function stripCr(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

class TxtLineParser {
  messages: ChatMessage[] = [];
  roomTitle = "";
  private index = 0;
  private currentDate: string | null = null;
  private last: ChatMessage | null = null;

  line(rawLine: string) {
    const index = this.index++;
    const line = rawLine.trimEnd();
    if (!line.trim()) return;

    if (index < 3 && !this.roomTitle) {
      const title = line.match(TITLE);
      if (title) {
        this.roomTitle = title[1].trim();
        return;
      }
    }
    if (line.startsWith("저장한 날짜")) return;

    const pcDate = line.match(PC_DATE);
    const pcDateKey = pcDate ? toKey(pcDate[1], pcDate[2], pcDate[3]) : null;
    if (pcDateKey) {
      this.currentDate = pcDateKey;
      this.last = null;
      return;
    }

    const pc = line.match(PC_MSG);
    if (pc) {
      const hour = to24(Number(pc[3]), pc[2]);
      const minute = hour === null ? null : toMinute(pc[4]);
      this.pushMessage(
        pc[1].trim(),
        pc[5],
        this.currentDate,
        minute === null ? null : hour,
        minute,
      );
      return;
    }

    const mobile = line.match(MOBILE_MSG);
    const mobileKey = mobile ? toKey(mobile[1], mobile[2], mobile[3]) : null;
    if (mobile && mobileKey) {
      this.currentDate = mobileKey;
      const hour = to24(Number(mobile[5]), mobile[4]);
      const minute = hour === null ? null : toMinute(mobile[6]);
      this.pushMessage(
        mobile[7].trim(),
        mobile[8],
        mobileKey,
        minute === null ? null : hour,
        minute,
      );
      return;
    }

    const mobileDate = line.match(MOBILE_DATE);
    const mobileDateKey = mobileDate
      ? toKey(mobileDate[1], mobileDate[2], mobileDate[3])
      : null;
    if (mobileDateKey) {
      this.currentDate = mobileDateKey;
      this.last = null;
      return;
    }

    const system = line.match(MOBILE_SYSTEM);
    if (system && toKey(system[1], system[2], system[3])) {
      this.last = null;
      return;
    }

    if (this.last) this.last.text += `\n${line}`;
  }

  private pushMessage(
    author: string,
    text: string,
    dateKey: string | null,
    hour: number | null,
    minute: number | null,
  ) {
    this.last = { author, text, dateKey, hour, minute };
    this.messages.push(this.last);
  }
}

class CsvRowParser {
  private row: string[] = [];
  private cell = "";
  private quoted = false;
  private quoteSeen = false;
  private skipLF = false;

  constructor(private readonly onRow: (row: string[]) => void) {}

  push(text: string) {
    let seg = 0;
    const flush = (end: number) => {
      if (end > seg) this.cell += text.slice(seg, end);
    };
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      if (this.skipLF) {
        this.skipLF = false;
        if (ch === LF) {
          seg = i + 1;
          continue;
        }
      }
      if (this.quoteSeen) {
        this.quoteSeen = false;
        if (ch === QUOTE) {
          this.cell += '"';
          seg = i + 1;
          continue;
        }
        this.quoted = false;
        seg = i;
      }
      if (this.quoted) {
        if (ch === QUOTE) {
          flush(i);
          this.quoteSeen = true;
          seg = i + 1;
        }
        continue;
      }
      if (ch === QUOTE) {
        flush(i);
        this.quoted = true;
        seg = i + 1;
      } else if (ch === COMMA) {
        flush(i);
        this.row.push(this.cell);
        this.cell = "";
        seg = i + 1;
      } else if (ch === LF || ch === CR) {
        flush(i);
        this.endRow();
        if (ch === CR) this.skipLF = true;
        seg = i + 1;
      }
    }
    flush(text.length);
  }

  end() {
    if (this.quoteSeen) {
      this.quoteSeen = false;
      this.quoted = false;
    }
    if (this.cell || this.row.length) this.endRow();
  }

  private endRow() {
    this.row.push(this.cell);
    this.onRow(this.row);
    this.row = [];
    this.cell = "";
  }
}

class CsvChatBuilder {
  messages: ChatMessage[] = [];
  private headerChecked = false;
  private dateCol = 0;
  private userCol = 1;
  private msgCol = 2;

  row(row: string[]) {
    if (!row.some((c) => c.trim())) return;
    if (!this.headerChecked) {
      this.headerChecked = true;
      const header = row.map((c) => c.trim().toLowerCase());
      const hasHeader = header.some((c) =>
        /^(date|날짜|user|사용자|이름|message|메시지|내용)$/.test(c),
      );
      if (hasHeader) {
        const find = (re: RegExp, fallback: number) => {
          const i = header.findIndex((c) => re.test(c));
          return i >= 0 ? i : fallback;
        };
        this.dateCol = find(/^(date|날짜|시간|일시)$/, 0);
        this.userCol = find(/^(user|사용자|이름|보낸 ?사람|name)$/, 1);
        this.msgCol = find(/^(message|메시지|내용|text)$/, 2);
        return;
      }
    }
    const author = (row[this.userCol] ?? "").trim();
    const body = (row[this.msgCol] ?? "").replace(/\r/g, "");
    if (!author || !body.trim()) return;
    const d = (row[this.dateCol] ?? "").match(CSV_DATE);
    const ampm = d ? normalizeAmPm(d[4] ?? d[7]) : undefined;
    const dateKey = d ? toKey(d[1], d[2], d[3]) : null;
    const hour = d && dateKey ? to24(Number(d[5]), ampm) : null;
    const minute = d && hour !== null ? toMinute(d[6]) : null;
    this.messages.push({
      author,
      text: body,
      dateKey,
      hour: minute === null ? null : hour,
      minute,
    });
  }
}

function normalizeAmPm(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.toUpperCase();
  if (v === "AM" || v === "오전") return "오전";
  if (v === "PM" || v === "오후") return "오후";
  return undefined;
}

function cleanTitle(title: string, fileName: string): string {
  const fromTitle = title.replace(/\s+\d+$/, "").trim();
  if (fromTitle) return fromTitle;
  const base = fileName.replace(/\.(txt|csv)$/i, "").trim();
  const kakao = base.match(/^KakaoTalk_Chat_(.+?)_\d{4}-\d{2}-\d{2}/i);
  if (kakao) return kakao[1].replace(/_/g, " ").trim() || "우리 단톡방";
  if (!base || /^kakaotalk/i.test(base)) return "우리 단톡방";
  return base;
}

/** Returns null for impossible dates so a stray number in a message can't stretch the timeline by centuries. */
function toKey(y: string, m: string, d: string): string | null {
  const year = Number(y);
  const month = Number(m);
  const date = Number(d);
  if (
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    date < 1 ||
    date > 31
  )
    return null;
  const check = new Date(year, month - 1, date);
  if (check.getMonth() !== month - 1) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

function to24(hour: number, ampm: string | undefined): number | null {
  if (!Number.isFinite(hour) || hour < 0) return null;
  if (!ampm) return hour <= 23 ? hour : null;
  if (hour > 12) return null;
  const h = hour % 12;
  return ampm === "오후" ? h + 12 : h;
}

function toMinute(value: string): number | null {
  const minute = Number(value);
  return Number.isFinite(minute) && minute >= 0 && minute <= 59 ? minute : null;
}
