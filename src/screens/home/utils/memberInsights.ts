import type { MemberEvent } from "@/types/chat";
import type { Insights, TimedMessage } from "@/screens/home/utils/insights.types";
import { inc } from "@/screens/home/utils/collections";
import { Steps, YIELD_MASK } from "@/screens/home/utils/slicing";
import { monthLabel } from "@/screens/home/utils/slangInsights";

/**
 * 멤버 섹션의 통계. 프롬프트(prompts/room/members.md)의 "0. 공통 계산"을 코드로 계산한다.
 * 봇은 메시지 단계에서 이미 빠졌다. 이름을 바꾼 사람은 합치지 않는다.
 */

/** 대화 시작·마무리: 앞(뒤)으로 이 시간 이상 공백 */
const SESSION_GAP_MS = 2 * 60 * 60_000;
/** 리액션: 다른 사람 말 뒤 이 시간 안의 짧은 메시지 */
const REACTION_MS = 60_000;
const REACTION_MAX_CHARS = 10;
const LONG_CHARS = 50;
/** 친밀도: A의 메시지 직후 이 시간 안에 B가 답하면 B가 A에게 응답한 것으로 센다. */
const REPLY_MS = 5 * 60_000;
/** 친밀도 분석 대상(프롬프트 기준): 두 사람 모두 이 수 이상 발화, 서로 이 수 이상 응답 */
const PAIR_MIN_MESSAGES = 300;
const PAIR_MIN_REPLIES = 50;
/** 위 기준을 넘는 쌍이 없을 때(작은 방) 쓰는 완화 기준. 문서에 완화했다고 밝힌다. */
export const PAIR_MIN_MESSAGES_RELAXED = 30;
const PAIR_MIN_REPLIES_RELAXED = 10;
/** 의외의 조합: 월별 친밀도 급상승 */
const SPIKE_MIN_REPLIES = 10;
const SPIKE_RATIO = 1.5;
/** 의외의 조합: 성향 차이 */
const OPPOSITE_LENGTH_RATIO = 2;
const OPPOSITE_HOUR_GAP = 6;
export const ROLE_THRESHOLD = 1.3;

const QUESTION = /[?？]|어때[\s!~.]*$/;
const SCHEDULE =
  /언제|몇\s?시|어디서|예약|약속|[월화수목금토일]요일|주말|내일|모레|다음\s?주|\d{1,2}\s?월\s?\d{1,2}\s?일|\d{1,2}\/\d{1,2}|\d{1,2}\s?시(?![간작])/;

export const ROLE_LABELS = {
  start: "대화 시작",
  end: "대화 마무리",
  question: "질문",
  reaction: "리액션",
  info: "정보",
  photo: "사진",
  long: "장문",
  schedule: "약속·일정",
} as const;
export type RoleKey = keyof typeof ROLE_LABELS;
const ROLE_KEYS = Object.keys(ROLE_LABELS) as RoleKey[];

export type MemberStatus = "활동" | "휴면" | "퇴장";

export interface MemberCard {
  name: string;
  status: MemberStatus;
  /** 입장 기록이 있으면 그 날짜. 없으면 null(기록 시작 시점부터) */
  joinKey: string | null;
  leaveKey: string | null;
  firstKey: string | null;
  lastKey: string | null;
  count: number;
  share: number;
  avgLength: number;
  /** 같은 사람이 끊기지 않고 이어 보낸 메시지 수 평균 */
  avgRun: number;
  peakHour: number | null;
  /** 23~5시 메시지 비율(%) */
  nightShare: number;
}

export interface RoleScore {
  key: RoleKey;
  label: string;
  count: number;
  /** (멤버의 지표 점유율 ÷ 전체 메시지 점유율) */
  value: number;
  example: TimedMessage | null;
}

export interface PairStat {
  a: string;
  b: string;
  actual: number;
  expected: number;
  index: number;
  rank: number;
}

export interface PairCandidate extends PairStat {
  reason: string;
}

export interface RosterRow {
  dateKey: string | null;
  change: string;
  count: number;
}

export interface Quarter {
  label: string;
  total: number;
  counts: Map<string, number>;
}

export interface MemberInsights {
  cards: MemberCard[];
  rosterStart: number;
  roster: RosterRow[];
  roles: { name: string; scores: RoleScore[] }[];
  /** 분석 대상 쌍(친밀도 높은 순). relaxed면 작은 방이라 기준을 낮췄다. */
  pairs: PairStat[];
  relaxed: boolean;
  /** 모든 쌍(주고받은 적 없는 쌍 포함). 관계도 요약표에 쓴다. */
  allPairs: PairStat[];
  unexpected: PairCandidate[];
  /** names[i]가 응답자, names[j]가 원발화자일 때 counts[i][j] */
  matrix: { names: string[]; counts: number[][] };
  quarters: Quarter[];
}

