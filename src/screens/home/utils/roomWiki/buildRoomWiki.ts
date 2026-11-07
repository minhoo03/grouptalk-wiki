import type { ChatMessage, RoomProfile } from "@/types/chat";
import type {
  NoteRef,
  NumberedSec,
  RoomWiki,
  WikiNote,
  WikiSec,
} from "@/types/wiki";
import { computeInsightsSteps } from "../roomInsights";
import { Steps, runSync, scaled } from "../slicing";
import { BuildCtx } from "./builder";
import {
  historySection,
  namingSection,
  overviewSection,
} from "./sectionsIntro";
import { cultureSection, slangSection } from "./sectionsCulture";
import { memberSection } from "./sectionsPeople";
import { controversySection, episodeSection } from "./sectionsEvents";
import { relatedSection, triviaSection } from "./sectionsMisc";

/**
 * 나무위키 단체 문서의 일반적인 목차 순서를 따른다: 개요 → 명칭 → 역사 → 멤버 → 특징 → 유행어 → 사건 → 여담 → 관련 문서.
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
  triviaSection,
];

export function buildRoomWiki(
  room: RoomProfile,
  messages: ChatMessage[],
): RoomWiki {
  return runSync(buildRoomWikiSteps(room, messages));
}

export function* buildRoomWikiSteps(
  room: RoomProfile,
  messages: ChatMessage[],
): Steps<RoomWiki> {
  const ins = yield* scaled(computeInsightsSteps(messages), 0, 0.95);

  const notes: { text: string; ref?: NoteRef }[] = [];
  const ctx: BuildCtx = {
    room,
    ins,
    title: room.roomTitle,
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
  return { sections, notes: resolved };
}
