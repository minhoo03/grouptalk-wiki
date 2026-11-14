import { z } from "zod";

/**
 * 브라우저 → 서버(Route Handler `/api/wiki-prose`) → Gemini로 이어지는 AI 서술 요청·응답 계약.
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

/**
 * AI가 항목(소제목)을 직접 정하는 단톡방 섹션. 규칙 기반 하위 문단은 사실 묶음 하나로 합쳐 보내고,
 * AI가 돌려준 항목으로 섹션의 하위 문단 전체를 바꾼다.
 */
export const ITEM_SECTION_KEYS = ["culture", "episodes", "controversy"] as const;
/** 구성원마다 하위 문단 하나. AI는 제목과 본문을 쓴다. */
export const HALL_OF_FAME_KEY = "hallOfFame";

export function isItemSection(key: string) {
  return (ITEM_SECTION_KEYS as readonly string[]).includes(key);
}

/** 사건 후보·첫 기록·마지막 기록 장면까지 담는다. 줄 수가 늘어도 요청 수는 같다. */
export const EXCERPT_LIMIT = 500;
/**
 * 묶음(Gemini 호출 1회) 나누기. 무료 등급의 실제 제약은 하루 요청 수(모델별 20회)라
 * 응답이 길어지더라도 요청 수를 줄인다. 관련 섹션을 한 요청에서 쓰면 섹션끼리 내용이 덜 겹친다.
 * 단톡방은 아래 섹션 묶음마다 한 번, 인물은 PEOPLE_PER_JOB명씩 한 번 요청한다.
 */
export const ROOM_JOB_GROUPS: readonly (readonly string[])[] = [
  ["overview", "naming", "history"],
  ["members", "culture", "slang", "episodes", "controversy"],
  ["hallOfFame", "trivia"],
];
/** 명예의 전당은 구성원 수만큼 하위 문단이 생기므로 이 인원씩 끊는다. */
export const HALL_OF_FAME_PER_JOB = 20;
/** 서버가 받는 묶음 하나의 하위 문단 상한. 보통의 방은 묶음당 10~20개다. */
export const ROOM_SUBS_MAX_PER_JOB = 30;
export const PEOPLE_PER_JOB = 8;
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
  /**
   * opening·closing: 대화 파일의 첫 티키타카와 마지막 대화 장면.
   * naming: 방 이름이나 방을 가리키는 표현이 나온 한 줄 발췌(명칭 섹션의 근거).
   * custom: 사과·지적·생일·정산·도착 인증처럼 관행·규칙의 단서가 되는 한 줄 발췌(방의 성격과 문화 섹션의 근거).
   * event: 해명·소문·정정·긴 침묵 뒤 대화처럼 앞뒤를 봐야 이해되는 사건 후보 장면(에피소드·논란 섹션의 근거).
   */
  tag: z
    .enum(["opening", "closing", "naming", "custom", "event"])
    .nullable()
    .optional(),
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

/**
 * 어느 모델을 먼저 쓸지. 무료 등급은 모델별 분당 요청 수가 작아서,
 * 묶음을 두 모델에 번갈아 배정해 두 모델의 한도를 함께 쓴다.
 */
const preferredModelSchema = z.enum(["primary", "secondary"]);

/** 브라우저 → Route Handler로 보내는 묶음 하나. 서버도 묶음 크기 상한을 다시 검사한다. */
export const proseJobSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("room"),
    preferredModel: preferredModelSchema,
    request: roomProseRequestSchema.refine(
      (request) =>
        request.sections.reduce((sum, s) => sum + s.subs.length, 0) <=
        ROOM_SUBS_MAX_PER_JOB,
      `하위 문단은 묶음당 ${ROOM_SUBS_MAX_PER_JOB}개 이하여야 합니다.`,
    ),
  }),
  z.object({
    kind: z.literal("person"),
    preferredModel: preferredModelSchema,
    request: personProseRequestSchema.refine(
      (request) => request.people.length <= PEOPLE_PER_JOB,
      `인물은 묶음당 ${PEOPLE_PER_JOB}명 이하여야 합니다.`,
    ),
  }),
]);

/** 역사 시기(본문 + 대표 장면 + 전환 요인)와 첫 기록(장면 + 중략 + 장면 + 해설)이 4개를 넘을 수 있다. */
const paragraphs = z.array(z.string().max(2000)).max(6);

/**
 * 개요 > 기본 정보 표에서 대화 내용을 읽어야 채울 수 있는 칸.
 * 길이는 여기서 막지 않고 서버가 다듬는다. 한 칸이 길다고 응답 전체를 버리지 않기 위해서다.
 */
export const overviewInfoSchema = z.object({
  relationship: z.string(),
  topics: z.array(z.string()),
  mood: z.array(z.string()),
  peakName: z.string(),
});

/** 역사 > 주요 사건 연표의 한 행. 길이·날짜 형식은 서버가 다듬는다. */
export const timelineEventSchema = z.object({
  date: z.string(),
  name: z.string(),
  summary: z.string(),
});

export const roomProseResultSchema = z.object({
  sections: z.array(
    z.object({
      key: z.string(),
      subs: z.array(
        z.object({
          key: z.string(),
          /**
           * 소제목. 역사 시기(eraN)는 시기명, 명예의 전당은 "이름 — 대표 장면",
           * 항목 섹션(ITEM_SECTION_KEYS)은 사건·일화 제목이다.
           */
          title: z.string().optional(),
          /** 항목 섹션: 이 사건이 오간 날짜(YYYY-MM-DD). 다른 문단의 [[#날짜|…]] 링크가 이 항목을 찾는다. */
          dates: z.array(z.string()).optional(),
          /** 항목 섹션: 해명·여파처럼 항목 아래에 붙는 하위 문단 */
          parts: z
            .array(z.object({ title: z.string(), paragraphs }))
            .optional(),
          paragraphs,
        }),
      ),
    }),
  ),
  /** 역사 섹션의 첫 하위 문단이 든 묶음에서만 온다. */
  timeline: z.array(timelineEventSchema).nullable().optional(),
  /** 개요 섹션의 첫 하위 문단이 든 묶음에서만 온다. */
  overviewInfo: overviewInfoSchema.nullable().optional(),
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
export type OverviewInfo = z.infer<typeof overviewInfoSchema>;
export type TimelineEvent = z.infer<typeof timelineEventSchema>;
export type PersonProseResult = z.infer<typeof personProseResultSchema>;

export type PreferredModel = z.infer<typeof preferredModelSchema>;
export type ProseJob = z.infer<typeof proseJobSchema>;

/**
 * 묶음 하나의 결과. AI 서술은 부가 기능이라 실패해도 result를 null로 돌려준다.
 * quotaExhausted면 모든 모델의 일일 한도가 끝났으므로 브라우저는 남은 묶음을 보내지 않는다.
 */
export const proseJobResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("room"),
    result: roomProseResultSchema.nullable(),
    quotaExhausted: z.boolean().optional(),
    /** result가 null인 이유. 배포 환경 진단용으로 브라우저 콘솔에 남긴다. */
    error: z.string().optional(),
  }),
  z.object({
    kind: z.literal("person"),
    result: personProseResultSchema.nullable(),
    quotaExhausted: z.boolean().optional(),
    error: z.string().optional(),
  }),
]);

export type ProseJobResult = z.infer<typeof proseJobResultSchema>;
