import type { Insights, TimedMessage } from "@/screens/home/utils/insights.types";
import {
  BoundedCounter,
  addDays,
  daysBetween,
  emojis,
  isMeaningfulPhrase,
  tokenize,
} from "@/screens/home/utils/chatMetrics";
import { inc, rank } from "@/screens/home/utils/collections";
import { Steps, YIELD_MASK } from "@/screens/home/utils/slicing";

/**
 * 상징·유행어 섹션의 통계. 프롬프트(prompts/room/slang.md)의 "0. 후보 추출" 기준을 코드로 계산한다.
 * 후보가 방 고유 유행어인지, 외부 밈인지, 개인 말버릇인지, 평범한 말인지는 AI가 실제 쓰임을 읽고 나눈다.
 *
 * 후보: 짧은 한 문장 메시지 전체(24자 이하)와 2~6글자 낱말. 총 10회 이상, 서로 다른 날짜 5일 이상.
 * 어절 2~3개 조합은 메시지 전체가 그 조합인 경우만 잡힌다(메시지 중간의 조합까지 세면 메모리가 크게 는다).
 */

const MIN_COUNT = 10;
const MIN_DAYS = 5;
const PHRASE_MAX_CHARS = 24;
const TOKEN_MIN_CHARS = 2;
const TOKEN_MAX_CHARS = 6;
/** 상세 집계(사용자·날짜·월별)를 하는 후보 수. 많을수록 느려진다. */
const DETAIL_CANDIDATES = 150;
/** 문서·AI에 넘기는 후보 수 */
export const SLANG_CANDIDATE_LIMIT = 40;
/** 멤버별 말버릇: 그 멤버가 이 횟수 이상 쓴 표현만 배율을 계산한다. */
const HABIT_MIN_USES = 5;
const HABITS_PER_MEMBER = 5;
/** 한때 유행: 최근 30일 사용량이 정점 월의 이 비율 이하 */
const FADED_RATIO = 0.3;
/** 사라진 유행어: 마지막 사용일이 기록 마지막 날보다 이 일수 이상 앞섬 */
const VANISHED_DAYS = 90;
const RECENT_DAYS = 30;
const EMOJI_LIMIT = 7;
const ADDRESS_LIMIT = 15;
const ADDRESS_MIN_COUNT = 3;
/** 리액션 이모티콘: 다른 사람 말 뒤 이 시간 안 */
const REACTION_MS = 60_000;
/** "진짜 웃겼다" 기준: 웃음 길이의 이 백분위 이상(최소 SIDE_SPLIT_MIN개) */
const SIDE_SPLIT_PERCENTILE = 0.95;
const SIDE_SPLIT_MIN = 10;

const COMMAND = /^[/!][^\s/!]/;
const JAMO_ONLY = /^[ㄱ-ㅎㅏ-ㅣ\s.!?~]+$/;
const LAUGH_OR_CRY_ONLY = /^[ㅋㅎㅠㅜ\s.!?~]+$/;
/**
 * 프롬프트의 범용 표현. 감탄사·추임새, 범용 강조·비속어, 대명사·조사 조합.
 * 비교는 공백·문장부호와 끝의 ㅋㅎㅠㅜ를 지운 형태로 한다.
 */
const GENERIC = new Set(
  (
    "아 오 와 헐 웅 응 ㅇㅇ ㄴㄴ 엥 헉 오키 넵 " +
    "진짜 존나 개 완전 미친 대박 레전드 " +
    "내가 너가 나는 그렇게 같아 사람 생각하는 남은 각자 " +
    "진짜로 개웃겨 너무 그냥 근데 아니 그래 그럼 이제 지금 오늘 내일 어제 " +
    "우리 나도 저도 이거 그거 저거 여기 거기 뭐야 왜 어디 언제 누구 " +
    "있어 없어 했어 하는 해서 그래서 그런 이런 저런 같은데 같이 많이 "
  )
    .split(" ")
    .filter(Boolean),
);
const KEY_TRIM = /[\s\p{P}\p{S}]/gu;
const TRAILING_REACTION = /[ㅋㅎㅠㅜ]+$/;

