import type {
  Badge,
  ChatMessage,
  ParsedChat,
  PersonProfile,
  RoomProfile,
  WordCount,
} from "@/types/chat";
import {
  BoundedCounter,
  hasLink,
  isMeaningfulPhrase,
  isMorning,
  keyToDate,
  toTs,
  tokenize,
} from "@/screens/home/utils/chatMetrics";
import { Steps, YIELD_MASK, runSync } from "@/screens/home/utils/slicing";

const PHOTO = /^(사진(\s\d+장)?|<사진 읽지 않음>)$/;
const EMOTICON = /^(이모티콘|\(이모티콘\)|<이모티콘>)$/;
const MEDIA =
  /^(사진(\s\d+장)?|동영상|이모티콘|\(이모티콘\)|<.*읽지 않음>|파일:.*|삭제된 메시지입니다\.?)$/;
const LAUGH = /[ㅋㅎ]{2,}/;
const QUESTION = /\?|？/;
const CALL = /^(@|야\s|얘들아|다들|여러분)/;
/** 이 시간 이상 조용하다가 말을 꺼내면 대화를 시작한 것으로 본다. */
const CONVERSATION_GAP_MS = 60 * 60 * 1000;
const SHORT_MESSAGE_CHARS = 5;
/** 역할 비율 계산에 쓸 최소 메시지 수. 한두 마디로 비율 1위가 되는 것을 막는다. */
const MIN_ROLE_MESSAGES = 3;
/** 말버릇: 그 말을 방에서 쓴 횟수 중 이 사람의 몫이 이 비율 이상이어야 그 사람의 말버릇이다. */
const CATCHPHRASE_OWN_SHARE = 0.5;
const CATCHPHRASE_LIMIT = 5;
const PHRASE_MAX_CHARS = 24;

/** 역할 판별용 개인 특성 횟수. 대화 순서가 필요해 전체 메시지를 한 번 훑을 때 함께 센다. */
interface Traits {
  starts: number;
  bursts: number;
  short: number;
  morning: number;
  weekend: number;
  link: number;
  call: number;
}

const emptyTraits = (): Traits => ({
  starts: 0,
  bursts: 0,
  short: 0,
  morning: 0,
  weekend: 0,
  link: 0,
  call: 0,
});

/**
 * 1등에게만 주는 대표 역할을 받지 못한 사람에게 줄 역할.
 * 각자 방 평균 대비 가장 두드러지는 특성으로 고르며, 가능한 한 겹치지 않게 나눈다.
 */
type RoleContext = { traits: Traits; roomActiveDays: number };
type RoleDef = {
  badge: Badge;
  score: (p: PersonProfile, ctx: RoleContext) => number;
};

const ratioOf = (p: PersonProfile, v: number) =>
  p.messageCount >= MIN_ROLE_MESSAGES ? v / p.messageCount : 0;

