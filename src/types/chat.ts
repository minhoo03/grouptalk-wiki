export interface ChatMessage {
  author: string;
  text: string;
  dateKey: string | null;
  hour: number | null;
  minute: number | null;
}

export interface ParsedChat {
  roomTitle: string;
  messages: ChatMessage[];
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