function normalizeKey(text: string) {
  return text.replace(KEY_TRIM, "").replace(TRAILING_REACTION, "");
}

function isCandidateText(text: string) {
  const key = normalizeKey(text);
  if (!key || GENERIC.has(key)) return false;
  if (JAMO_ONLY.test(text) || LAUGH_OR_CRY_ONLY.test(text)) return false;
  return isMeaningfulPhrase(text);
}

export interface SlangCandidate {
  text: string;
  /** phrase: 메시지 전체가 이 표현. token: 메시지 안의 낱말 */
  kind: "phrase" | "token";
  count: number;
  days: number;
  users: { name: string; value: number }[];
  /** 사람별 첫 사용(시간순) */
  spread: { name: string; first: TimedMessage }[];
  first: TimedMessage;
  last: TimedMessage;
  /** "YYYY-MM" → 사용 횟수 */
  months: Map<string, number>;
  peakMonth: string | null;
  peakCount: number;
  recentCount: number;
}

export interface Habit {
  text: string;
  uses: number;
  /** 다른 멤버 대비 배율. 다른 멤버가 한 번도 안 썼으면 null */
  ratio: number | null;
  example: TimedMessage;
}

export interface MemberHabits {
  name: string;
  habits: Habit[];
  /** 말투 단서: 메시지 중 해당 표현이 든 비율(%) */
  style: {
    tilde: number;
    period: number;
    exclaim: number;
    cry: number;
    noSpaceLong: number;
  };
}

export interface LaughProfile {
  name: string;
  /** ㅋ 연속 길이 분포: 2개, 3~5개, 6~10개, 11개 이상 */
  runs: [number, number, number, number];
  kRuns: number;
  hRuns: number;
  /** 웃음 바로 뒤에 붙는 말 */
  tails: { word: string; count: number }[];
  typo: number;
  cryMix: number;
  initials: { word: string; count: number }[];
  laughMessages: number;
  messages: number;
}

export interface AddressTerm {
  term: string;
  count: number;
  callers: { name: string; value: number }[];
}

export interface EmojiUse {
  emoji: string;
  count: number;
  users: { name: string; value: number }[];
}

export interface EmoticonHabit {
  name: string;
  count: number;
  /** 다른 사람 말 뒤 1분 안에 보낸 비율(%) */
  afterOthers: number;
  /** 바로 앞 메시지에 웃음이 있던 비율(%) */
  afterLaugh: number;
  /** 연속으로 보낸 비율(%) */
  chained: number;
}

export interface SlangInsights {
  candidates: SlangCandidate[];
  habits: MemberHabits[];
  laughs: LaughProfile[];
  /** "진짜 웃겼다" 기준 ㅋ 개수와 그 이상 웃은 메시지 수 */
  sideSplit: { threshold: number; messages: number } | null;
  address: AddressTerm[];
  emoji: EmojiUse[];
  emoticons: EmoticonHabit[];
  fadedKeys: Set<string>;
  vanishedKeys: Set<string>;
}

/** "2024-03" → "2024년 3월" */
export function monthLabel(month: string) {
  const [y, mo] = month.split("-").map(Number);
  return `${y}년 ${mo}월`;
}