function lastEventOf(events: MemberEvent[], name: string) {
  for (let i = events.length - 1; i >= 0; i--)
    if (events[i].name === name && events[i].type !== "rename") return events[i];
  return null;
}

function quarterOf(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${y}년 ${Math.ceil(m / 3)}분기`;
}

function hourGap(a: number | null, b: number | null) {
  if (a === null || b === null) return 0;
  const d = Math.abs(a - b);
  return Math.min(d, 24 - d);
}

/** 쌍별 기대값과 친밀도 지수. shares는 메시지 점유율. */
function pairStats(
  replies: Map<string, number>,
  shares: Map<string, number>,
  names: string[],
): PairStat[] {
  let total = 0;
  replies.forEach((v) => (total += v));
  let shareProductSum = 0;
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++)
      shareProductSum += (shares.get(names[i]) ?? 0) * (shares.get(names[j]) ?? 0);
  const stats: PairStat[] = [];
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i];
      const b = names[j];
      const actual =
        (replies.get(`${a}\u0000${b}`) ?? 0) + (replies.get(`${b}\u0000${a}`) ?? 0);
      const expected = shareProductSum
        ? (total * (shares.get(a) ?? 0) * (shares.get(b) ?? 0)) / shareProductSum
        : 0;
      stats.push({
        a,
        b,
        actual,
        expected,
        index: expected > 0 ? actual / expected : 0,
        rank: 0,
      });
    }
  return stats;
}

export function* computeMemberSteps(
  ins: Insights,
  events: MemberEvent[],
  peakHours: Map<string, number | null>,
): Steps<MemberInsights> {
  const { timed } = ins;
  const total = timed.length;
  const counts = new Map(ins.members.map((m) => [m.name, m.value]));
  const names = ins.members.map((m) => m.name);
  const recentFrom = ins.recent?.fromKey ?? null;

  const roleCounts = new Map<string, Map<RoleKey, number>>();
  const roleExamples = new Map<string, Map<RoleKey, TimedMessage>>();
  const roleTotals = new Map<RoleKey, number>();
  const addRole = (m: TimedMessage, key: RoleKey) => {
    const map = roleCounts.get(m.author) ?? new Map<RoleKey, number>();
    inc(map as Map<string, number>, key);
    roleCounts.set(m.author, map);
    inc(roleTotals as Map<string, number>, key);
    const examples = roleExamples.get(m.author) ?? new Map<RoleKey, TimedMessage>();
    const prev = examples.get(key);
    if (!prev || (m.kind === "text" && m.text.length > prev.text.length))
      examples.set(key, m);
    roleExamples.set(m.author, examples);
  };

  const replies = new Map<string, number>();
  const monthReplies = new Map<string, Map<string, number>>();
  const monthCounts = new Map<string, Map<string, number>>();
  const textChars = new Map<string, { chars: number; texts: number }>();
  const runs = new Map<string, number>();
  const nights = new Map<string, number>();
  const firstKey = new Map<string, string>();
  const lastKey = new Map<string, string>();
  const quarterMap = new Map<string, Map<string, number>>();

  for (let i = 0; i < total; i++) {
    const m = timed[i];
    const prev = i > 0 ? timed[i - 1] : null;
    const next = i + 1 < total ? timed[i + 1] : null;
    const isText = m.kind === "text";
    const text = m.text.trim();

    const gapBefore = prev && prev.ts !== null && m.ts !== null ? m.ts - prev.ts : null;
    const gapAfter = next && next.ts !== null && m.ts !== null ? next.ts - m.ts : null;
    if (!prev || (gapBefore !== null && gapBefore >= SESSION_GAP_MS)) addRole(m, "start");
    if (!next || (gapAfter !== null && gapAfter >= SESSION_GAP_MS)) addRole(m, "end");
    if (isText && QUESTION.test(text)) addRole(m, "question");
    if (
      isText &&
      prev &&
      prev.author !== m.author &&
      gapBefore !== null &&
      gapBefore <= REACTION_MS &&
      text.length <= REACTION_MAX_CHARS
    )
      addRole(m, "reaction");
    if (m.link) addRole(m, "info");
    if (m.kind === "photo" || m.kind === "video") addRole(m, "photo");
    if (isText && m.text.length >= LONG_CHARS) addRole(m, "long");
    if (isText && SCHEDULE.test(text)) addRole(m, "schedule");

    if (prev && prev.author !== m.author && gapBefore !== null && gapBefore <= REPLY_MS) {
      const key = `${m.author}\u0000${prev.author}`;
      inc(replies, key);
      const month = m.dateKey?.slice(0, 7);
      if (month) {
        const map = monthReplies.get(month) ?? new Map<string, number>();
        inc(map, key);
        monthReplies.set(month, map);
      }
    }

    if (isText) {
      const acc = textChars.get(m.author) ?? { chars: 0, texts: 0 };
      acc.chars += m.text.length;
      acc.texts += 1;
      textChars.set(m.author, acc);
    }
    if (!prev || prev.author !== m.author) inc(runs, m.author);
    if (m.hour !== null && (m.hour >= 23 || m.hour < 5)) inc(nights, m.author);
    if (m.dateKey) {
      if (!firstKey.has(m.author)) firstKey.set(m.author, m.dateKey);
      lastKey.set(m.author, m.dateKey);
      const month = m.dateKey.slice(0, 7);
      const mc = monthCounts.get(month) ?? new Map<string, number>();
      inc(mc, m.author);
      monthCounts.set(month, mc);
      const quarter = quarterOf(m.dateKey);
      const qc = quarterMap.get(quarter) ?? new Map<string, number>();
      inc(qc, m.author);
      quarterMap.set(quarter, qc);
    }
    if ((i & YIELD_MASK) === 0) yield (i / Math.max(total, 1)) * 0.9;
  }

  // ── 멤버 카드(상태·합류) ──
  const eventNames = events
    .filter((e) => e.type !== "rename")
    .map((e) => e.name);
  const everyone = [...names, ...eventNames.filter((n) => !counts.has(n))].filter(
    (n, i, arr) => arr.indexOf(n) === i,
  );
  const cards: MemberCard[] = everyone.map((name) => {
    const count = counts.get(name) ?? 0;
    const last = lastEventOf(events, name);
    const lastMsg = lastKey.get(name) ?? null;
    const left =
      last !== null &&
      (last.type === "leave" || last.type === "kick") &&
      // 나간 뒤에 다시 말했다면 다시 들어온 것이다(입장 기록이 빠졌을 수 있다).
      !(lastMsg && last.dateKey && lastMsg > last.dateKey);
    const join = events.find((e) => e.name === name && e.type === "join");
    const chars = textChars.get(name);
    return {
      name,
      status: left
        ? "퇴장"
        : lastMsg && recentFrom && lastMsg >= recentFrom
          ? "활동"
          : "휴면",
      joinKey: join?.dateKey ?? null,
      leaveKey: left ? last.dateKey : null,
      firstKey: firstKey.get(name) ?? null,
      lastKey: lastMsg,
      count,
      share: total ? Math.round((count / total) * 1000) / 10 : 0,
      avgLength: chars?.texts ? Math.round((chars.chars / chars.texts) * 10) / 10 : 0,
      avgRun: runs.get(name) ? Math.round((count / (runs.get(name) ?? 1)) * 10) / 10 : 0,
      peakHour: peakHours.get(name) ?? null,
      nightShare: count ? Math.round(((nights.get(name) ?? 0) / count) * 1000) / 10 : 0,
    };
  });

  // ── 인원 변천사 ──
  const firstEvent = new Map<string, MemberEvent>();
  events
    .filter((e) => e.type !== "rename")
    .forEach((e) => {
      if (!firstEvent.has(e.name)) firstEvent.set(e.name, e);
    });
  const rosterStart = everyone.filter((n) => firstEvent.get(n)?.type !== "join").length;
  let running = rosterStart;
  const roster: RosterRow[] = events
    .filter((e) => e.type !== "rename")
    .map((e) => {
      running += e.type === "join" ? 1 : -1;
      const change =
        e.type === "join"
          ? e.actor
            ? `${e.name} 합류 (${e.actor} 초대)`
            : `${e.name} 입장`
          : e.type === "kick"
            ? `${e.name} 내보내짐${e.actor ? ` (${e.actor})` : ""}`
            : `${e.name} 퇴장`;
      return { dateKey: e.dateKey, change, count: running };
    });

  // ── 역할 지표 ──
  const roles = names.map((name) => {
    const mine = roleCounts.get(name) ?? new Map<RoleKey, number>();
    const msgShare = total ? (counts.get(name) ?? 0) / total : 0;
    const scores: RoleScore[] = ROLE_KEYS.map((key) => {
      const count = mine.get(key) ?? 0;
      const all = roleTotals.get(key) ?? 0;
      const value = all && msgShare ? count / all / msgShare : 0;
      return {
        key,
        label: ROLE_LABELS[key],
        count,
        value: Math.round(value * 100) / 100,
        example: roleExamples.get(name)?.get(key) ?? null,
      };
    }).sort((a, b) => b.value - a.value);
    return { name, scores };
  });

  // ── 친밀도 ──
  const shares = new Map(names.map((n) => [n, total ? (counts.get(n) ?? 0) / total : 0]));
  const allPairs = pairStats(replies, shares, names).sort(
    (x, y) => y.index - x.index,
  );
  const qualify = (minMessages: number, minReplies: number) =>
    allPairs.filter(
      (p) =>
        (counts.get(p.a) ?? 0) >= minMessages &&
        (counts.get(p.b) ?? 0) >= minMessages &&
        p.actual >= minReplies,
    );
  let pairs = qualify(PAIR_MIN_MESSAGES, PAIR_MIN_REPLIES);
  const relaxed = pairs.length === 0;
  if (relaxed) pairs = qualify(PAIR_MIN_MESSAGES_RELAXED, PAIR_MIN_REPLIES_RELAXED);
  pairs = pairs.map((p, i) => ({ ...p, rank: i + 1 }));

  // ── 의외의 조합 ──
  const top = new Set(pairs.slice(0, 3).map((p) => `${p.a}\u0000${p.b}`));
  const overall = new Map(allPairs.map((p) => [`${p.a}\u0000${p.b}`, p]));
  const unexpected: PairCandidate[] = [];
  monthReplies.forEach((monthMap, month) => {
    const mc = monthCounts.get(month) ?? new Map<string, number>();
    const monthTotal = [...mc.values()].reduce((s, v) => s + v, 0);
    const monthShares = new Map(names.map((n) => [n, monthTotal ? (mc.get(n) ?? 0) / monthTotal : 0]));
    for (const p of pairStats(monthMap, monthShares, names)) {
      const key = `${p.a}\u0000${p.b}`;
      const base = overall.get(key);
      if (!base || top.has(key) || p.actual < SPIKE_MIN_REPLIES) continue;
      if (base.index < 1 && p.index >= Math.max(base.index * SPIKE_RATIO, 1))
        unexpected.push({
          ...base,
          reason: `${monthLabel(month)} 친밀도 ${p.index.toFixed(2)} (평소 ${base.index.toFixed(2)}, 그달 5분 내 응답 ${p.actual}회)`,
        });
    }
  });
  const byName = new Map(cards.map((c) => [c.name, c]));
  for (const p of allPairs) {
    const key = `${p.a}\u0000${p.b}`;
    if (top.has(key) || p.actual < PAIR_MIN_REPLIES_RELAXED || p.index < 1) continue;
    const a = byName.get(p.a);
    const b = byName.get(p.b);
    if (!a || !b) continue;
    const longer = Math.max(a.avgLength, b.avgLength);
    const shorter = Math.max(1, Math.min(a.avgLength, b.avgLength));
    const reasons: string[] = [];
    if (longer / shorter >= OPPOSITE_LENGTH_RATIO)
      reasons.push(`평균 메시지 길이 ${a.avgLength}자 vs ${b.avgLength}자`);
    if (hourGap(a.peakHour, b.peakHour) >= OPPOSITE_HOUR_GAP)
      reasons.push(`주 활동 시각 ${a.peakHour}시 vs ${b.peakHour}시`);
    if (reasons.length)
      unexpected.push({ ...p, reason: `성향 차이: ${reasons.join(", ")}, 친밀도 ${p.index.toFixed(2)}` });
  }
  // 같은 쌍은 한 번만, 친밀도 변화가 큰 순
  const seen = new Set<string>();
  const unexpectedUnique = unexpected.filter((p) => {
    const key = `${p.a}\u0000${p.b}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // ── 원본 행렬 ──
  const matrix = {
    names,
    counts: names.map((responder) =>
      names.map((speaker) =>
        responder === speaker ? 0 : (replies.get(`${responder}\u0000${speaker}`) ?? 0),
      ),
    ),
  };

  const quarters: Quarter[] = [...quarterMap.entries()].map(([label, map]) => ({
    label,
    total: [...map.values()].reduce((s, v) => s + v, 0),
    counts: map,
  }));

  yield 1;
  return {
    cards,
    rosterStart,
    roster,
    roles,
    pairs,
    relaxed,
    allPairs,
    unexpected: unexpectedUnique.slice(0, 4),
    matrix,
    quarters,
  };
}
