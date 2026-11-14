import type { Rich, WikiSec } from "@/types/wiki";
import {
  BuildCtx,
  at,
  b,
  link,
  say,
  section,
  ul,
  who,
} from "@/screens/home/utils/roomWiki/builder";

/**
 * 여담. 하위 목차 없이 글머리표 목록 하나로 둔다(제목 없는 하위 문단).
 * 규칙 기반으로는 통계에서 보이는 의외의 사실을 모으고, AI는 대화에서 찾은 소소한 이야기로 바꾼다.
 */
export function triviaSection(ctx: BuildCtx): WikiSec | null {
  const { ins, room } = ctx;
  return section(ctx, "trivia", "여담", [
    {
      key: TRIVIA_SUB_KEY,
      title: "",
      build: () => {
        const items: Rich[] = [];
        const top = ins.members[0]?.name;
        const least = ins.members[ins.members.length - 1]?.name;
        const longest = [...room.participants].sort(
          (a, c) => c.avgLength - a.avgLength,
        )[0];
        if (ins.members.length >= 3 && least && longest?.name === least)
          items.push([
            b("말은 적어도 할 땐 한다"),
            " — 발언량 꼴찌인 ",
            ...who(least, "이/가"),
            " 평균 메시지 길이는 1위다.",
          ]);
        if (
          top &&
          ins.starters[0] &&
          ins.starters[0].name !== top &&
          ins.sessions.length >= 3
        )
          items.push([
            b("수다왕과 시동왕은 다르다"),
            " — 발언량 1위는 ",
            link(top),
            "지만, 대화를 가장 많이 연 것은 ",
            link(ins.starters[0].name),
            "이다.",
          ]);
        if (top && ins.replySpeed[0] && ins.replySpeed[0].name !== top)
          items.push([
            b("답장 속도 1위"),
            " — 가장 답장이 빠른 사람은 수다왕이 아닌 ",
            link(ins.replySpeed[0].name),
            "이다.",
          ]);
        if (ins.repeatRun)
          items.push([
            b("연속 전송 기록"),
            " — ",
            ...who(ins.repeatRun.name, "이/가"),
            ` ${say(ins.repeatRun.text)}를 ${ins.repeatRun.count}번 연속으로 보낸 기록이 있다.`,
          ]);
        const first = ins.timed[0];
        const last = ins.timed[ins.timed.length - 1];
        if (first && last)
          items.push([
            b("최초·최후의 메시지"),
            ` — 최초는 ${at(first)} `,
            link(first.author),
            `의 ${say(first.text)}, 최후는 ${at(last)} `,
            link(last.author),
            `의 ${say(last.text)}다.`,
          ]);
        return items.length ? [ul(items)] : null;
      },
    },
  ]);
}

/** 여담의 유일한 하위 문단. applyProse가 AI 문단을 글머리표로 바꿀 때 이 key를 쓴다. */
export const TRIVIA_SUB_KEY = "stories";

export function relatedSection(ctx: BuildCtx): WikiSec | null {
  const { room } = ctx;
  return section(ctx, "related", "관련 문서", [
    {
      key: "members",
      title: "멤버별 상세 문서",
      build: () => [ul(room.participants.map((pp): Rich => [link(pp.name)]))],
    },
  ]);
}
