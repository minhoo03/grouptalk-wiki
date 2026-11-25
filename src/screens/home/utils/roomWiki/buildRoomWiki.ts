import type { ChatMessage, MemberEvent, RoomProfile } from "@/types/chat";
import type {
  NoteRef,
  NumberedSec,
  RoomWiki,
  WikiNote,
  WikiSec,
} from "@/types/wiki";
import {
  computeInsightsSteps,
  type Insights,
} from "@/screens/home/utils/roomInsights";
import { computeMemberSteps } from "@/screens/home/utils/memberInsights";
import {
  computeSlangSteps,
  type SlangInsights,
} from "@/screens/home/utils/slangInsights";
import type { MemberInsights } from "@/screens/home/utils/memberInsights";
import type { ExcerptFocus } from "@/screens/home/utils/aiProse/sampleExcerpts";
import { Steps, runSync, scaled } from "@/screens/home/utils/slicing";
import {
  BuildCtx,
  type BotSummary,
} from "@/screens/home/utils/roomWiki/builder";
import {
  historySection,
  namingSection,
  overviewSection,
} from "@/screens/home/utils/roomWiki/sectionsIntro";
import { cultureSection } from "@/screens/home/utils/roomWiki/sectionsCulture";
import { slangSection } from "@/screens/home/utils/roomWiki/sectionsSlang";
import {
  hallOfFameSection,
  memberSection,
} from "@/screens/home/utils/roomWiki/sectionsPeople";
import {
  controversySection,
  episodeSection,
} from "@/screens/home/utils/roomWiki/sectionsEvents";
import {
  relatedSection,
  triviaSection,
} from "@/screens/home/utils/roomWiki/sectionsMisc";

/**
 * 나무위키 단체 문서의 일반적인 목차 순서를 따른다: 개요 → 명칭 → 역사 → 멤버 → 특징 → 유행어 → 에피소드 → 논란 → 명예의 전당 → 여담 → 관련 문서.
 * 숫자 위주의 통계·어워즈·연감·유형 도감·기록 보관소·분석 기준 섹션은 두지 않는다. 숫자는 각 섹션의 근거로만 쓴다.
 */
const MAIN_SECTIONS = [
  overviewSection,
  namingSection,
  historySection,
  memberSection,
  cultureSection,
  slangSection,
  episodeSection,
  controversySection,
  hallOfFameSection,
  triviaSection,
];

const NO_BOTS: BotSummary = { excluded: [], kept: [] };

export type BuiltRoomWiki = {
  wiki: RoomWiki;
  /** AI 서술에 보낼 발췌를 고를 때 함께 볼 대화(멤버·유행어 섹션의 근거) */
  focus: ExcerptFocus;
};

export function buildRoomWiki(
  room: RoomProfile,
  messages: ChatMessage[],
  bots: BotSummary = NO_BOTS,
  events: MemberEvent[] = [],
): BuiltRoomWiki {
  return runSync(buildRoomWikiSteps(room, messages, bots, events));
}

/** 방 이름 변경: 메시지 본문에서 찾은 것과 시스템 메시지에서 읽은 것을 합친다. */
function mergeRenames(ins: Insights, events: MemberEvent[]): Insights {
  const fromEvents = events
    .filter((e) => e.type === "rename")
    .map((e) => ({ name: e.name, dateKey: e.dateKey, author: e.actor ?? "" }));
  if (!fromEvents.length) return ins;
  const seen = new Set<string>();
  const renames = [...ins.renames, ...fromEvents]
    .sort((a, b) => (a.dateKey ?? "").localeCompare(b.dateKey ?? ""))
    .filter((r) => {
      const key = `${r.dateKey}|${r.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return { ...ins, renames };
}

const FOCUS_SLANG_TEXTS = 15;
const FOCUS_ORIGINS = 4;
const FOCUS_LAST_USES = 3;
const FOCUS_PAIRS = 3;

function excerptFocus(
  ins: Insights,
  people: MemberInsights,
  slang: SlangInsights,
): ExcerptFocus {
  const spread = slang.candidates.filter((c) => c.users.length >= 2);
  return {
    pairs: [...people.pairs.slice(0, FOCUS_PAIRS), ...people.unexpected].map(
      (p): [string, string] => [p.a, p.b],
    ),
    slangTexts: slang.candidates.slice(0, FOCUS_SLANG_TEXTS).map((c) => c.text),
    originIndexes: spread.slice(0, FOCUS_ORIGINS).map((c) => c.first.idx),
    lastUseIndexes: slang.candidates
      .filter((c) => slang.vanishedKeys.has(c.text))
      .slice(0, FOCUS_LAST_USES)
      .map((c) => c.last.idx),
    laughIndex: ins.longestLaugh?.msg.idx ?? null,
    emojis: slang.emoji.map((e) => e.emoji),
    addressTerms: slang.address.map((a) => a.term),
  };
}

export function* buildRoomWikiSteps(
  room: RoomProfile,
  messages: ChatMessage[],
  bots: BotSummary = NO_BOTS,
  events: MemberEvent[] = [],
): Steps<BuiltRoomWiki> {
  const baseIns = yield* scaled(computeInsightsSteps(messages), 0, 0.75);
  const ins = mergeRenames(baseIns, events);
  const slang = yield* scaled(computeSlangSteps(ins), 0.75, 0.87);
  const peakHours = new Map(room.participants.map((p) => [p.name, p.peakHour]));
  const people = yield* scaled(
    computeMemberSteps(ins, events, peakHours),
    0.87,
    0.95,
  );

  const notes: { text: string; ref?: NoteRef }[] = [];
  const ctx: BuildCtx = {
    room,
    ins,
    people,
    slang,
    events,
    title: room.roomTitle,
    bots,
    omitted: [],
    builtKeys: new Set(),
    fn: (text, ref) => {
      notes.push({ text, ref });
      return { t: "fn", n: notes.length };
    },
  };

  const built: WikiSec[] = [];
  const push = (sec: WikiSec | null) => {
    if (!sec) return;
    built.push(sec);
    ctx.builtKeys.add(sec.key);
  };
  for (let i = 0; i < MAIN_SECTIONS.length; i++) {
    push(MAIN_SECTIONS[i](ctx));
    yield 0.95 + (0.04 * (i + 1)) / MAIN_SECTIONS.length;
  }
  push(relatedSection(ctx));

  const sections: NumberedSec[] = built.map((sec, i) => ({
    key: sec.key,
    title: sec.title,
    id: `w-${sec.key}`,
    number: String(i + 1),
    subs: sec.subs.map((sub, j) => ({
      ...sub,
      id: `w-${sec.key}-${sub.key}`,
      number: `${i + 1}.${j + 1}`,
    })),
  }));

  // Resolve footnote links against the sections that were actually written, so a link
  // never points at an omitted paragraph.
  const subIndex = new Map<string, { id: string; label: string }>();
  sections.forEach((sec) =>
    sec.subs.forEach((sub) =>
      subIndex.set(`${sec.key}/${sub.key}`, {
        id: sub.id,
        label: `${sub.number} ${sub.title}`,
      }),
    ),
  );
  const resolved: WikiNote[] = notes.map(({ text, ref }) => {
    const link = ref ? subIndex.get(`${ref.sec}/${ref.sub}`) : undefined;
    return link ? { text, link } : { text };
  });

  yield 1;
  return {
    wiki: { sections, notes: resolved },
    focus: excerptFocus(ins, people, slang),
  };
}
