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
  /** fold가 있으면 접힌 채로 보여 주고, 펼치기 제목으로 쓴다. */
  | { type: "table"; head: string[]; rows: Rich[][]; fold?: string }
  /** 하위 문단 안의 소제목(나무위키 ==== 소제목 ====) */
  | { type: "h"; text: string }
  | { type: "bars"; items: BarItem[] }
  | { type: "hours"; data: number[]; label: string }
  | { type: "quote"; quote: string; caption: Rich }
  /** 대화 장면 인용. AI 서술이 원본 발췌에서 그대로 옮긴 연속된 메시지 */
  | { type: "dialogue"; lines: DialogueLine[]; fold?: string }
  /**
   * AI에게만 보내는 계산값(친밀도 지수·정규화 값·배율 등). 화면에는 그리지 않고, AI 서술을 입힌 뒤 문서에서 뺀다.
   * 문서를 읽는 사람은 이 숫자를 해석할 필요가 없다. AI가 사람의 말로 풀어 쓴다.
   */
  | { type: "facts"; text: string }
  /** 접힌 블록 묶음. AI 서술이 들어간 하위 문단의 통계(표·목록·자동 문장)를 "통계 펼치기"로 둔다. */
  | { type: "fold"; label: string; blocks: Block[] };

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
  /** AI 서술을 요청했지만 실패해 통계로만 작성된 섹션 */
  aiMissing?: boolean;
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
