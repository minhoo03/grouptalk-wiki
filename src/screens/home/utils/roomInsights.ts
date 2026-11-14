import type { ChatMessage } from "@/types/chat";
import type {
  DayStat,
  Gap,
  Insights,
  MediaKey,
  MsgKind,
  PersonGap,
  Phrase,
  ReplyStat,
  Session,
  TimedMessage,
  TypeKey,
  TypeRank,
  Bucket,
} from "@/screens/home/utils/insights.types";
import {
  BoundedCounter,
  addDays,
  classify,
  daysBetween,
  emojis,
  hasLink,
  isMeaningfulPhrase,
  isMorning,
  isNight,
  keyToDate,
  laughForms,
  longestLaugh,
  toTs,
  tokenize,
} from "@/screens/home/utils/chatMetrics";
import { inc, median, rank, top } from "@/screens/home/utils/collections";
import { Steps, YIELD_MASK, runSync } from "@/screens/home/utils/slicing";

export type {
  Bucket,
  DayStat,
  Gap,
  Insights,
  MediaKey,
  PersonGap,
  Phrase,
  Ranked,
  ReplyStat,
  Session,
  TimedMessage,
  TypeKey,
  TypeRank,
} from "@/screens/home/utils/insights.types";

export const SESSION_GAP = 60;
const PHRASE_LIMIT = 100000;
/** 유행어: 의미 있는 말이 이 횟수 이상, 이 인원 이상에게서 나와야 방에 퍼진 말로 본다. */
const SLANG_MIN_COUNT = 3;
const SLANG_MIN_USERS = 2;
/** 사라진 유행어: 기록 기간이 이 일수 이상일 때만, 후반부(1/3)에 한 번도 안 나온 유행어 */
const VANISHED_MIN_SPAN_DAYS = 30;
/** "현재"로 보는 기간: 마지막 기록일 기준 최근 30일 */
const RECENT_DAYS = 30;
const RECENT_TOP_WORDS = 5;
const MISUNDERSTAND =
  /오해|그게 아니라|그런 뜻(이)? 아니|농담이(야|었)|장난이(야|었)/;