const SECONDARY_ROLES: RoleDef[] = [
  {
    badge: {
      id: "starter",
      name: "대화 시동꾼",
      description: "한동안 조용하던 방에 먼저 말을 거는 일이 잦다.",
      joke: "정적을 못 견디는 타입",
      rarity: "common",
    },
    score: (p, { traits }) => ratioOf(p, traits.starts),
  },
  {
    badge: {
      id: "replier",
      name: "맞장구 담당",
      description:
        "다른 사람의 말 바로 뒤에 답하는 비율이 높다. 대화가 끊기지 않는 데 기여한다.",
      rarity: "common",
    },
    score: (p) =>
      ratioOf(
        p,
        p.replyPartners.reduce((sum, partner) => sum + partner.count, 0),
      ),
  },
  {
    badge: {
      id: "short",
      name: "단답 장인",
      description: "다섯 글자 안팎의 짧은 답이 많다. 짧고 굵게 말하는 편이다.",
      joke: "ㅇㅇ의 미학",
      rarity: "common",
    },
    score: (p, { traits }) => ratioOf(p, traits.short),
  },
  {
    badge: {
      id: "burst",
      name: "연타 장인",
      description: "한 번 말을 시작하면 혼자서 여러 개를 연달아 보낸다.",
      joke: "엔터키가 고장 났다는 설이 있다",
      rarity: "common",
    },
    score: (p, { traits }) => ratioOf(p, traits.bursts),
  },
  {
    badge: {
      id: "morning",
      name: "아침형 인간",
      description: "남들이 자는 아침 5~9시에 말하는 비율이 높다.",
      rarity: "common",
    },
    score: (p, { traits }) => ratioOf(p, traits.morning),
  },
  {
    badge: {
      id: "weekend",
      name: "주말 출몰러",
      description: "주말에 유독 말이 많아진다.",
      joke: "평일엔 바쁜 척",
      rarity: "common",
    },
    score: (p, { traits }) => ratioOf(p, traits.weekend),
  },
  {
    badge: {
      id: "link",
      name: "링크 배달부",
      description: "링크를 자주 퍼 나른다.",
      rarity: "common",
    },
    score: (p, { traits }) => ratioOf(p, traits.link),
  },
  {
    badge: {
      id: "call",
      name: "호출 담당",
      description: "“얘들아”, “다들” 하며 사람들을 불러 모으는 일이 잦다.",
      rarity: "common",
    },
    score: (p, { traits }) => ratioOf(p, traits.call),
  },
  {
    badge: {
      id: "attendance",
      name: "성실 출석러",
      description: "대화가 있던 날 대부분에 얼굴을 비춘다.",
      rarity: "common",
    },
    score: (p, { roomActiveDays }) =>
      p.messageCount >= MIN_ROLE_MESSAGES && roomActiveDays
        ? p.activeDays / roomActiveDays
        : 0,
  },
  {
    badge: {
      id: "laugh2",
      name: "웃음 장인",
      description: "‘ㅋㅋ’가 들어간 메시지 비율이 방 평균보다 높다.",
      rarity: "common",
    },
    score: (p) => ratioOf(p, p.laughCount),
  },
  {
    badge: {
      id: "night2",
      name: "야간 근무조",
      description: "23시~5시 사이에 말하는 비율이 방 평균보다 높다.",
      rarity: "common",
    },
    score: (p) => ratioOf(p, p.nightCount),
  },
  {
    badge: {
      id: "question2",
      name: "궁금증 해결사",
      description: "물음표가 들어간 메시지 비율이 방 평균보다 높다.",
      rarity: "common",
    },
    score: (p) => ratioOf(p, p.questionCount),
  },
];

const QUIET_ROLE: Badge = {
  id: "quiet",
  name: "조용한 관찰자",
  description: "말수는 적지만 방을 떠나지 않고 지켜보는 것으로 보인다.",
  joke: "다 보고 있다",
  rarity: "common",
};

/** 대표 역할을 받지 못한 사람에게, 방 평균 대비 가장 두드러진 특성의 역할을 준다. */
function assignSecondaryRoles(
  people: PersonProfile[],
  traits: Map<string, Traits>,
  roomActiveDays: number,
) {
  const pending = people.filter((p) => !p.badges.length);
  if (!pending.length) return;

  const ctxOf = (p: PersonProfile): RoleContext => ({
    traits: traits.get(p.name) ?? emptyTraits(),
    roomActiveDays,
  });
  const averages = SECONDARY_ROLES.map(
    (role) =>
      people.reduce((sum, p) => sum + role.score(p, ctxOf(p)), 0) /
      people.length,
  );
  const pairs = pending
    .flatMap((person) =>
      SECONDARY_ROLES.map((role, index) => ({
        person,
        index,
        relative: averages[index]
          ? role.score(person, ctxOf(person)) / averages[index]
          : 0,
      })),
    )
    .filter((pair) => pair.relative > 0)
    .sort((a, b) => b.relative - a.relative);

  const usedRoles = new Set<number>();
  // 1차: 역할이 겹치지 않게, 2차: 남은 사람은 겹치더라도 가장 두드러진 역할
  for (const allowReuse of [false, true]) {
    for (const { person, index } of pairs) {
      if (person.badges.length) continue;
      if (!allowReuse && usedRoles.has(index)) continue;
      person.badges.push(SECONDARY_ROLES[index].badge);
      usedRoles.add(index);
    }
  }
  for (const person of pending) {
    if (!person.badges.length) person.badges.push(QUIET_ROLE);
  }
}


interface BaseProfile {
  name: string;
  messages: ChatMessage[];
  replies: Map<string, number>;
}

interface WorkCounter {
  done: number;
  work: number;
}

export function analyzeChat(parsed: ParsedChat): RoomProfile {
  return runSync(analyzeChatSteps(parsed));
}

/**
 * Per-person profiles as a sliceable generator. Total work = one sweep to group messages
 * plus one sweep per person (sum = all messages), reported as a single 0..1 fraction.
 */
