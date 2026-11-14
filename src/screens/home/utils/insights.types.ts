import type { ChatMessage, WordCount } from "@/types/chat";

export type MsgKind =
  | "text"
  | "photo"
  | "video"
  | "emoticon"
  | "deleted"
  | "file";

export interface TimedMessage extends ChatMessage {
  idx: number;
  ts: number | null;
  kind: MsgKind;
  link: boolean;
}

export interface Ranked {
  name: string;
  value: number;
}

export interface ReplyStat extends Ranked {
  samples: number;
}

export interface Session {
  start: number;
  end: number;
  count: number;
  starter: string;
  ender: string;
  night: number;
  authors: number;
}

export interface Bucket {
  key: string;
  label: string;
  count: number;
  /** 이 구간 중 기록 기간 안에 든 달력 일수. 첫·마지막 구간은 한 달(주)보다 짧을 수 있다. */
  days: number;
  /** count / days. 구간끼리는 이 값으로 비교한다. */
  perDay: number;
  members: number;
  top: string | null;
  topWord: string | null;
}

export interface RecentWindow {
  fromKey: string;
  toKey: string;
  days: number;
  count: number;
  members: number;
  perDay: number;
  top: string | null;
  /** 바로 앞 같은 길이 구간의 메시지 수. 기록이 그만큼 길지 않으면 null */
  prevCount: number | null;
  /** 이 구간에 많이 쓴 단어(많은 순, 최대 5개). 최근 화제의 단서 */
  topWords: string[];
}

export interface Phrase {
  text: string;
  count: number;
  users: Ranked[];
  first: TimedMessage;
  last: TimedMessage;
}

export interface DayStat {
  key: string;
  count: number;
  authors: Map<string, number>;
  media: number;
}

export interface Gap {
  fromKey: string;
  toKey: string;
  days: number;
}

export interface PersonGap extends Gap {
  name: string;
}

export type TypeKey =
  | "short"
  | "long"
  | "emoticon"
  | "photo"
  | "link"
  | "laugh"
  | "question"
  | "call"
  | "nightMood";
export type MediaKey = "photo" | "video" | "emoticon" | "link" | "deleted";

export interface TypeRank {
  key: TypeKey;
  ranking: Ranked[];
  example: TimedMessage | null;
}

export interface Band {
  label: string;
  range: string;
  count: number;
  top: string | null;
}

/** Month bucket for the monthly-activity chart. Field is `count` (not `value`). */
export interface MonthCount {
  label: string;
  count: number;
}

export interface RenameEvent {
  name: string;
  dateKey: string | null;
  author: string;
}

export interface Insights {
  timed: TimedMessage[];
  members: Ranked[];
  total: number;
  startKey: string | null;
  endKey: string | null;
  spanDays: number;
  activeDays: number;
  emptyDays: number;
  days: DayStat[];
  bucketUnit: "월" | "주" | "일";
  buckets: Bucket[];
  /** 전체 기록 기간 일평균 메시지 수 */
  perDay: number;
  /** "현재": 마지막 기록일 기준 최근 30일(기록 기간이 더 짧으면 전체) */
  recent: RecentWindow | null;
  months: MonthCount[];
  /** 요일별 메시지 수. index 0이 일요일 */
  weekday: number[];
  /** 기록 기간 안의 요일별 달력 일수. weekday[i] / weekdayDays[i]가 그 요일의 일평균이다. */
  weekdayDays: number[];
  weekdayAvg: number;
  weekendAvg: number;
  weekdayTop: string | null;
  weekendTop: string | null;
  hours: number[];
  bands: Band[];
  nightRank: Ranked[];
  morningRank: Ranked[];
  kindCounts: Record<MsgKind, number>;
  media: Record<MediaKey, Ranked[]>;
  mediaTotal: Record<MediaKey, number>;
  sessions: Session[];
  starters: Ranked[];
  enders: Ranked[];
  quietAfter: Ranked[];
  repliers: Ranked[];
  replySpeed: ReplyStat[];
  replyMedianAll: number | null;
  transitions: { from: string; to: string; count: number }[];
  pairs: { a: string; b: string; count: number; ratio: number }[];
  longestGap: { from: TimedMessage; to: TimedMessage; minutes: number } | null;
  dayGaps: Gap[];
  personGaps: PersonGap[];
  personMaxGap: PersonGap[];
  personDayMax: { name: string; key: string; count: number } | null;
  busiestDay: DayStat | null;
  busiestTopWord: string | null;
  longestLaugh: { msg: TimedMessage; length: number } | null;
  longestMessage: TimedMessage | null;
  latest: TimedMessage | null;
  allPresentDays: string[];
  phrases: Phrase[];
  laughs: WordCount[];
  emojiTop: WordCount[];
  words: WordCount[];
  trendWords: { word: string; bucket: string; count: number }[];
  vanished: { word: string; count: number; lastKey: string | null }[];
  wordBurst: { word: string; key: string; count: number } | null;
  topicLeaders: { word: string; name: string; count: number }[];
  types: TypeRank[];
  typeTotals: Record<TypeKey, number>;
  textAvgLength: number;
  misunderstandings: TimedMessage[];
  rumors: TimedMessage[];
  corrections: TimedMessage[];
  unanswered: TimedMessage[];
  repeatRun: { name: string; text: string; count: number } | null;
  /** 카카오톡 "방 이름을 '…'으로 변경" 시스템 메시지. 시간순 */
  renames: RenameEvent[];
  years: number[];
}
