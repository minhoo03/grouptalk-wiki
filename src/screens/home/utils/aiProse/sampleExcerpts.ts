import {
  EXCERPT_LIMIT,
  EXCERPT_TEXT_LIMIT,
  type Excerpt,
} from "@/services/wikiWriter/wikiWriter.schema";
import type { ChatMessage } from "@/types/chat";
import {
  CORRECTION_CUE,
  MISUNDERSTAND_CUE,
  RUMOR_CUE,
  classify,
  daysBetween,
  hasLink,
  roomReference,
  type MsgKind,
} from "@/screens/home/utils/chatMetrics";

/**
 * LLM에 보낼 대화 자료를 고른다. 원본 대화를 통째로 보내지 않기 위한 상한(EXCERPT_LIMIT)이 있다.
 *
 * 0) 첫 기록·마지막 기록: 역사 섹션이 원문 그대로 인용하는 대화 파일의 처음과 끝 장면.
 *    사건 후보: 해명·소문·정정 표현이나 긴 침묵 뒤 첫 대화의 앞뒤. 한 줄만으로는 무슨 일인지 알 수 없어
 *    에피소드·논란 섹션이 흐름을 따라갈 수 있게 장면으로 보낸다.
 * 1) 장면: 원본에서 연속된 메시지 묶음. 대화 장면 인용("> 이름: 메시지")이 앞뒤 맥락을 갖도록 한다.
 *    방의 흐름을 읽을 수 있게 기록 기간을 여러 시기로 나누고, 시기마다 가장 붐빈 날의 대화를 고른다.
 *    남는 자리는 전체 기간에 고르게 흩어진 지점으로 채운다.
 * 2) 방 이름 발췌: 방 이름이나 "우리 방"처럼 방을 가리키는 표현이 나온 메시지. 명칭 섹션의 근거다.
 * 3) 관행 단서 발췌: 사과·지적·생일·정산·도착 인증·인사처럼 반복되는 관행의 단서가 될 만한 메시지.
 * 4) 한 줄 발췌: 장면에 잘 안 나온 구성원도 인물 문서 자료가 있도록 구성원별로 고르게 고른다.
 *
 * 개인정보(전화번호, 계좌번호, 이메일, 주민번호)와 링크는 브라우저를 떠나기 전에 가린다.
 */

/** 첫 기록: 첫 메시지부터 이 시간 이상 대화가 끊기기 전까지가 첫 티키타카다. */
const OPENING_GAP_MINUTES = 30;
/** 첫 티키타카가 이보다 길면 앞뒤 OPENING_PART_LINES줄씩만 보내고, 가운데는 "(중략)"으로 쓴다. */
const OPENING_MAX_LINES = 30;
const OPENING_PART_LINES = 15;
const CLOSING_LINES = 5;
const EVENT_SCENES = 10;
const EVENT_BEFORE = 6;
const EVENT_AFTER = 9;
/** 이 일수 이상 대화가 끊겼다가 다시 시작된 대화를 사건 후보로 본다. */
const EVENT_SILENCE_DAYS = 7;
const EVENT_CUE = new RegExp(
  [MISUNDERSTAND_CUE, RUMOR_CUE, CORRECTION_CUE].map((r) => r.source).join("|"),
);
const SCENE_COUNT = 24;
const NAMING_LINES = 20;
const CUSTOM_LINES = 24;
/** 관행·규칙의 단서가 될 만한 표현. 후보일 뿐이고, 실제 관행인지는 AI가 날짜와 반응을 보고 판단한다. */
const CUSTOM_CUE =
  /읽씹|안\s?읽|미안|ㅈㅅ|죄송|선\s?넘|생일|생축|정산|입금|송금|n빵|엔빵|도착|출발|출근|퇴근|잘\s?자|굿밤|좋은\s?아침|ㄱㅁ|고마워/;
const SCENE_BEFORE = 3;
const SCENE_AFTER = 5;
/** 역사 문단의 최대 시기 수(sectionsIntro의 MAX_ERAS)와 맞춘다. */
const SCENE_PERIODS = 6;
const BUSY_DAYS_PER_PERIOD = 2;
/** 장면을 뽑고 남은 자리를 구성원별 한 줄 발췌에 쓰되, 1인당 최소 몫을 둔다. */
const MIN_PER_AUTHOR = 5;
/** "ㅋㅋㅋ", "ㅇㅇ"처럼 자음·웃음만 있는 메시지는 한 줄 발췌로 쓸모가 적다. */
const MIN_MEANINGFUL_CHARS = 4;
const JAMO_ONLY = /[ㄱ-ㅎㅏ-ㅣ\s.!?~]/g;

const MEDIA_LABEL: Record<Exclude<MsgKind, "text">, string> = {
  photo: "(사진)",
  video: "(동영상)",
  emoticon: "(이모티콘)",
  deleted: "(삭제된 메시지)",
  file: "(파일)",
};

