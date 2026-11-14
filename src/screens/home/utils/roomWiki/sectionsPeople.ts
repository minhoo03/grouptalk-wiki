import type { Rich, WikiSec } from "@/types/wiki";
import { daysBetween } from "@/screens/home/utils/chatMetrics";
import type { Ranked } from "@/screens/home/utils/roomInsights";
import {
  BuildCtx,
  b,
  day,
  link,
  muted,
  p,
  section,
  ul,
} from "@/screens/home/utils/roomWiki/builder";

export function memberSection(ctx: BuildCtx): WikiSec | null {
  const { ins, room } = ctx;
  const lastKey = (name: string) =>
    room.participants.find((pp) => pp.name === name)?.lastMessage?.dateKey ??
    null;
  const isFormer = (name: string) => {
    const k = lastKey(name);
    return (
      ins.spanDays > 60 &&
      Boolean(k && ins.endKey && daysBetween(k, ins.endKey) > 30)
    );
  };

  return section(ctx, "members", "멤버", [
    {
      key: "current",
      title: "현재 멤버",
      build: () => {
        const current = room.participants.filter((pp) => !isFormer(pp.name));
        return current.length
          ? [
              ul(
                current.map(
                  (pp): Rich => [
                    link(pp.name),
                    muted(
                      ` - 지분 ${pp.share}%, 마지막 발언 ${day(pp.lastMessage?.dateKey ?? null)}`,
                    ),
                  ],
                ),
              ),
            ]
          : null;
      },
    },
    {
      key: "former",
      title: "이전 멤버",
      build: () => {
        const former = room.participants.filter((pp) => isFormer(pp.name));
        return former.length
          ? [
              p(
                "마지막 기록 기준 30일 넘게 발언이 없는 멤버.",
                ctx.fn("퇴장 기록이 아니라 발언 공백으로 판단했다.", {
                  sec: "stats",
                  sub: "gaps",
                }),
              ),
              ul(
                former.map(
                  (pp): Rich => [
                    link(pp.name),
                    muted(` - 마지막 발언 ${day(lastKey(pp.name))}`),
                  ],
                ),
              ),
            ]
          : null;
      },
    },
    {
      key: "roles",
      title: "멤버별 역할",
      build: () => {
        const dims: { label: string; rank: Ranked[] }[] = [
          { label: "대화 시동꾼", rank: ins.starters },
          { label: "마무리 담당", rank: ins.enders },
          {
            label: "리액션 담당",
            rank: ins.types.find((t) => t.key === "laugh")?.ranking ?? [],
          },
          {
            label: "질문 담당",
            rank: ins.types.find((t) => t.key === "question")?.ranking ?? [],
          },
          { label: "사진 담당", rank: ins.media.photo },
          { label: "정보 공유 담당", rank: ins.media.link },
          {
            label: "장문 담당",
            rank: ins.types.find((t) => t.key === "long")?.ranking ?? [],
          },
        ];

        const items = ins.members.map((m): Rich => {
          let best = { label: "청취 담당", score: 0 };
          dims.forEach((d) => {
            const max = d.rank[0]?.value ?? 0;
            const mine = d.rank.find((r) => r.name === m.name)?.value ?? 0;
            const score = max ? mine / max : 0;
            if (score > best.score) best = { label: d.label, score };
          });
          return [link(m.name), " - ", b(best.label)];
        });
        return [
          p(
            "각 멤버가 단톡방 안에서 상대적으로 가장 두드러지는 역할을 골랐다.",
          ),
          ul(items),
        ];
      },
    },
    {
      key: "chemistry",
      title: "멤버 간 케미",
      build: () =>
        ins.pairs.length
          ? [
              ul(
                ins.pairs
                  .slice(0, 3)
                  .map(
                    (pr): Rich => [
                      link(pr.a),
                      " × ",
                      link(pr.b),
                      ` - 서로 ${pr.count}번 말을 주고받았다.`,
                    ],
                  ),
              ),
            ]
          : null,
    },
  ]);
}

