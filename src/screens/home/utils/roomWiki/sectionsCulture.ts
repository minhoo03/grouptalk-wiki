import type { Rich, WikiSec } from "@/types/wiki";
import {
  BuildCtx,
  at,
  b,
  day,
  del,
  dur,
  link,
  muted,
  p,
  pct,
  section,
  ul,
  who,
} from "./builder";

export function cultureSection(ctx: BuildCtx): WikiSec | null {
  const { ins } = ctx;
  return section(ctx, "culture", "방의 성격과 문화", [
    {
      key: "topics",
      title: "주요 대화 주제",
      build: () => {
        if (!ins.words.length) return null;
        return [
          p(
            "자주 나온 단어로 미루어 보아 주요 화제는 다음과 같다.",
            ctx.fn("단어 빈도로 추정한 것이며 실제 화제와 다를 수 있다.", {
              sec: "method",
              sub: "words",
            }),
          ),
          ul(
            ins.words.slice(0, 8).map((w): Rich => {
              const leader = ins.topicLeaders.find(
                (t) => t.word === w.word && t.name,
              );
              return [
                b(w.word),
                muted(` ${w.count}회`),
                ...(leader ? [" - 주로 ", link(leader.name)] : []),
              ];
            }),
          ),
        ];
      },
    },
    {
      key: "mood",
      title: "대화 분위기",
      build: () => {
        if (!ins.total) return null;
        const laughPct = pct(ins.typeTotals.laugh, ins.total);
        const avg = ins.textAvgLength;
        return [
          p(
            `전체 메시지의 ${laughPct}%에 웃음이 섞여 있어 ${laughPct >= 20 ? "전반적으로 가볍고 유쾌한" : "비교적 차분한"} 분위기다. 텍스트 메시지의 평균 길이는 ${avg.toFixed(1)}자로, ${avg < 12 ? "짧게 치고 빠지는 대화가 대부분이다" : "한 번에 길게 말하는 편이다"}. 물음표가 들어간 메시지는 ${pct(ins.typeTotals.question, ins.total)}%.`,
          ),
        ];
      },
    },
    {
      key: "rules",
      title: "암묵적인 규칙",
      build: () => {
        const items: Rich[] = [];
        const quiet = longestZeroRun(ins.hours);
        if (quiet && quiet.length >= 3 && quiet.length < 24)
          items.push([
            `${quiet.from}시부터 ${(quiet.to + 1) % 24}시 사이에는 아무도 말하지 않는다.`,
          ]);
        if (ins.replyMedianAll !== null)
          items.push([
            `누군가 말을 꺼내면 보통 ${dur(ins.replyMedianAll)} 안에 답이 온다.`,
          ]);
        const st = ins.starters[0];
        if (
          st &&
          ins.sessions.length >= 3 &&
          st.value / ins.sessions.length >= 0.4
        )
          items.push(["대화는 대체로 ", ...who(st.name, "이/가"), " 연다."]);
        if (ins.total && ins.typeTotals.short / ins.total >= 0.4)
          items.push([
            `메시지 10개 중 ${Math.round((ins.typeTotals.short / ins.total) * 10)}개는 5자 이하의 단답이다.`,
          ]);
        return items.length
          ? [p("기록으로 드러나는 이 방의 불문율은 다음과 같다."), ul(items)]
          : null;
      },
    },
    {
      key: "nightMorning",
      title: "새벽반과 아침반",
      build: () => {
        const nt = ins.nightRank[0];
        const mn = ins.morningRank[0];
        if (!nt && !mn) return null;
        const items: Rich[] = [];
        if (nt)
          items.push([
            b("새벽반"),
            muted(" (23시~5시)"),
            " - 반장 ",
            link(nt.name),
            ` (${nt.value}개)`,
          ]);
        if (mn)
          items.push([
            b("아침반"),
            muted(" (5시~9시)"),
            " - 반장 ",
            link(mn.name),
            ` (${mn.value}개)`,
          ]);
        return [ul(items)];
      },
    },
  ]);
}

export function slangSection(ctx: BuildCtx): WikiSec | null {
  const { ins, room } = ctx;
  return section(ctx, "slang", "상징·유행어", [
    {
      key: "top",
      title: "대표 유행어",
      build: () =>
        ins.phrases.length
          ? [
              ul(
                ins.phrases
                  .slice(0, 5)
                  .map(
                    (ph): Rich => [
                      b(`“${ph.text}”`),
                      muted(` ${ph.count}회`),
                      " - ",
                      ...ph.users
                        .slice(0, 2)
                        .flatMap((u, i) => [
                          i > 0 ? ", " : "",
                          link(u.name),
                          muted(`(${u.value})`),
                        ]),
                    ],
                  ),
              ),
            ]
          : null,
    },
    {
      key: "origin",
      title: "유행어의 기원",
      build: () =>
        ins.phrases.length
          ? [
              ul(
                ins.phrases.slice(0, 3).map((ph): Rich => {
                  const topUser = ph.users[0]?.name;
                  return [
                    b(`“${ph.text}”`),
                    ` - ${at(ph.first)}, `,
                    ...who(ph.first.author, "이/가"),
                    " 처음 사용했다.",
                    ...(topUser && topUser !== ph.first.author
                      ? [
                          " 이후 ",
                          ...who(topUser, "이/가"),
                          " 더 많이 쓰며 퍼뜨렸다.",
                        ]
                      : []),
                  ];
                }),
              ),
            ]
          : null,
    },
    {
      key: "habits",
      title: "멤버별 말버릇",
      build: () => {
        const rows = room.participants.filter(
          (pp) => (pp.catchphrases[0]?.count ?? 0) >= 2,
        );
        return rows.length
          ? [
              ul(
                rows.map(
                  (pp): Rich => [
                    link(pp.name),
                    ` - “${pp.catchphrases[0].word}”`,
                    muted(` ${pp.catchphrases[0].count}회`),
                  ],
                ),
              ),
            ]
          : null;
      },
    },
    {
      key: "nicknames",
      title: "별명과 호칭",
      build: () => [
        p(
          "대화 통계를 바탕으로 붙은 별명은 다음과 같다.",
          ctx.fn("실제로 불리는 별명이 아니라 집계 결과로 붙인 것이다.", {
            sec: "members",
            sub: "traits",
          }),
        ),
        ul(
          room.participants.map(
            (pp): Rich => [
              link(pp.name),
              " - ",
              pp.badges.map((bd) => bd.name).join(", "),
            ],
          ),
        ),
      ],
    },
    {
      key: "vanished",
      title: "사라진 유행어",
      build: () =>
        ins.vanished.length
          ? [
              ul(
                ins.vanished.map(
                  (v): Rich => [
                    b(v.word),
                    ` - 총 ${v.count}회, 마지막 목격 ${day(v.lastKey)}`,
                  ],
                ),
              ),
              p(del("언젠가 다시 돌아올지도 모른다")),
            ]
          : null,
    },
  ]);
}

function longestZeroRun(
  hist: number[],
): { from: number; to: number; length: number } | null {
  let best: { from: number; to: number; length: number } | null = null;
  let start = -1;
  for (let i = 0; i < 48; i++) {
    const zero = hist[i % 24] === 0;
    if (zero && start < 0) start = i;
    if ((!zero || i === 47) && start >= 0) {
      const end = zero ? i : i - 1;
      const length = Math.min(end - start + 1, 24);
      if (!best || length > best.length)
        best = { from: start % 24, to: end % 24, length };
      start = -1;
    }
  }
  return best;
}
