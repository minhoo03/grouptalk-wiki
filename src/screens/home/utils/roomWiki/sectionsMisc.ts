import type { Rich, WikiSec } from "@/types/wiki";
import {
  BuildCtx,
  at,
  b,
  link,
  p,
  say,
  section,
  ul,
  who,
} from "./builder";

export function triviaSection(ctx: BuildCtx): WikiSec | null {
  const { ins, room } = ctx;
  return section(ctx, "trivia", "여담", [
    {
      key: "surprise",
      title: "예상과 달랐던 통계",
      build: () => {
        const items: Rich[] = [];
        const top = ins.members[0]?.name;
        const least = ins.members[ins.members.length - 1]?.name;
        const longest = [...room.participants].sort(
          (a, c) => c.avgLength - a.avgLength,
        )[0];
        if (ins.members.length >= 3 && least && longest?.name === least)
          items.push([
            "발언량 꼴찌인 ",
            ...who(least, "이/가"),
            " 평균 메시지 길이는 1위다. 말은 적어도 할 땐 한다.",
          ]);
        if (
          top &&
          ins.starters[0] &&
          ins.starters[0].name !== top &&
          ins.sessions.length >= 3
        )
          items.push([
            "발언량 1위는 ",
            link(top),
            "지만, 대화를 가장 많이 연 것은 ",
            link(ins.starters[0].name),
            "이다.",
          ]);
        if (top && ins.replySpeed[0] && ins.replySpeed[0].name !== top)
          items.push([
            "가장 답장이 빠른 사람은 수다왕이 아닌 ",
            link(ins.replySpeed[0].name),
            "이다.",
          ]);
        return items.length ? [ul(items)] : null;
      },
    },
    {
      key: "oddity",
      title: "집계 중 발견한 특이사항",
      build: () =>
        ins.repeatRun
          ? [
              p(
                ...who(ins.repeatRun.name, "이/가"),
                ` ${say(ins.repeatRun.text)}를 ${ins.repeatRun.count}번 연속으로 보낸 기록이 있다.`,
              ),
            ]
          : null,
    },
    {
      key: "firstLast",
      title: "최초·최후의 메시지",
      build: () => {
        const first = ins.timed[0];
        const last = ins.timed[ins.timed.length - 1];
        if (!first || !last) return null;
        return [
          ul([
            [
              b("최초"),
              ` - ${at(first)}, `,
              link(first.author),
              `: ${say(first.text)}`,
            ],
            [
              b("최후"),
              ` - ${at(last)}, `,
              link(last.author),
              `: ${say(last.text)}`,
            ],
          ]),
        ];
      },
    },
  ]);
}

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