export function* analyzeChatSteps(parsed: ParsedChat): Steps<RoomProfile> {
  const { messages, roomTitle } = parsed;
  const total = messages.length;
  const counter: WorkCounter = { done: 0, work: Math.max(total * 2, 1) };
  const byAuthor = new Map<string, BaseProfile>();
  const dayCounts = new Map<string, number>();
  const roomHist = Array.from({ length: 24 }, () => 0);
  const roomWords = new BoundedCounter();
  const roomPhrases = new BoundedCounter(100000);
  const traits = new Map<string, Traits>();
  const weekdayOf = new Map<string, number>();
  let prevTs: number | null = null;

  for (let i = 0; i < total; i++) {
    const msg = messages[i];
    let base = byAuthor.get(msg.author);
    if (!base) {
      base = { name: msg.author, messages: [], replies: new Map() };
      byAuthor.set(msg.author, base);
    }
    base.messages.push(msg);
    const prev = i > 0 ? messages[i - 1] : null;
    if (prev && prev.author !== msg.author)
      base.replies.set(prev.author, (base.replies.get(prev.author) ?? 0) + 1);

    const trait = traits.get(msg.author) ?? emptyTraits();
    traits.set(msg.author, trait);
    const ts = toTs(msg);
    const isNewConversation =
      !prev ||
      (ts !== null && prevTs !== null
        ? ts - prevTs >= CONVERSATION_GAP_MS
        : prev.dateKey !== msg.dateKey);
    if (isNewConversation) trait.starts++;
    if (prev && prev.author === msg.author) trait.bursts++;
    prevTs = ts ?? prevTs;
    const text = msg.text.trim();
    if (!MEDIA.test(text)) {
      if (text.length <= SHORT_MESSAGE_CHARS) trait.short++;
      if (hasLink(text)) trait.link++;
      if (CALL.test(text)) trait.call++;
      if (text.length <= PHRASE_MAX_CHARS && !text.includes("\n"))
        roomPhrases.add(text);
    }
    if (isMorning(msg.hour)) trait.morning++;
    if (msg.dateKey) {
      let weekday = weekdayOf.get(msg.dateKey);
      if (weekday === undefined) {
        weekday = keyToDate(msg.dateKey).getDay();
        weekdayOf.set(msg.dateKey, weekday);
      }
      if (weekday === 0 || weekday === 6) trait.weekend++;
    }
    if (msg.dateKey)
      dayCounts.set(msg.dateKey, (dayCounts.get(msg.dateKey) ?? 0) + 1);
    if (msg.hour !== null && msg.hour >= 0 && msg.hour <= 23)
      roomHist[msg.hour]++;
    for (const w of tokenize(msg.text)) roomWords.add(w);
    counter.done++;
    if ((i & YIELD_MASK) === 0) yield counter.done / counter.work;
  }

  const unsorted: PersonProfile[] = [];
  for (const base of byAuthor.values())
    unsorted.push(yield* buildPersonSteps(base, total, counter, roomPhrases));
  const drafts = unsorted
    .sort((a, b) => b.messageCount - a.messageCount)
    .map((p, i) => ({ ...p, rank: i + 1 }));
  applyStats(drafts);
  applyBadges(drafts);
  assignSecondaryRoles(drafts, traits, dayCounts.size);

  const dates = [...dayCounts.keys()].sort();
  let busiest: { date: string; count: number } | null = null;
  dayCounts.forEach((count, date) => {
    if (!busiest || count > busiest.count) busiest = { date, count };
  });

  const recentMessages: ChatMessage[] = [];
  for (let i = total - 1; i >= 0 && recentMessages.length < 8; i--) {
    if (messages[i].text.trim()) recentMessages.push(messages[i]);
  }

  yield 1;
  return {
    roomTitle,
    totalMessages: total,
    participants: drafts,
    startDate: dates[0] ?? null,
    endDate: dates[dates.length - 1] ?? null,
    activeDays: dates.length,
    busiestDay: busiest,
    topWords: roomWords.top(20).map((c) => ({ word: c.key, count: c.count })),
    hourHistogram: roomHist,
    peakHour: peak(roomHist),
    recentMessages,
  };
}