const RUMOR = /카더라|소문|썰 (들었|풀)|들었는데/;
const CORRECTION = /정정|오타|잘못 (말|보냄|보냈|썼)|취소할게|수정할게/;
const RENAME = /방\s?이름을\s?['"“]?(.+?)['"”]?\s?(?:으로|로)\s?변경/;
const CALL = /^(@|야\s|얘들아|다들|여러분)/;
const JAMO_ONLY = /^[ㄱ-ㅎㅏ-ㅣ\s.!?~]+$/;
const LAUGH_RE = /[ㅋㅎ]{2,}/;
const QUESTION_RE = /\?|？/;
const TYPE_KEYS: TypeKey[] = [
  "short",
  "long",
  "emoticon",
  "photo",
  "link",
  "laugh",
  "question",
  "call",
  "nightMood",
];
const BANDS = [
  { label: "새벽", range: "0~5시" },
  { label: "아침", range: "6~11시" },
  { label: "오후", range: "12~17시" },
  { label: "밤", range: "18~23시" },
];

// Relative cost of the three passes, used to report one smooth 0..1 progress value.
const PHASE_WEIGHTS = [0.15, 0.6, 0.25];

export function computeInsights(messages: ChatMessage[]): Insights {
  return runSync(computeInsightsSteps(messages));
}

/**
 * Room-level analysis as a sliceable generator. Messages are processed sequentially in
 * blocks of 2048 with all running state (current session, previous speaker, counters)
 * carried across blocks, so slicing never changes the result.
 */
export function* computeInsightsSteps(
  messages: ChatMessage[],
): Steps<Insights> {
  const total = messages.length;
  const progress = (phase: number, i: number) => {
    let base = 0;
    for (let k = 0; k < phase; k++) base += PHASE_WEIGHTS[k];
    return base + PHASE_WEIGHTS[phase] * (total ? i / total : 1);
  };

  // ── Pass 0: normalize messages, author counts, date range ──
  const timed: TimedMessage[] = new Array(total);
  const counts = new Map<string, number>();
  let startKey: string | null = null;
  let endKey: string | null = null;
  for (let i = 0; i < total; i++) {
    const m = messages[i];
    timed[i] = {
      author: m.author,
      text: m.text,
      dateKey: m.dateKey,
      hour: m.hour,
      minute: m.minute,
      idx: i,
      ts: toTs(m),
      kind: classify(m.text),
      link: hasLink(m.text),
    };
    inc(counts, m.author);
    if (m.dateKey) {
      if (startKey === null || m.dateKey < startKey) startKey = m.dateKey;
      if (endKey === null || m.dateKey > endKey) endKey = m.dateKey;
    }
    if ((i & YIELD_MASK) === 0) yield progress(0, i);
  }
  const members = rank(counts);
  const names = members.map((m) => m.name);
  const spanDays = startKey && endKey ? daysBetween(startKey, endKey) + 1 : 0;
  const bucketUnit: Insights["bucketUnit"] =
    spanDays > 62 ? "월" : spanDays > 14 ? "주" : "일";

  // Calendar → bucket & weekday lookup tables (one entry per calendar day)
  const buckets: Bucket[] = [];
  const bucketIndex = new Map<string, number>();
  const dayBucket = new Map<string, number>();
  const dayWeekday = new Map<string, number>();
  let wdDays = 0;
  let weDays = 0;
  if (startKey) {
    for (let d = 0; d < spanDays; d++) {
      const k = addDays(startKey, d);
      const bk = bucketOf(k, bucketUnit);
      let bi = bucketIndex.get(bk.key);
      if (bi === undefined) {
        bi = buckets.length;
        bucketIndex.set(bk.key, bi);
        buckets.push({
          key: bk.key,
          label: bk.label,
          count: 0,
          days: 0,
          perDay: 0,
          members: 0,
          top: null,
          topWord: null,
        });
      }
      dayBucket.set(k, bi);
      buckets[bi].days++;
      const w = keyToDate(k).getDay();
      dayWeekday.set(k, w);
      if (w === 0 || w === 6) weDays++;
      else wdDays++;
    }
  }

  // ── Pass 1: everything that needs one sequential sweep ──
  const dayMap = new Map<string, DayStat>();
  const bucketAuthors = buckets.map(() => new Map<string, number>());
  const msgBucket = new Int32Array(total);
  const wordCounter = new BoundedCounter();
  const weekday = [0, 0, 0, 0, 0, 0, 0];
  const weekdayAuthors = new Map<string, number>();
  const weekendAuthors = new Map<string, number>();
  const hours = Array.from({ length: 24 }, () => 0);
  const bandCounts = [0, 0, 0, 0];
  const bandAuthors = BANDS.map(() => new Map<string, number>());
  const night = new Map<string, number>();
  const morning = new Map<string, number>();
  const kindCounts: Record<MsgKind, number> = {
    text: 0,
    photo: 0,
    video: 0,
    emoticon: 0,
    deleted: 0,
    file: 0,
  };
  const mediaMaps: Record<MediaKey, Map<string, number>> = {
    photo: new Map(),
    video: new Map(),
    emoticon: new Map(),
    link: new Map(),
    deleted: new Map(),
  };
  const sessions: Session[] = [];
  let sStart = 0;
  let sNight = 0;
  let sAuthors = new Set<string>();
  const closeSession = (end: number) => {
    sessions.push({
      start: sStart,
      end,
      count: end - sStart + 1,
      starter: timed[sStart].author,
      ender: timed[end].author,
      night: sNight,
      authors: sAuthors.size,
    });
  };
  const replyMap = new Map<string, number[]>();
  const repliers = new Map<string, number>();
  const trans = new Map<string, number>();
  const pairMap = new Map<string, number>();
  const allSamples: number[] = [];
  let longestGap: Insights["longestGap"] = null;
  let laughRecord: Insights["longestLaugh"] = null;
  let longestMessage: TimedMessage | null = null;
  let latest: TimedMessage | null = null;
  let latestScore = -1;
  const phraseMap = new Map<
    string,
    {
      count: number;
      users: Map<string, number>;
      first: TimedMessage;
      last: TimedMessage;
    }
  >();
  const laughMap = new Map<string, number>();
  const emojiMap = new Map<string, number>();
  const typeMaps = {} as Record<TypeKey, Map<string, number>>;
  const typeExamples = {} as Record<TypeKey, Map<string, TimedMessage>>;
  TYPE_KEYS.forEach((k) => {
    typeMaps[k] = new Map();
    typeExamples[k] = new Map();
  });
  const aliases = names.map((n) => ({
    name: n,
    list: /^[가-힣]{3}$/.test(n) ? [n, n.slice(1)] : [n],
  }));
  let repeatRun: Insights["repeatRun"] = null;
  let run = 1;
  const renames: Insights["renames"] = [];
  const misunderstandings: TimedMessage[] = [];
  const rumors: TimedMessage[] = [];
  const corrections: TimedMessage[] = [];
  let textCount = 0;
  let textChars = 0;

  for (let i = 0; i < total; i++) {
    const m = timed[i];
    const prev = i > 0 ? timed[i - 1] : null;
    const isText = m.kind === "text";
    const isMedia =
      m.kind === "photo" || m.kind === "video" || m.kind === "emoticon";

    if (m.dateKey) {
      let d = dayMap.get(m.dateKey);
      if (!d) {
        d = { key: m.dateKey, count: 0, authors: new Map(), media: 0 };
        dayMap.set(m.dateKey, d);
      }
      d.count++;
      inc(d.authors, m.author);
      if (isMedia) d.media++;
      const w = dayWeekday.get(m.dateKey) ?? keyToDate(m.dateKey).getDay();
      weekday[w]++;
      inc(w === 0 || w === 6 ? weekendAuthors : weekdayAuthors, m.author);
    }

    const bi = m.dateKey ? (dayBucket.get(m.dateKey) ?? -1) : -1;
    msgBucket[i] = bi;
    if (bi >= 0) {
      buckets[bi].count++;
      inc(bucketAuthors[bi], m.author);
    }

    for (const w of tokenize(m.text)) wordCounter.add(w);

    const h = m.hour;
    if (h !== null && h >= 0 && h <= 23) {
      hours[h]++;
      const band = h <= 5 ? 0 : h <= 11 ? 1 : h <= 17 ? 2 : 3;
      bandCounts[band]++;
      inc(bandAuthors[band], m.author);
      if (isNight(h)) inc(night, m.author);
      if (isMorning(h)) inc(morning, m.author);
    }

    kindCounts[m.kind]++;
    if (isMedia || m.kind === "deleted")
      inc(mediaMaps[m.kind as MediaKey], m.author);
    if (m.link) inc(mediaMaps.link, m.author);

    if (prev) {
      const gap =
        prev.ts !== null && m.ts !== null ? (m.ts - prev.ts) / 60000 : null;
      if (gap !== null ? gap > SESSION_GAP : prev.dateKey !== m.dateKey) {
        closeSession(i - 1);
        sStart = i;
        sNight = 0;
        sAuthors = new Set();
      }
      if (gap !== null) {
        if (!longestGap || gap > longestGap.minutes)
          longestGap = { from: prev, to: m, minutes: gap };
        if (prev.author !== m.author && gap <= SESSION_GAP) {
          const arr = replyMap.get(m.author) ?? [];
          arr.push(gap);
          replyMap.set(m.author, arr);
          allSamples.push(gap);
        }
      }
      if (prev.author !== m.author) {
        inc(repliers, m.author);
        inc(trans, `${prev.author}\u0000${m.author}`);
        inc(
          pairMap,
          prev.author < m.author
            ? `${prev.author}\u0000${m.author}`
            : `${m.author}\u0000${prev.author}`,
        );
      }
      if (
        isText &&
        prev.author === m.author &&
        prev.text.trim() === m.text.trim()
      ) {
        run++;
        if (run >= 3 && (!repeatRun || run > repeatRun.count))
          repeatRun = { name: m.author, text: m.text.trim(), count: run };
      } else run = 1;
    }
    if (isNight(m.hour)) sNight++;
    sAuthors.add(m.author);

    const laugh = longestLaugh(m.text);
    if (laugh >= 3 && (!laughRecord || laugh > laughRecord.length))
      laughRecord = { msg: m, length: laugh };
    if (isText) {
      if (!longestMessage || m.text.length > longestMessage.text.length)
        longestMessage = m;
      textCount++;
      textChars += m.text.length;
    }
    if (m.hour !== null && m.minute !== null) {
      const score = (m.hour * 60 + m.minute - 300 + 1440) % 1440;
      if (score > latestScore) {
        latestScore = score;
        latest = m;
      }
    }

    for (const f of laughForms(m.text)) inc(laughMap, f);
    const emo = emojis(m.text);
    for (const e of emo) inc(emojiMap, e);

    if (isText) {
      const t = m.text.trim();
      if (t && t.length <= 24 && !t.includes("\n") && !JAMO_ONLY.test(t)) {
        const entry = phraseMap.get(t) ?? {
          count: 0,
          users: new Map<string, number>(),
          first: m,
          last: m,
        };
        entry.count++;
        inc(entry.users, m.author);
        entry.last = m;
        phraseMap.set(t, entry);
        if (phraseMap.size > PHRASE_LIMIT) prunePhrases(phraseMap);
      }
    }

    const isQuestion = isText && QUESTION_RE.test(m.text);
    const flags: Record<TypeKey, boolean> = {
      short: isText && m.text.trim().length <= 5,
      long: isText && m.text.length >= 50,
      emoticon: m.kind === "emoticon" || emo.length > 0,
      photo: m.kind === "photo" || m.kind === "video",
      link: m.link,
      laugh: LAUGH_RE.test(m.text),
      question: isQuestion,
      call:
        isText &&
        (CALL.test(m.text) ||
          aliases.some(
            (a) =>
              a.name !== m.author && a.list.some((al) => m.text.includes(al)),
          )),
      nightMood: isText && isNight(m.hour) && m.text.length >= 20,
    };
    for (const key of TYPE_KEYS) {
      if (!flags[key]) continue;
      inc(typeMaps[key], m.author);
      const prevEx = typeExamples[key].get(m.author);
      if (!prevEx || m.text.length > prevEx.text.length)
        typeExamples[key].set(m.author, m);
    }

    if (isText) {
      if (misunderstandings.length < 5 && MISUNDERSTAND.test(m.text))
        misunderstandings.push(m);
      if (rumors.length < 5 && RUMOR.test(m.text)) rumors.push(m);
      if (corrections.length < 5 && CORRECTION.test(m.text))
        corrections.push(m);
    }
    const rn = m.text.match(RENAME);
    if (rn) renames.push({ name: rn[1], dateKey: m.dateKey, author: m.author });

    if ((i & YIELD_MASK) === 0) yield progress(1, i);
  }
  if (total) closeSession(total - 1);

  // ── Pass 2: detailed tracking only for frequent candidate words ──
  const candidates = wordCounter.top(1500).filter((c) => c.count >= 2);
  const wordTotals = new Map<string, number>(
    candidates.map((c) => [c.key, c.count]),
  );
  const leaderWords = new Set(candidates.slice(0, 5).map((c) => c.key));
  const bucketWords = buckets.map(() => new Map<string, number>());
  const wordBuckets = new Map<string, number[]>();
  const wordUsers = new Map<string, Map<string, number>>();
  const dayWord = new Map<string, number>();
  for (let i = 0; i < total && wordTotals.size; i++) {
    const m = timed[i];
    const bi = msgBucket[i];
    for (const w of tokenize(m.text)) {
      if (!wordTotals.has(w)) continue;
      if (leaderWords.has(w)) {
        const users = wordUsers.get(w) ?? new Map<string, number>();
        inc(users, m.author);
        wordUsers.set(w, users);
      }
      if (bi >= 0) {
        inc(bucketWords[bi], w);
        const arr = wordBuckets.get(w) ?? buckets.map(() => 0);
        arr[bi]++;
        wordBuckets.set(w, arr);
      }
      if (m.dateKey) {
        inc(dayWord, `${m.dateKey}|${w}`);
      }
    }
    if ((i & YIELD_MASK) === 0) yield progress(2, i);
  }

  // ── Aggregation ──
  buckets.forEach((bk, i) => {
    bk.perDay = bk.days ? bk.count / bk.days : 0;
    bk.members = bucketAuthors[i].size;
    bk.top = top(bucketAuthors[i]);
    bk.topWord = top(bucketWords[i]);
  });
  const words = rank(wordTotals)
    .slice(0, 20)
    .map((r) => ({ word: r.name, count: r.value }));

  const trendWords: Insights["trendWords"] = [];
  if (buckets.length >= 3) {
    wordBuckets.forEach((arr, w) => {
      const tot = wordTotals.get(w) ?? 0;
      if (tot < 3) return;
      let max = 0;
      let idx = 0;
      arr.forEach((v, i) => {
        if (v > max) {
          max = v;
          idx = i;
        }
      });
      if (max / tot >= 0.6 && idx < buckets.length - 1)
        trendWords.push({ word: w, bucket: buckets[idx].label, count: max });
    });
  }
  trendWords.sort((a, b) => b.count - a.count);

  let wordBurst: Insights["wordBurst"] = null;
  dayWord.forEach((count, key) => {
    if (count >= 3 && (!wordBurst || count > wordBurst.count)) {
      const [k, word] = key.split("|");
      wordBurst = { word, key: k, count };
    }
  });

  const topicLeaders = words.slice(0, 5).map((w) => {
    const leader = rank(wordUsers.get(w.word) ?? new Map())[0];
    return {
      word: w.word,
      name: leader?.name ?? "",
      count: leader?.value ?? 0,
    };
  });

  const days = [...dayMap.values()].sort((a, b) => a.key.localeCompare(b.key));
  const monthMap = new Map<string, number>();
  days.forEach((d) => inc(monthMap, d.key.slice(0, 7), d.count));
  const months: Insights["months"] = [];
  if (startKey && endKey) {
    let [y, mo] = startKey.split("-").map(Number);
    const [ey, em] = endKey.split("-").map(Number);
    while (y < ey || (y === ey && mo <= em)) {
      months.push({
        label: `${y}년 ${mo}월`,
        count: monthMap.get(`${y}-${String(mo).padStart(2, "0")}`) ?? 0,
      });
      mo++;
      if (mo > 12) {
        mo = 1;
        y++;
      }
    }
  }

  const media = {} as Record<MediaKey, Insights["members"]>;
  const mediaTotal = {} as Record<MediaKey, number>;
  (Object.keys(mediaMaps) as MediaKey[]).forEach((k) => {
    media[k] = rank(mediaMaps[k]);
    mediaTotal[k] = media[k].reduce((s, r) => s + r.value, 0);
  });

  const starterMap = new Map<string, number>();
  const enderMap = new Map<string, number>();
  sessions.forEach((s) => {
    inc(starterMap, s.starter);
    inc(enderMap, s.ender);
  });
  const quietAfter = members
    .filter((m) => m.value >= 3)
    .map((m) => ({
      name: m.name,
      value: Math.round(((enderMap.get(m.name) ?? 0) / m.value) * 100),
    }))
    .sort((a, b) => b.value - a.value);

  const replySpeed: ReplyStat[] = [...replyMap.entries()]
    .filter(([, s]) => s.length >= 3)
    .map(([name, s]) => ({ name, value: median(s), samples: s.length }))
    .sort((a, b) => a.value - b.value);
  const transitions = [...trans.entries()]
    .map(([k, count]) => {
      const [from, to] = k.split("\u0000");
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count);
  const totalTrans = transitions.reduce((s, t) => s + t.count, 0);
  const pairs = [...pairMap.entries()]
    .map(([k, count]) => {
      const [a, b] = k.split("\u0000");
      const expected =
        totalTrans *
        2 *
        ((counts.get(a) ?? 0) / total) *
        ((counts.get(b) ?? 0) / total);
      return { a, b, count, ratio: expected > 0 ? count / expected : 0 };
    })
    .sort((x, y) => y.count - x.count);

  const dayGaps: Gap[] = [];
  for (let i = 1; i < days.length; i++) {
    const g = daysBetween(days[i - 1].key, days[i].key) - 1;
    if (g >= 1)
      dayGaps.push({ fromKey: days[i - 1].key, toKey: days[i].key, days: g });
  }
  dayGaps.sort((a, b) => b.days - a.days);

  const personDays = new Map<string, string[]>();
  days.forEach((d) =>
    d.authors.forEach((_, name) => {
      const arr = personDays.get(name) ?? [];
      arr.push(d.key);
      personDays.set(name, arr);
    }),
  );
  const personMaxGap: PersonGap[] = [];
  personDays.forEach((keys, name) => {
    let best: PersonGap | null = null;
    for (let i = 1; i < keys.length; i++) {
      const g = daysBetween(keys[i - 1], keys[i]) - 1;
      if (!best || g > best.days)
        best = { name, fromKey: keys[i - 1], toKey: keys[i], days: g };
    }
    if (best && best.days > 0) personMaxGap.push(best);
  });
  personMaxGap.sort((a, b) => b.days - a.days);

  let personDayMax: Insights["personDayMax"] = null;
  let busiestDay: DayStat | null = null;
  for (const d of days) {
    if (!busiestDay || d.count > busiestDay.count) busiestDay = d;
    d.authors.forEach((count, name) => {
      if (!personDayMax || count > personDayMax.count)
        personDayMax = { name, key: d.key, count };
    });
  }
  let busiestTopWord: string | null = null;
  if (busiestDay) {
    const prefix = `${busiestDay.key}|`;
    let best = 0;
    dayWord.forEach((count, key) => {
      if (key.startsWith(prefix) && count > best) {
        best = count;
        busiestTopWord = key.slice(prefix.length);
      }
    });
  }

  // 유행어 = 추임새가 아닌 말이 여러 사람에게 퍼진 것. 한 사람만 쓰면 그 사람의 말버릇이다.
  const slang: Phrase[] = [...phraseMap.entries()]
    .filter(
      ([text, e]) =>
        e.count >= SLANG_MIN_COUNT &&
        e.users.size >= SLANG_MIN_USERS &&
        isMeaningfulPhrase(text),
    )
    .map(([text, e]) => ({
      text,
      count: e.count,
      users: rank(e.users),
      first: e.first,
      last: e.last,
    }))
    .sort((a, b) => b.count - a.count);
  const phrases = slang.slice(0, 10);

  // 사라진 유행어 = 위 유행어 중 기록 후반 1/3에 한 번도 나오지 않은 것
  const vanishedCutoff =
    startKey && spanDays >= VANISHED_MIN_SPAN_DAYS
      ? addDays(startKey, Math.floor((spanDays * 2) / 3))
      : null;
  const vanished: Insights["vanished"] = vanishedCutoff
    ? slang
        .filter((ph) => ph.last.dateKey && ph.last.dateKey < vanishedCutoff)
        .slice(0, 5)
        .map((ph) => ({
          word: ph.text,
          count: ph.count,
          lastKey: ph.last.dateKey,
        }))
    : [];
  const toWords = (map: Map<string, number>) =>
    rank(map).map((r) => ({ word: r.name, count: r.value }));

  const typeTotals = {} as Record<TypeKey, number>;
  const types: TypeRank[] = TYPE_KEYS.map((key) => {
    const ranking = rank(typeMaps[key]);
    typeTotals[key] = ranking.reduce((s, r) => s + r.value, 0);
    return {
      key,
      ranking,
      example: ranking[0]
        ? (typeExamples[key].get(ranking[0].name) ?? null)
        : null,
    };
  });

  const unanswered: TimedMessage[] = [];
  for (const s of sessions) {
    let j = s.end;
    while (j > s.start && timed[j - 1].author === timed[s.end].author) j--;
    for (let k = s.end; k >= j; k--) {
      if (timed[k].kind === "text" && QUESTION_RE.test(timed[k].text)) {
        unanswered.push(timed[k]);
        break;
      }
    }
  }

  // "현재" = 마지막 기록일 기준 최근 30일. 달력상 이번 달이 아니다.
  let recent: Insights["recent"] = null;
  if (endKey && startKey) {
    const windowDays = Math.min(RECENT_DAYS, spanDays);
    const fromKey = addDays(endKey, -(windowDays - 1));
    const recentAuthors = new Map<string, number>();
    let recentCount = 0;
    // 직전 같은 길이 구간. 기록이 두 구간을 다 채울 만큼 길 때만 비교한다.
    const prevFromKey = addDays(fromKey, -windowDays);
    const hasPrev = spanDays >= windowDays * 2;
    let prevCount = 0;
    for (const d of days) {
      if (d.key < fromKey) {
        if (d.key >= prevFromKey) prevCount += d.count;
        continue;
      }
      recentCount += d.count;
      d.authors.forEach((c, name) => inc(recentAuthors, name, c));
    }
    const recentWords = new Map<string, number>();
    for (const m of timed) {
      if (!m.dateKey || m.dateKey < fromKey) continue;
      for (const w of tokenize(m.text))
        if (wordTotals.has(w)) inc(recentWords, w);
    }
    recent = {
      fromKey,
      toKey: endKey,
      days: windowDays,
      count: recentCount,
      members: recentAuthors.size,
      perDay: recentCount / windowDays,
      top: top(recentAuthors),
      prevCount: hasPrev ? prevCount : null,
      topWords: rank(recentWords)
        .slice(0, RECENT_TOP_WORDS)
        .map((r) => r.name),
    };
  }

  yield 1;

  return {
    timed,
    members,
    total,
    startKey,
    endKey,
    spanDays,
    activeDays: days.length,
    emptyDays: Math.max(0, spanDays - days.length),
    days,
    bucketUnit,
    buckets,
    perDay: spanDays ? total / spanDays : 0,
    recent,
    months,
    weekday,
    weekdayAvg: wdDays
      ? weekday.slice(1, 6).reduce((a, b) => a + b, 0) / wdDays
      : 0,
    weekendAvg: weDays ? (weekday[0] + weekday[6]) / weDays : 0,
    weekdayTop: top(weekdayAuthors),
    weekendTop: top(weekendAuthors),
    hours,
    bands: BANDS.map((bd, i) => ({
      label: bd.label,
      range: bd.range,
      count: bandCounts[i],
      top: top(bandAuthors[i]),
    })),
    nightRank: rank(night),
    morningRank: rank(morning),
    kindCounts,
    media,
    mediaTotal,
    sessions,
    starters: rank(starterMap),
    enders: rank(enderMap),
    quietAfter,
    repliers: rank(repliers),
    replySpeed,
    replyMedianAll: allSamples.length ? median(allSamples) : null,
    transitions,
    pairs,
    longestGap,
    dayGaps,
    personGaps: personMaxGap.filter((g) => g.days >= 7),
    personMaxGap,
    personDayMax,
    busiestDay,
    busiestTopWord,
    longestLaugh: laughRecord,
    longestMessage,
    latest,
    allPresentDays:
      names.length >= 2
        ? days.filter((d) => d.authors.size === names.length).map((d) => d.key)
        : [],
    phrases,
    laughs: toWords(laughMap).slice(0, 6),
    emojiTop: toWords(emojiMap).slice(0, 8),
    words,
    trendWords: trendWords.slice(0, 5),
    vanished: vanished.slice(0, 5),
    wordBurst,
    topicLeaders,
    types,
    typeTotals,
    textAvgLength: textCount ? textChars / textCount : 0,
    misunderstandings,
    rumors,
    corrections,
    unanswered,
    repeatRun,
    renames,
    years: [...new Set(days.map((d) => Number(d.key.slice(0, 4))))].sort(
      (a, b) => a - b,
    ),
  };
}

function prunePhrases(map: Map<string, { count: number }>) {
  let threshold = 1;
  while (map.size > PHRASE_LIMIT * 0.6) {
    map.forEach((e, key) => {
      if (e.count <= threshold) map.delete(key);
    });
    threshold++;
  }
}

export function bucketOf(
  key: string,
  unit: Insights["bucketUnit"],
): { key: string; label: string } {
  const date = keyToDate(key);
  if (unit === "월")
    return {
      key: key.slice(0, 7),
      label: `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
    };
  if (unit === "주") {
    const monday = addDays(key, -((date.getDay() + 6) % 7));
    const md = keyToDate(monday);
    return {
      key: monday,
      label: `${md.getMonth() + 1}월 ${md.getDate()}일 주`,
    };
  }
  return { key, label: `${date.getMonth() + 1}월 ${date.getDate()}일` };
}