const PRIVATE_PATTERNS = [
  /[\w.+-]+@[\w-]+(\.[\w-]+)+/g, // 이메일
  /\d{6}\s?-\s?[1-4]\d{6}/g, // 주민등록번호
  /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g, // 휴대전화
  /0\d{1,2}-\d{3,4}-\d{4}/g, // 지역번호 전화
  /\d{2,6}-\d{2,6}-\d{2,8}(-\d{1,4})?/g, // 계좌번호 형태
  /\d{10,16}/g, // 하이픈 없는 긴 숫자(계좌·카드)
];
const URL_PATTERN = /https?:\/\/\S+/g;

export function maskPrivate(text: string) {
  return PRIVATE_PATTERNS.reduce(
    (masked, pattern) => masked.replace(pattern, "***"),
    text.replace(URL_PATTERN, "(링크)"),
  );
}

function toExcerptText(message: ChatMessage) {
  const kind = classify(message.text);
  if (kind !== "text") return MEDIA_LABEL[kind];
  const masked = maskPrivate(message.text.trim());
  return masked.length > EXCERPT_TEXT_LIMIT
    ? `${masked.slice(0, EXCERPT_TEXT_LIMIT)}…`
    : masked;
}

function isGoodSingleLine(message: ChatMessage) {
  const text = message.text.trim();
  return (
    classify(text) === "text" &&
    !hasLink(text) &&
    text.length <= EXCERPT_TEXT_LIMIT &&
    text.replace(JAMO_ONLY, "").length >= MIN_MEANINGFUL_CHARS
  );
}

/** 목록 전체에서 고르게 count개를 뽑는다. */
function pickEvenly<T>(items: T[], count: number): T[] {
  if (count <= 0) return [];
  if (items.length <= count) return items;
  const step = items.length / count;
  return Array.from({ length: count }, (_, i) => items[Math.floor(i * step)]);
}

/**
 * 활동한 날을 시간순으로 SCENE_PERIODS개 시기로 나누고, 시기마다 메시지가 가장 많은 날의 가운데 메시지 index.
 * 시기마다 장면이 있어야 역사 서술이 "그때 무슨 이야기를 했는지"를 쓸 수 있다.
 */
function busyDayAnchorsByPeriod(messages: ChatMessage[]): number[] {
  const byDay = new Map<string, number[]>();
  messages.forEach((message, index) => {
    if (!message.dateKey) return;
    const list = byDay.get(message.dateKey) ?? [];
    list.push(index);
    byDay.set(message.dateKey, list);
  });
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const size = Math.ceil(days.length / SCENE_PERIODS);
  const anchors: number[] = [];
  for (let start = 0; start < days.length; start += size) {
    days
      .slice(start, start + size)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, BUSY_DAYS_PER_PERIOD)
      .forEach(([, indexes]) =>
        anchors.push(indexes[Math.floor(indexes.length / 2)]),
      );
  }
  return anchors;
}

type SceneRange = { start: number; end: number; tag: Excerpt["tag"] };

const overlaps = (ranges: SceneRange[], start: number, end: number) =>
  ranges.some((r) => start < r.end && r.start < end);

/** 날짜·시각을 알 수 없으면 null */
function minuteOf(message: ChatMessage): number | null {
  if (!message.dateKey || message.hour === null || message.minute === null)
    return null;
  const dayStart = Date.parse(`${message.dateKey}T00:00:00Z`);
  if (Number.isNaN(dayStart)) return null;
  return dayStart / 60_000 + message.hour * 60 + message.minute;
}

/** 첫 메시지부터 OPENING_GAP_MINUTES 이상 끊기기 전까지. 시각을 모르는 메시지는 이어진 것으로 본다. */
function openingRanges(messages: ChatMessage[]): SceneRange[] {
  if (!messages.length) return [];
  let end = 1;
  let previous = minuteOf(messages[0]);
  while (end < messages.length) {
    const current = minuteOf(messages[end]);
    if (
      previous !== null &&
      current !== null &&
      current - previous >= OPENING_GAP_MINUTES
    )
      break;
    if (current !== null) previous = current;
    end += 1;
  }
  if (end <= OPENING_MAX_LINES) return [{ start: 0, end, tag: "opening" }];
  return [
    { start: 0, end: OPENING_PART_LINES, tag: "opening" },
    { start: end - OPENING_PART_LINES, end, tag: "opening" },
  ];
}

function closingRange(
  messages: ChatMessage[],
  reserved: SceneRange[],
): SceneRange[] {
  const start = Math.max(0, messages.length - CLOSING_LINES);
  const end = messages.length;
  return end > start && !overlaps(reserved, start, end)
    ? [{ start, end, tag: "closing" }]
    : [];
}

/** 해명·소문·정정 표현과 긴 침묵 뒤 첫 메시지의 index. 기록 전체에서 고르게 고른다. */
function eventAnchors(messages: ChatMessage[]): number[] {
  const anchors: number[] = [];
  let lastDateKey: string | null = null;
  messages.forEach((message, index) => {
    const isText = classify(message.text) === "text";
    if (isText && EVENT_CUE.test(message.text)) anchors.push(index);
    if (
      message.dateKey &&
      lastDateKey &&
      daysBetween(lastDateKey, message.dateKey) >= EVENT_SILENCE_DAYS
    )
      anchors.push(index);
    if (message.dateKey) lastDateKey = message.dateKey;
  });
  return pickEvenly(anchors, EVENT_SCENES * 2);
}