const INITIALS = [
  "ㄹㅇ",
  "ㅅㅂ",
  "ㄹㅈㄷ",
  "ㅇㅈ",
  "ㅈㄴ",
  "ㄱㄱ",
  "ㅇㅋ",
  "ㄴㄴ",
  "ㅇㅇ",
  "ㅎㅇ",
  "ㅂㅂ",
  "ㄱㅅ",
  "ㅈㅅ",
  "ㅊㅋ",
  "ㅁㅊ",
  "ㄷㄷ",
  "ㅎㄷㄷ",
  "ㅠㅠ",
];
const INITIAL_RE = new RegExp(
  `(?<![ㄱ-ㅎ])(${[...INITIALS].sort((a, b) => b.length - a.length).join("|")})(?![ㄱ-ㅎ])`,
  "g",
);
const K_RUN = /ㅋ{2,}/g;
const H_RUN = /ㅎ{2,}/g;
const LAUGH_TAIL = /ㅋ{2,}\s?([가-힣]{2,4})/g;
const TYPO_LAUGH = /ㅋ+[ㅌㄱㅎㅍ]ㅋ+/;
const CRY_MIX = /ㅋ{2,}[ㅠㅜ큐]+|큐ㅠ|ㅠㅋㅋ/;
const ADDRESS_PATTERNS = [
  /@([^\s@]{1,10})/g,
  /(?:^|\s)야\s([가-힣A-Za-z]{1,6})(?=[\s!?~.ㅋㅎ]|$)/g,
  /([가-힣A-Za-z]{2,6})님(?![가-힣])/g,
];
/** "OO아", "OO야" 부르는 말. 짧은 메시지 끝에 올 때만 본다. */
const VOCATIVE = /(?:^|\s)([가-힣]{1,3}(?:아|야))[\s!?~.ㅋㅎ]*$/;
const VOCATIVE_MAX_CHARS = 12;
const VOCATIVE_COMMON = new Set([
  "좋아",
  "싫어야",
  "그래야",
  "해야",
  "가야",
  "와야",
  "봐야",
  "있어야",
  "아니야",
  "뭐야",
  "누구야",
  "어디야",
  "언제야",
  "왜야",
  "나야",
  "너야",
  "저기야",
  "그거야",
  "이거야",
  "진짜야",
  "정말이야",
  "맞아",
  "몰라아",
  "아야",
]);

function monthOf(key: string | null) {
  return key ? key.slice(0, 7) : null;
}

function pctOf(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 1000) / 10 : 0;
}

/** 공백·조사 없이 낱말 단위로 메시지 안의 후보 낱말 횟수를 센다. */
function tokenCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokenize(text))
    if (token.length >= TOKEN_MIN_CHARS && token.length <= TOKEN_MAX_CHARS)
      inc(counts, token);
  return counts;
}

function isHumanText(m: TimedMessage) {
  return m.kind === "text" && !COMMAND.test(m.text.trim());
}

type Detail = {
  text: string;
  kind: SlangCandidate["kind"];
  count: number;
  days: number;
  lastDay: string | null;
  users: Map<string, number>;
  spread: Map<string, TimedMessage>;
  first: TimedMessage | null;
  last: TimedMessage | null;
  months: Map<string, number>;
  recent: number;
};

/**
 * 구성원 이름에서 대화에 나올 만한 부분. 기호를 뗀 이름과, 세 글자 한글 이름은 성을 뗀 두 글자.
 */
function memberAliases(memberNames: string[]): string[] {
  const aliases = new Set<string>();
  for (const name of memberNames) {
    const plain = name.replace(/[^\p{L}\p{N}]/gu, "");
    if (plain.length >= 2) aliases.add(plain);
    if (/^[가-힣]{3}$/.test(plain)) aliases.add(plain.slice(1));
  }
  return [...aliases];
}

