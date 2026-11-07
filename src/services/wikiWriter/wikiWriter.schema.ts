import { z } from "zod";

/**
 * 브라우저 → 서버(Server Action) → Gemini로 이어지는 AI 서술 요청·응답 계약.
 * 브라우저와 서버가 함께 import하므로 Node 전용 모듈을 두지 않는다.
 *
 * 개인정보 원칙: 원본 대화 전체가 아니라 통계에서 뽑은 "사실" 문장과 제한된 수의 발췌 메시지만 보낸다.
 */

export const PERSON_SECTION_KEYS = [
  "overview",
  "traits",
  "nicknames",
  "quotes",
  "relationships",
  "trivia",
] as const;

export type PersonSectionKey = (typeof PERSON_SECTION_KEYS)[number];

export const EXCERPT_LIMIT = 300;
export const EXCERPT_TEXT_LIMIT = 160;
const FACTS_LIMIT = 6000;
const NAME_LIMIT = 100;

const key = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
const name = z.string().min(1).max(NAME_LIMIT);
const facts = z.string().max(FACTS_LIMIT);

export const excerptSchema = z.object({
  author: name,
  date: z.string().max(20).nullable(),
  text: z.string().max(EXCERPT_TEXT_LIMIT + 1),
  /** 같은 번호끼리는 원본에서 연속된 대화 장면. null이면 따로 뽑은 한 줄 발췌 */
  scene: z.number().int().min(0).nullable(),
});

export const memberSummarySchema = z.object({
  name,
  summary: z.string().max(1000),
});

export const roomProseRequestSchema = z.object({
  roomTitle: z.string().max(200),
  members: z.array(memberSummarySchema).max(100),
  sections: z
    .array(
      z.object({
        key,
        title: z.string().max(200),
        subs: z
          .array(z.object({ key, title: z.string().max(200), facts }))
          .max(40),
      }),
    )
    .max(40),
  excerpts: z.array(excerptSchema).max(EXCERPT_LIMIT),
});

export const personProseRequestSchema = z.object({
  roomTitle: z.string().max(200),
  members: z.array(memberSummarySchema).max(100),
  people: z
    .array(
      z.object({
        name,
        sections: z
          .array(z.object({ key: z.enum(PERSON_SECTION_KEYS), facts }))
          .max(PERSON_SECTION_KEYS.length),
      }),
    )
    .max(100),
  excerpts: z.array(excerptSchema).max(EXCERPT_LIMIT),
});

export const wikiProseRequestSchema = z.object({
  room: roomProseRequestSchema,
  person: personProseRequestSchema,
});

const paragraphs = z.array(z.string().max(2000)).max(4);

export const roomProseResultSchema = z.object({
  sections: z.array(
    z.object({
      key: z.string(),
      subs: z.array(z.object({ key: z.string(), paragraphs })),
    }),
  ),
});

export const personProseResultSchema = z.object({
  people: z.array(
    z.object({
      name: z.string(),
      sections: z.array(z.object({ key: z.string(), paragraphs })),
    }),
  ),
});

export type Excerpt = z.infer<typeof excerptSchema>;
export type RoomProseRequest = z.infer<typeof roomProseRequestSchema>;
export type PersonProseRequest = z.infer<typeof personProseRequestSchema>;
export type WikiProseRequest = z.infer<typeof wikiProseRequestSchema>;
export type RoomProseResult = z.infer<typeof roomProseResultSchema>;
export type PersonProseResult = z.infer<typeof personProseResultSchema>;

export type WikiProseResponse = {
  /** 성공한 묶음의 결과만 합친 것. 전부 실패하면 null */
  room: RoomProseResult | null;
  person: PersonProseResult | null;
};