/** 사건 후보 앞뒤 장면. 겹치는 후보는 하나로 본다. */
function eventRanges(
  messages: ChatMessage[],
  reserved: SceneRange[],
): SceneRange[] {
  const ranges: SceneRange[] = [];
  for (const anchor of eventAnchors(messages)) {
    if (ranges.length >= EVENT_SCENES) break;
    const start = Math.max(0, anchor - EVENT_BEFORE);
    const end = Math.min(messages.length, anchor + EVENT_AFTER + 1);
    if (!overlaps(ranges, start, end) && !overlaps(reserved, start, end))
      ranges.push({ start, end, tag: "event" });
  }
  return ranges;
}

function pickSceneRanges(messages: ChatMessage[]): SceneRange[] {
  const opening = openingRanges(messages);
  const edges = [...opening, ...closingRange(messages, opening)];
  const reserved = [...edges, ...eventRanges(messages, edges)];

  const evenAnchors = pickEvenly(
    messages.map((_, index) => index),
    SCENE_COUNT,
  );
  const anchors = [...busyDayAnchorsByPeriod(messages), ...evenAnchors];

  const ranges: SceneRange[] = [];
  for (const anchor of anchors) {
    if (ranges.length >= SCENE_COUNT) break;
    const start = Math.max(0, anchor - SCENE_BEFORE);
    const end = Math.min(messages.length, anchor + SCENE_AFTER);
    if (!overlaps(ranges, start, end) && !overlaps(reserved, start, end))
      ranges.push({ start, end, tag: null });
  }
  return [...reserved, ...ranges].sort((a, b) => a.start - b.start);
}

/** 방 이름(두 글자 이상)이나 방을 가리키는 표현이 나온 메시지. 기록 전체에서 고르게 고른다. */
function namingIndexes(
  messages: ChatMessage[],
  roomTitle: string,
  used: Set<number>,
): number[] {
  const indexes = messages.flatMap((message, index) => {
    if (used.has(index) || classify(message.text) !== "text") return [];
    const mentionsTitle =
      roomTitle.length >= 2 && message.text.includes(roomTitle);
    return mentionsTitle || roomReference(message.text) ? [index] : [];
  });
  return pickEvenly(indexes, NAMING_LINES);
}

/** 관행 단서 표현이 나온 메시지. 기록 전체에서 고르게 고른다. */
function customIndexes(messages: ChatMessage[], used: Set<number>): number[] {
  const indexes = messages.flatMap((message, index) =>
    !used.has(index) &&
    classify(message.text) === "text" &&
    CUSTOM_CUE.test(message.text)
      ? [index]
      : [],
  );
  return pickEvenly(indexes, CUSTOM_LINES);
}

export function sampleExcerpts(
  messages: ChatMessage[],
  roomTitle: string,
): Excerpt[] {
  const used = new Set<number>();
  const scenes: Excerpt[] = [];

  pickSceneRanges(messages).forEach(({ start, end, tag }, scene) => {
    for (let index = start; index < end; index += 1) {
      const message = messages[index];
      used.add(index);
      scenes.push({
        author: message.author,
        date: message.dateKey,
        text: toExcerptText(message),
        scene,
        tag,
      });
    }
  });

  const naming: Excerpt[] = namingIndexes(messages, roomTitle, used).map(
    (index) => {
      used.add(index);
      return {
        author: messages[index].author,
        date: messages[index].dateKey,
        text: toExcerptText(messages[index]),
        scene: null,
        tag: "naming",
      };
    },
  );

  const custom: Excerpt[] = customIndexes(messages, used).map((index) => {
    used.add(index);
    return {
      author: messages[index].author,
      date: messages[index].dateKey,
      text: toExcerptText(messages[index]),
      scene: null,
      tag: "custom",
    };
  });

  const byAuthor = new Map<string, number[]>();
  messages.forEach((message, index) => {
    if (used.has(index) || !isGoodSingleLine(message)) return;
    const list = byAuthor.get(message.author) ?? [];
    list.push(index);
    byAuthor.set(message.author, list);
  });

  const singlesLimit = Math.max(
    0,
    EXCERPT_LIMIT - scenes.length - naming.length - custom.length,
  );
  const perAuthor = Math.max(
    MIN_PER_AUTHOR,
    Math.floor(singlesLimit / Math.max(byAuthor.size, 1)),
  );
  const singles = [...byAuthor.values()]
    .flatMap((indexes) => pickEvenly(indexes, perAuthor))
    .sort((a, b) => a - b)
    .slice(0, singlesLimit)
    .map((index) => ({
      author: messages[index].author,
      date: messages[index].dateKey,
      text: toExcerptText(messages[index]),
      scene: null,
    }));

  return [...scenes, ...naming, ...custom, ...singles].slice(
    0,
    EXCERPT_LIMIT,
  );
}
