export type Inline =
  | string
  | { t: "b"; text: string }
  | { t: "del"; text: string }
  | { t: "muted"; text: string }
  | { t: "link"; name: string }
  | { t: "anchor"; id: string; text: string }
  | { t: "fn"; n: number };

export type Rich = Inline[];

export interface BarItem {
  label: Rich;
  value: number;
  raw: string;
}

export type Block =
  | { type: "p"; content: Rich }
  | { type: "list"; items: Rich[] }
  | { type: "table"; head: string[]; rows: Rich[][] }
  | { type: "bars"; items: BarItem[] }
  | { type: "hours"; data: number[]; label: string }
  | { type: "quote"; quote: string; caption: Rich }
  /** 대화 장면 인용. AI 서술이 원본 발췌에서 그대로 옮긴 연속된 메시지 */
  | { type: "dialogue"; lines: DialogueLine[] };

export interface DialogueLine {
  author: string;
  text: string;
}

export interface WikiSub {
  key: string;
  title: string;
  blocks: Block[];
}

export interface WikiSec {
  key: string;
  title: string;
  subs: WikiSub[];
}

export interface NumberedSub extends WikiSub {
  id: string;
  number: string;
}

export interface NumberedSec {
  key: string;
  title: string;
  id: string;
  number: string;
  subs: NumberedSub[];
}

/** Where a footnote points to inside the room document (section key + sub-section key). */
export interface NoteRef {
  sec: string;
  sub: string;
}

export interface WikiNote {
  text: string;
  /** Resolved after numbering. Present only when the target section actually exists. */
  link?: { id: string; label: string };
}

export interface RoomWiki {
  sections: NumberedSec[];
  notes: WikiNote[];
}

/**
 * AI가 쓴 인물 문서 서술. 인물 이름 → { 섹션 key → 블록(문단·대화 장면), 각주 }.
 * 섹션 key는 PersonScreen의 overview·traits·nicknames·quotes·relationships·trivia다.
 * 블록 안의 각주 번호 n은 이 인물의 `notes` 기준(1부터)이며, 화면에서 고정 각주 뒤로 밀어 붙인다.
 */
export interface PersonProseEntry {
  sections: Record<string, Block[]>;
  notes: string[];
}

export type PersonProse = Record<string, PersonProseEntry>;
