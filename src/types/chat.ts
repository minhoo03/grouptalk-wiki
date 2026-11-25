export interface ChatMessage {
  author: string;
  text: string;
  dateKey: string | null;
  hour: number | null;
  minute: number | null;
}

/**
 * 카카오톡 시스템 메시지에서 읽은 구성원 변동.
 * join: 들어옴(초대 포함), leave: 나감, kick: 내보내짐, rename: 방 이름 변경(name이 새 이름).
 * actor는 초대·내보내기·이름 변경을 한 사람이다. 기록에 없으면 null.
 */
export interface MemberEvent {
  type: "join" | "leave" | "kick" | "rename";
  name: string;
  actor: string | null;
  dateKey: string | null;
  /** 이 이벤트 직전까지 쌓인 메시지 수. 앞뒤 대화를 찾는 데 쓴다. */
  messageIndex: number;
}

export interface ParsedChat {
  roomTitle: string;
  messages: ChatMessage[];
  events: MemberEvent[];
}

export interface WordCount {
  word: string;
  count: number;
}

export type Rarity = "legend" | "epic" | "rare" | "common";

export interface Badge {
  id: string;
  name: string;
  description: string;
  joke?: string;
  rarity: Rarity;
}

export interface StatValue {
  key: string;
  label: string;
  value: number;
  raw: string;
}

export interface ReplyPartner {
  name: string;
  count: number;
}

export interface PersonProfile {
  name: string;
  rank: number;
  messageCount: number;
  share: number;
  avgLength: number;
  laughCount: number;
  photoCount: number;
  emoticonCount: number;
  questionCount: number;
  nightCount: number;
  hourHistogram: number[];
  peakHour: number | null;
  topWords: WordCount[];
  catchphrases: WordCount[];
  longestMessage: string;
  firstMessage: ChatMessage | null;
  lastMessage: ChatMessage | null;
  replyPartners: ReplyPartner[];
  activeDays: number;
  level: number;
  expProgress: number;
  messagesToNext: number;
  badges: Badge[];
  stats: StatValue[];
}

export interface RoomProfile {
  roomTitle: string;
  totalMessages: number;
  participants: PersonProfile[];
  startDate: string | null;
  endDate: string | null;
  activeDays: number;
  busiestDay: { date: string; count: number } | null;
  topWords: WordCount[];
  hourHistogram: number[];
  peakHour: number | null;
  recentMessages: ChatMessage[];
}