function* buildPersonSteps(
  { name, messages, replies }: BaseProfile,
  total: number,
  counter: WorkCounter,
  roomPhrases: BoundedCounter,
): Steps<PersonProfile> {
  const hist = Array.from({ length: 24 }, () => 0);
  const days = new Set<string>();
  const words = new BoundedCounter();
  const phrases = new BoundedCounter(50000);
  const fallback: string[] = [];
  let nightCount = 0;
  let textCount = 0;
  let totalChars = 0;
  let longest = "";
  let laughCount = 0;
  let photoCount = 0;
  let emoticonCount = 0;
  let questionCount = 0;

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const trimmed = m.text.trim();
    if (m.hour !== null && m.hour >= 0 && m.hour <= 23) {
      hist[m.hour]++;
      if (m.hour >= 23 || m.hour < 5) nightCount++;
    }
    if (m.dateKey) days.add(m.dateKey);
    if (LAUGH.test(m.text)) laughCount++;
    if (PHOTO.test(trimmed)) photoCount++;
    if (EMOTICON.test(trimmed)) emoticonCount++;
    for (const w of tokenize(m.text)) words.add(w);
    if (!MEDIA.test(trimmed)) {
      textCount++;
      totalChars += m.text.length;
      if (m.text.length > longest.length) longest = m.text;
      if (QUESTION.test(m.text)) questionCount++;
      if (
        trimmed.length >= 1 &&
        trimmed.length <= PHRASE_MAX_CHARS &&
        !trimmed.includes("\n")
      ) {
        phrases.add(trimmed);
        if (fallback.length < 50) fallback.push(trimmed);
      }
    }
    counter.done++;
    if ((counter.done & YIELD_MASK) === 0) yield counter.done / counter.work;
  }

  const count = messages.length;
  const { level, progress, toNext } = levelOf(count);
  return {
    name,
    rank: 0,
    messageCount: count,
    share: total ? Math.round((count / total) * 1000) / 10 : 0,
    avgLength: textCount ? totalChars / textCount : 0,
    laughCount,
    photoCount,
    emoticonCount,
    questionCount,
    nightCount,
    hourHistogram: hist,
    peakHour: peak(hist),
    topWords: words.top(12).map((c) => ({ word: c.key, count: c.count })),
    catchphrases: pickCatchphrases(phrases, fallback, roomPhrases),
    longestMessage: longest,
    firstMessage: messages[0] ?? null,
    lastMessage: messages[messages.length - 1] ?? null,
    replyPartners: [...replies.entries()]
      .map(([partner, c]) => ({ name: partner, count: c }))
      .sort((a, b) => b.count - a.count),
    activeDays: days.size,
    level,
    expProgress: progress,
    messagesToNext: toNext,
    badges: [],
    stats: [],
  };
}

/**
 * 말버릇 = 추임새가 아닌 말을 2번 이상 썼고, 방에서 그 말을 쓴 횟수의 절반 이상이 이 사람인 것.
 * 그런 말이 없으면 긴 문장 몇 개를 대표 어록 후보로 쓴다.
 */
function pickCatchphrases(
  counter: BoundedCounter,
  fallback: string[],
  roomPhrases: BoundedCounter,
): WordCount[] {
  const repeated = counter
    .top(50)
    .filter(
      (c) =>
        c.count >= 2 &&
        isMeaningfulPhrase(c.key) &&
        c.count / Math.max(roomPhrases.get(c.key), c.count) >=
          CATCHPHRASE_OWN_SHARE,
    )
    .slice(0, CATCHPHRASE_LIMIT);
  if (repeated.length)
    return repeated.map((c) => ({ word: c.key, count: c.count }));
  // 여러 번 썼지만 방 전체가 쓰는 말은 이 사람의 어록이 아니므로, 한 번만 한 말에서 고른다.
  return [...new Set(fallback)]
    .filter((text) => counter.get(text) === 1 && isMeaningfulPhrase(text))
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)
    .map((word) => ({ word, count: 1 }));
}

function applyStats(people: PersonProfile[]) {
  const ratio = (p: PersonProfile, v: number) =>
    p.messageCount ? v / p.messageCount : 0;
  const max = (fn: (p: PersonProfile) => number) =>
    people.reduce((m, p) => Math.max(m, fn(p)), 0);
  const rel = (v: number, m: number) => (m > 0 ? Math.round((v / m) * 100) : 0);

  const maxCount = max((p) => p.messageCount);
  const maxLaugh = max((p) => ratio(p, p.laughCount));
  const maxNight = max((p) => ratio(p, p.nightCount));
  const maxLen = max((p) => p.avgLength);
  const maxQ = max((p) => ratio(p, p.questionCount));

  people.forEach((p) => {
    p.stats = [
      {
        key: "talk",
        label: "발언량",
        value: rel(p.messageCount, maxCount),
        raw: `${p.messageCount.toLocaleString()}개`,
      },
      {
        key: "laugh",
        label: "웃음 빈도",
        value: rel(ratio(p, p.laughCount), maxLaugh),
        raw: `ㅋㅋ ${p.laughCount}회`,
      },
      {
        key: "night",
        label: "야행성",
        value: rel(ratio(p, p.nightCount), maxNight),
        raw: `새벽 ${p.nightCount}개`,
      },
      {
        key: "long",
        label: "메시지 길이",
        value: rel(p.avgLength, maxLen),
        raw: `평균 ${p.avgLength.toFixed(1)}자`,
      },
      {
        key: "curious",
        label: "질문 빈도",
        value: rel(ratio(p, p.questionCount), maxQ),
        raw: `질문 ${p.questionCount}개`,
      },
    ];
  });
}

