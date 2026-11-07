import { z } from "zod";

import type {
  Badge,
  ChatMessage,
  PersonProfile,
  RoomProfile,
} from "@/types/chat";
import type { Block, Inline, NumberedSec, RoomWiki, WikiNote } from "@/types/wiki";

/**
 * 공유 문서는 브라우저가 보낸 값이므로 저장할 때와 읽을 때 모두 이 schema로 검증한다.
 * `z.ZodType<T>` 주석으로 앱 타입과 schema가 어긋나면 typecheck에서 드러나게 한다.
 */

export const SHARE_CODE_PATTERN = /^[A-Za-z0-9]{8}$/;

const nullableInt = z.number().int().nullable();

const chatMessageSchema: z.ZodType<ChatMessage> = z.object({
  author: z.string(),
  text: z.string(),
  dateKey: z.string().nullable(),
  hour: nullableInt,
  minute: nullableInt,
});

const wordCountSchema = z.object({ word: z.string(), count: z.number() });

const badgeSchema: z.ZodType<Badge> = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  joke: z.string().optional(),
  rarity: z.enum(["legend", "epic", "rare", "common"]),
});

const personProfileSchema: z.ZodType<PersonProfile> = z.object({
  name: z.string(),
  rank: z.number(),
  messageCount: z.number(),
  share: z.number(),
  avgLength: z.number(),
  laughCount: z.number(),
  photoCount: z.number(),
  emoticonCount: z.number(),
  questionCount: z.number(),
  nightCount: z.number(),
  hourHistogram: z.array(z.number()),
  peakHour: z.number().nullable(),
  topWords: z.array(wordCountSchema),
  catchphrases: z.array(wordCountSchema),
  longestMessage: z.string(),
  firstMessage: chatMessageSchema.nullable(),
  lastMessage: chatMessageSchema.nullable(),
  replyPartners: z.array(z.object({ name: z.string(), count: z.number() })),
  activeDays: z.number(),
  level: z.number(),
  expProgress: z.number(),
  messagesToNext: z.number(),
  badges: z.array(badgeSchema),
  stats: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.number(),
      raw: z.string(),
    }),
  ),
});

const roomProfileSchema: z.ZodType<RoomProfile> = z.object({
  roomTitle: z.string(),
  totalMessages: z.number(),
  participants: z.array(personProfileSchema),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  activeDays: z.number(),
  busiestDay: z.object({ date: z.string(), count: z.number() }).nullable(),
  topWords: z.array(wordCountSchema),
  hourHistogram: z.array(z.number()),
  peakHour: z.number().nullable(),
  recentMessages: z.array(chatMessageSchema),
});

const inlineSchema: z.ZodType<Inline> = z.union([
  z.string(),
  z.discriminatedUnion("t", [
    z.object({ t: z.literal("b"), text: z.string() }),
    z.object({ t: z.literal("del"), text: z.string() }),
    z.object({ t: z.literal("muted"), text: z.string() }),
    z.object({ t: z.literal("link"), name: z.string() }),
    z.object({ t: z.literal("anchor"), id: z.string(), text: z.string() }),
    z.object({ t: z.literal("fn"), n: z.number() }),
  ]),
]);

const richSchema = z.array(inlineSchema);

const blockSchema: z.ZodType<Block> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("p"), content: richSchema }),
  z.object({ type: z.literal("list"), items: z.array(richSchema) }),
  z.object({
    type: z.literal("table"),
    head: z.array(z.string()),
    rows: z.array(z.array(richSchema)),
  }),
  z.object({
    type: z.literal("bars"),
    items: z.array(
      z.object({ label: richSchema, value: z.number(), raw: z.string() }),
    ),
  }),
  z.object({
    type: z.literal("hours"),
    data: z.array(z.number()),
    label: z.string(),
  }),
  z.object({ type: z.literal("quote"), quote: z.string(), caption: richSchema }),
  z.object({
    type: z.literal("dialogue"),
    lines: z.array(z.object({ author: z.string(), text: z.string() })),
  }),
]);

const numberedSecSchema: z.ZodType<NumberedSec> = z.object({
  key: z.string(),
  title: z.string(),
  id: z.string(),
  number: z.string(),
  subs: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      id: z.string(),
      number: z.string(),
      blocks: z.array(blockSchema),
    }),
  ),
});

const wikiNoteSchema: z.ZodType<WikiNote> = z.object({
  text: z.string(),
  link: z.object({ id: z.string(), label: z.string() }).optional(),
});

const roomWikiSchema: z.ZodType<RoomWiki> = z.object({
  sections: z.array(numberedSecSchema),
  notes: z.array(wikiNoteSchema),
});

export const sharedWikiSchema = z.object({
  room: roomProfileSchema,
  wiki: roomWikiSchema,
  // AI 서술 도입 전에 저장된 공유 문서도 읽을 수 있게 기본값을 둔다.
  personProse: z
    .record(
      z.string(),
      z.object({
        sections: z.record(z.string(), z.array(blockSchema)),
        notes: z.array(z.string()),
      }),
    )
    .default({}),
  aiWritten: z.boolean().default(false),
});

export type SharedWiki = z.infer<typeof sharedWikiSchema>;