export function* computeSlangSteps(ins: Insights): Steps<SlangInsights> {
  const { timed } = ins;
  const total = timed.length;
  const recentFrom = ins.endKey ? addDays(ins.endKey, -(RECENT_DAYS - 1)) : null;

  // ── 1단계: 후보 세기 ──
  const phraseCounter = new BoundedCounter(100_000);
  const tokenCounter = new BoundedCounter(150_000);
  for (let i = 0; i < total; i++) {
    const m = timed[i];
    if (isHumanText(m)) {
      const t = m.text.trim();
      if (t.length <= PHRASE_MAX_CHARS && !t.includes("\n"))
        phraseCounter.add(t);
      tokenCounts(t).forEach((count, token) => tokenCounter.add(token, count));
    }
    if ((i & YIELD_MASK) === 0) yield (i / Math.max(total, 1)) * 0.3;
  }

  const details = new Map<string, Detail>();
  const names = memberAliases(ins.members.map((m) => m.name));
  const addDetail = (text: string, kind: Detail["kind"]) => {
    if (details.has(text) || !isCandidateText(text)) return;
    // 사람 이름·호칭은 유행어도 말버릇도 아니다. 호칭은 별명과 호칭에서 따로 다룬다.
    if (names.some((alias) => text.includes(alias))) return;
    details.set(text, {
      text,
      kind,
      count: 0,
      days: 0,
      lastDay: null,
      users: new Map(),
      spread: new Map(),
      first: null,
      last: null,
      months: new Map(),
      recent: 0,
    });
  };
  // 같은 말이 낱말과 메시지 전체 양쪽에 있으면 낱말로 센다(더 넓게 잡힌다).
  tokenCounter
    .top(DETAIL_CANDIDATES)
    .filter((c) => c.count >= MIN_COUNT)
    .forEach((c) => addDetail(c.key, "token"));
  phraseCounter
    .top(DETAIL_CANDIDATES)
    .filter((c) => c.count >= MIN_COUNT && !tokenCounter.get(c.key))
    .forEach((c) => addDetail(c.key, "phrase"));

  // ── 2단계: 후보별 상세(사람·날짜·월별) + 웃음·이모지·호칭·말투 ──
  const record = (d: Detail, m: TimedMessage, by: number) => {
    d.count += by;
    if (m.dateKey && m.dateKey !== d.lastDay) {
      d.days += 1;
      d.lastDay = m.dateKey;
    }
    inc(d.users, m.author, by);
    if (!d.spread.has(m.author)) d.spread.set(m.author, m);
    d.first ??= m;
    d.last = m;
    const month = monthOf(m.dateKey);
    if (month) inc(d.months, month, by);
    if (recentFrom && m.dateKey && m.dateKey >= recentFrom) d.recent += by;
  };

  type LaughAcc = Omit<LaughProfile, "tails" | "initials"> & {
    tails: Map<string, number>;
    initials: Map<string, number>;
  };
  const laughs = new Map<string, LaughAcc>();
  const laughOf = (name: string) => {
    let acc = laughs.get(name);
    if (!acc) {
      acc = {
        name,
        runs: [0, 0, 0, 0],
        kRuns: 0,
        hRuns: 0,
        tails: new Map(),
        typo: 0,
        cryMix: 0,
        initials: new Map(),
        laughMessages: 0,
        messages: 0,
      };
      laughs.set(name, acc);
    }
    return acc;
  };
  const allRuns: number[] = [];

  type StyleAcc = { msgs: number; tilde: number; period: number; exclaim: number; cry: number; noSpaceLong: number };
  const styles = new Map<string, StyleAcc>();

  const emojiCount = new Map<string, number>();
  const emojiUsers = new Map<string, Map<string, number>>();
  const emoticon = new Map<
    string,
    { count: number; afterOthers: number; afterLaugh: number; chained: number }
  >();
  const address = new Map<string, Map<string, number>>();
  const addAddress = (term: string, caller: string) => {
    const callers = address.get(term) ?? new Map<string, number>();
    inc(callers, caller);
    address.set(term, callers);
  };

  for (let i = 0; i < total; i++) {
    const m = timed[i];
    const prev = i > 0 ? timed[i - 1] : null;

    if (m.kind === "emoticon") {
      const e = emoticon.get(m.author) ?? {
        count: 0,
        afterOthers: 0,
        afterLaugh: 0,
        chained: 0,
      };
      e.count += 1;
      if (prev) {
        if (
          prev.author !== m.author &&
          prev.ts !== null &&
          m.ts !== null &&
          m.ts - prev.ts <= REACTION_MS
        )
          e.afterOthers += 1;
        if (/[ㅋㅎ]{2,}/.test(prev.text)) e.afterLaugh += 1;
        if (prev.author === m.author && prev.kind === "emoticon")
          e.chained += 1;
      }
      emoticon.set(m.author, e);
    }

    if (isHumanText(m)) {
      const t = m.text.trim();
      const phrase = details.get(t);
      if (phrase?.kind === "phrase") record(phrase, m, 1);
      tokenCounts(t).forEach((count, token) => {
        const d = details.get(token);
        if (d?.kind === "token") record(d, m, count);
      });

      const acc = laughOf(m.author);
      acc.messages += 1;
      const kRuns = t.match(K_RUN) ?? [];
      if (kRuns.length) acc.laughMessages += 1;
      for (const run of kRuns) {
        const len = run.length;
        acc.kRuns += 1;
        allRuns.push(len);
        acc.runs[len === 2 ? 0 : len <= 5 ? 1 : len <= 10 ? 2 : 3] += 1;
      }
      acc.hRuns += (t.match(H_RUN) ?? []).length;
      for (const tail of t.matchAll(LAUGH_TAIL)) inc(acc.tails, tail[1]);
      if (TYPO_LAUGH.test(t)) acc.typo += 1;
      if (CRY_MIX.test(t)) acc.cryMix += 1;
      for (const initial of t.matchAll(INITIAL_RE))
        inc(acc.initials, initial[1]);

      const style = styles.get(m.author) ?? {
        msgs: 0,
        tilde: 0,
        period: 0,
        exclaim: 0,
        cry: 0,
        noSpaceLong: 0,
      };
      style.msgs += 1;
      if (/~/.test(t)) style.tilde += 1;
      if (/[가-힣]\.$/.test(t)) style.period += 1;
      if (/!/.test(t)) style.exclaim += 1;
      if (/[ㅠㅜ]/.test(t)) style.cry += 1;
      if (t.length >= 15 && !/\s/.test(t)) style.noSpaceLong += 1;
      styles.set(m.author, style);

      for (const pattern of ADDRESS_PATTERNS)
        for (const match of t.matchAll(pattern)) addAddress(match[0].trim(), m.author);
      if (t.length <= VOCATIVE_MAX_CHARS) {
        const vocative = VOCATIVE.exec(t)?.[1];
        if (vocative && !VOCATIVE_COMMON.has(vocative))
          addAddress(vocative, m.author);
      }
    }

    for (const e of emojis(m.text)) {
      inc(emojiCount, e);
      const users = emojiUsers.get(e) ?? new Map<string, number>();
      inc(users, m.author);
      emojiUsers.set(e, users);
    }

    if ((i & YIELD_MASK) === 0) yield 0.3 + (i / Math.max(total, 1)) * 0.6;
  }

  // ── 3단계: 정리 ──
  const candidates: SlangCandidate[] = [...details.values()]
    .filter((d) => d.count >= MIN_COUNT && d.days >= MIN_DAYS && d.first && d.last)
    .map((d) => {
      let peakMonth: string | null = null;
      let peakCount = 0;
      d.months.forEach((count, month) => {
        if (count > peakCount) {
          peakCount = count;
          peakMonth = month;
        }
      });
      return {
        text: d.text,
        kind: d.kind,
        count: d.count,
        days: d.days,
        users: rank(d.users),
        spread: [...d.spread.entries()]
          .map(([name, first]) => ({ name, first }))
          .sort((a, b) => a.first.idx - b.first.idx),
        first: d.first as TimedMessage,
        last: d.last as TimedMessage,
        months: d.months,
        peakMonth,
        peakCount,
        recentCount: d.recent,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, SLANG_CANDIDATE_LIMIT);

  const habits: MemberHabits[] = ins.members.map(({ name, value: mine }) => {
    const others = total - mine;
    const list: Habit[] = candidates.flatMap((c) => {
      const uses = c.users.find((u) => u.name === name)?.value ?? 0;
      if (uses < HABIT_MIN_USES || !mine) return [];
      const otherUses = c.count - uses;
      const ratio =
        otherUses > 0 && others > 0 ? uses / mine / (otherUses / others) : null;
      const example = c.spread.find((s) => s.name === name)?.first ?? c.first;
      return [{ text: c.text, uses, ratio, example }];
    });
    list.sort(
      (a, b) => (b.ratio ?? Infinity) - (a.ratio ?? Infinity) || b.uses - a.uses,
    );
    const style = styles.get(name);
    const rate = (k: keyof Omit<StyleAcc, "msgs">) =>
      style ? pctOf(style[k], style.msgs) : 0;
    return {
      name,
      habits: list.filter((h) => h.ratio === null || h.ratio > 1).slice(0, HABITS_PER_MEMBER),
      style: {
        tilde: rate("tilde"),
        period: rate("period"),
        exclaim: rate("exclaim"),
        cry: rate("cry"),
        noSpaceLong: rate("noSpaceLong"),
      },
    };
  });

  const laughProfiles: LaughProfile[] = ins.members
    .map((m) => laughs.get(m.name))
    .filter((acc): acc is LaughAcc => Boolean(acc))
    .map((acc) => ({
      ...acc,
      tails: rank(acc.tails)
        .slice(0, 2)
        .map((r) => ({ word: r.name, count: r.value })),
      initials: rank(acc.initials)
        .slice(0, 3)
        .map((r) => ({ word: r.name, count: r.value })),
    }));

  let sideSplit: SlangInsights["sideSplit"] = null;
  if (allRuns.length >= 20) {
    const sorted = [...allRuns].sort((a, b) => a - b);
    const threshold = Math.max(
      SIDE_SPLIT_MIN,
      sorted[Math.floor(sorted.length * SIDE_SPLIT_PERCENTILE)],
    );
    sideSplit = {
      threshold,
      messages: allRuns.filter((len) => len >= threshold).length,
    };
  }

  const addressTerms: AddressTerm[] = [...address.entries()]
    .map(([term, callers]) => ({
      term,
      count: [...callers.values()].reduce((s, v) => s + v, 0),
      callers: rank(callers),
    }))
    // 자기 이름을 부른 것만 있는 말(서명 등)은 호칭이 아니다.
    .filter(
      (a) =>
        a.count >= ADDRESS_MIN_COUNT &&
        !(a.callers.length === 1 && a.term.includes(a.callers[0].name)),
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, ADDRESS_LIMIT);

  const emoji: EmojiUse[] = rank(emojiCount)
    .slice(0, EMOJI_LIMIT)
    .map((r) => ({
      emoji: r.name,
      count: r.value,
      users: rank(emojiUsers.get(r.name) ?? new Map()),
    }));

  const emoticons: EmoticonHabit[] = ins.members
    .filter((m) => emoticon.has(m.name))
    .map((m) => {
      const e = emoticon.get(m.name)!;
      return {
        name: m.name,
        count: e.count,
        afterOthers: pctOf(e.afterOthers, e.count),
        afterLaugh: pctOf(e.afterLaugh, e.count),
        chained: pctOf(e.chained, e.count),
      };
    })
    .sort((a, b) => b.count - a.count);

  const fadedKeys = new Set(
    candidates
      .filter(
        (c) =>
          c.users.length >= 2 &&
          c.recentCount > 0 &&
          c.peakCount >= MIN_COUNT &&
          c.recentCount <= c.peakCount * FADED_RATIO &&
          monthOf(ins.endKey) !== c.peakMonth,
      )
      .map((c) => c.text),
  );
  const vanishedKeys = new Set(
    ins.endKey && ins.spanDays > VANISHED_DAYS
      ? candidates
          .filter(
            (c) =>
              c.last.dateKey &&
              daysBetween(c.last.dateKey, ins.endKey as string) >= VANISHED_DAYS,
          )
          .map((c) => c.text)
      : [],
  );

  yield 1;
  return {
    candidates,
    habits,
    laughs: laughProfiles,
    sideSplit,
    address: addressTerms,
    emoji,
    emoticons,
    fadedKeys,
    vanishedKeys,
  };
}