function applyBadges(people: PersonProfile[]) {
  const award = (
    badge: Badge,
    score: (p: PersonProfile) => number,
    pickMin = false,
  ) => {
    const eligible = people.filter((p) => score(p) > 0 || pickMin);
    if (!eligible.length) return;
    const winner = eligible.reduce((best, p) =>
      pickMin
        ? score(p) < score(best)
          ? p
          : best
        : score(p) > score(best)
          ? p
          : best,
    );
    winner.badges.push(badge);
  };
  const ratio = (p: PersonProfile, v: number) =>
    p.messageCount >= 3 ? v / p.messageCount : 0;

  award(
    {
      id: "talk",
      name: "단톡방의 실세",
      description:
        "단톡방에서 가장 많은 메시지를 남긴 인물. 이 사람이 조용한 날은 단톡방 전체가 조용하다.",
      joke: "사실상 방장",
      rarity: "legend",
    },
    (p) => p.messageCount,
  );
  award(
    {
      id: "laugh",
      name: "리액션 담당",
      description:
        "메시지 대비 'ㅋㅋ' 비율이 가장 높다. 별로 웃기지 않은 말에도 일단 웃어 주는 것으로 알려져 있다.",
      joke: "진짜 웃겨서 웃는 건지는 불명",
      rarity: "epic",
    },
    (p) => ratio(p, p.laughCount),
  );
  award(
    {
      id: "night",
      name: "새벽 출몰러",
      description:
        "23시~5시 사이 발언 비율이 가장 높다. 다른 구성원이 아침에 일어나면 이 사람의 메시지가 쌓여 있는 경우가 많다.",
      joke: "수면 부족이 의심된다",
      rarity: "epic",
    },
    (p) => ratio(p, p.nightCount),
  );
  award(
    {
      id: "long",
      name: "장문 담당",
      description:
        "평균 메시지 길이가 가장 길다. 한 번 입을 열면 스크롤을 내려야 한다.",
      joke: "세 줄 요약 바람",
      rarity: "rare",
    },
    (p) => p.avgLength,
  );
  award(
    {
      id: "photo",
      name: "사진 담당",
      description:
        "사진을 가장 많이 올린 인물. 말보다 사진이 먼저 나가는 편이다.",
      rarity: "rare",
    },
    (p) => p.photoCount,
  );
  award(
    {
      id: "emoticon",
      name: "이모티콘 장인",
      description: "대답의 상당수를 이모티콘으로 해결한다.",
      joke: "할 말이 없을 때 쓴다는 설이 있다",
      rarity: "rare",
    },
    (p) => p.emoticonCount,
  );
  award(
    {
      id: "question",
      name: "질문 담당",
      description:
        "물음표가 들어간 메시지 비율이 가장 높다. 궁금한 것은 참지 못하는 성격으로 보인다.",
      rarity: "rare",
    },
    (p) => ratio(p, p.questionCount),
  );
  if (people.length >= 3) {
    award(
      {
        id: "lurker",
        name: "눈팅족",
        description:
          "발언량 최하위. 그러나 읽음 표시는 꼬박꼬박 사라지는 것으로 보아 대화는 전부 확인하고 있는 듯하다.",
        joke: "다 보고 있다",
        rarity: "common",
      },
      (p) => p.messageCount,
      true,
    );
  }

  const order = { legend: 0, epic: 1, rare: 2, common: 3 };
  people.forEach((p) => {
    p.badges.sort((a, b) => order[a.rarity] - order[b.rarity]);
  });
}

function levelOf(count: number) {
  const need = (l: number) => Math.ceil(((l - 1) * (l - 1)) / 2);
  let level = 1;
  while (need(level + 1) <= count) level++;
  const span = need(level + 1) - need(level);
  return {
    level,
    progress: span > 0 ? (count - need(level)) / span : 0,
    toNext: need(level + 1) - count,
  };
}

function peak(hist: number[]): number | null {
  let max = 0;
  let idx = -1;
  hist.forEach((v, i) => {
    if (v > max) {
      max = v;
      idx = i;
    }
  });
  return idx >= 0 ? idx : null;
}
