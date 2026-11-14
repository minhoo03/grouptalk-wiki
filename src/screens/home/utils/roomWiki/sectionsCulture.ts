import type { Rich, WikiSec } from "@/types/wiki";
import { inc, rank } from "@/screens/home/utils/collections";
import type {
  Insights,
  MediaKey,
  Ranked,
} from "@/screens/home/utils/insights.types";
import {
  BuildCtx,
  at,
  b,
  day,
  del,
  dur,
  hours,
  link,
  muted,
  n,
  p,
  pct,
  section,
  table,
  ul,
  who,
} from "@/screens/home/utils/roomWiki/builder";

/** 분위기 지표용 표현. 비율을 가늠하는 용도라 목록이 완전하지 않다. */
const PROFANITY = /ㅅㅂ|ㅆㅂ|시발|씨발|ㅈㄴ|존나|졸라|ㅂㅅ|병신|개새/;
const EXCLAMATION = /!|헐|대박|미쳤|와{2,}/;
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
/** 월요일부터 보여 준다. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
/** 링크를 올린 뒤 이 시간 안에 다른 사람이 말하면 반응이 있었던 것으로 본다. */
const LINK_REACTION_MINUTES = 5;
const MEDIA_LABELS: Partial<Record<MediaKey, string>> = {
  photo: "사진",
  video: "동영상",
  emoticon: "이모티콘",
  link: "링크",
};
const URL_HOST = /https?:\/\/(?:www\.)?([^/\s?#]+)/i;

/** 같은 사람이 끊기지 않고 이어 보낸 메시지 수의 평균 */
function averageRun(ins: Insights) {
  let runs = 0;
  ins.timed.forEach((m, i) => {
    if (i === 0 || ins.timed[i - 1].author !== m.author) runs += 1;
  });
  return runs ? ins.timed.length / runs : 0;
}

/** 링크 도메인 순위와, 링크 뒤 LINK_REACTION_MINUTES 안에 다른 사람이 말한 비율 */
function linkStats(ins: Insights) {
  const domains = new Map<string, number>();
  let total = 0;
  let reacted = 0;
  ins.timed.forEach((m, i) => {
    if (!m.link) return;
    total += 1;
    const host = URL_HOST.exec(m.text)?.[1]?.toLowerCase();
    if (host) inc(domains, host);
    const reply = ins.timed
      .slice(i + 1, i + 20)
      .find((next) => next.author !== m.author);
    if (
      reply &&
      m.ts !== null &&
      reply.ts !== null &&
      reply.ts - m.ts <= LINK_REACTION_MINUTES * 60_000
    )
      reacted += 1;
  });
  return { domains: rank(domains), total, reacted };
}

const share = (count: number, total: number) => `${pct(count, total)}%`;

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
        const texts = ins.timed.filter((m) => m.kind === "text");
        const profanity = texts.filter((m) => PROFANITY.test(m.text)).length;
        const exclamation = texts.filter((m) => EXCLAMATION.test(m.text)).length;
        const laughers = [...ctx.room.participants]
          .filter((person) => person.messageCount >= 20)
          .sort(
            (a, c) =>
              c.laughCount / c.messageCount - a.laughCount / a.messageCount,
          )
          .slice(0, 3);
        const items: Rich[] = [
          [`비속어가 섞인 메시지 ${share(profanity, texts.length)}, 감탄사·느낌표가 섞인 메시지 ${share(exclamation, texts.length)}.`],
          [`한 사람이 끊기지 않고 이어 보내는 메시지는 평균 ${averageRun(ins).toFixed(1)}개.`],
        ];
        if (ins.replyMedianAll !== null)
          items.push([`다른 사람의 말에 답하기까지 걸리는 시간의 중앙값은 ${dur(ins.replyMedianAll)}.`]);
        if (laughers.length)
          items.push([
            "웃음 비율이 높은 멤버: ",
            ...laughers.flatMap((person, i): Rich => [
              i > 0 ? ", " : "",
              link(person.name),
              ` ${share(person.laughCount, person.messageCount)}`,
            ]),
          ]);
        return [
          p(
            `전체 메시지의 ${laughPct}%에 웃음이 섞여 있어 ${laughPct >= 20 ? "전반적으로 가볍고 유쾌한" : "비교적 차분한"} 분위기다. 텍스트 메시지의 평균 길이는 ${avg.toFixed(1)}자로, ${avg < 12 ? "짧게 치고 빠지는 대화가 대부분이다" : "한 번에 길게 말하는 편이다"}. 물음표가 들어간 메시지는 ${pct(ins.typeTotals.question, ins.total)}%.`,
          ),
          ul(items),
        ];
      },
    },
    {
      key: "rules",
      title: "암묵적인 규칙 및 관행",
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
      key: "media",
      title: "사진·이모티콘 및 링크 공유 문화",
      build: () => {
        const kinds = (Object.keys(MEDIA_LABELS) as MediaKey[]).filter(
          (kind) => ins.mediaTotal[kind] > 0,
        );
        if (!kinds.length && !ins.emojiTop.length) return null;
        const items: Rich[] = kinds.map((kind) => {
          const leader: Ranked | undefined = ins.media[kind][0];
          return [
            b(MEDIA_LABELS[kind] ?? kind),
            ` ${n(ins.mediaTotal[kind])}개 (전체의 ${share(ins.mediaTotal[kind], ins.total)})`,
            ...(leader
              ? [" - 가장 많이 올린 사람 ", link(leader.name), ` ${n(leader.value)}개`]
              : []),
          ];
        });
        if (ins.emojiTop.length)
          items.push([
            b("이모지 상위"),
            ` ${ins.emojiTop
              .slice(0, 10)
              .map((e) => `${e.word}(${n(e.count)})`)
              .join(" ")}`,
          ]);
        const links = linkStats(ins);
        if (links.total) {
          if (links.domains.length)
            items.push([
              b("링크 출처"),
              ` ${links.domains
                .slice(0, 5)
                .map((d) => `${d.name}(${n(d.value)})`)
                .join(", ")}`,
            ]);
          items.push([
            b("링크 반응"),
            ` 링크를 올린 뒤 ${LINK_REACTION_MINUTES}분 안에 다른 사람이 답한 비율 ${share(links.reacted, links.total)}`,
          ]);
        }
        return [ul(items)];
      },
    },
    {
      key: "rhythm",
      title: "활동 리듬 및 주력 시간대",
      build: () => {
        if (!ins.total) return null;
        const weekdayRows = WEEKDAY_ORDER.filter(
          (w) => ins.weekdayDays[w] > 0,
        ).map((w): Rich[] => [
          [`${WEEKDAY_LABELS[w]}요일`],
          [(ins.weekday[w] / ins.weekdayDays[w]).toFixed(1)],
        ]);
        const bandItems = ins.bands
          .filter((band) => band.count > 0)
          .map((band): Rich => [
            b(band.label),
            muted(` (${band.range})`),
            ` ${share(band.count, ins.total)}`,
            ...(band.top ? [" - 주도 ", link(band.top)] : []),
          ]);
        const nt = ins.nightRank[0];
        const mn = ins.morningRank[0];
        if (nt)
          bandItems.push([
            b("새벽 반장"),
            muted(" (23시~5시)"),
            " ",
            link(nt.name),
            ` ${n(nt.value)}개`,
          ]);
        if (mn)
          bandItems.push([
            b("아침 반장"),
            muted(" (5시~9시)"),
            " ",
            link(mn.name),
            ` ${n(mn.value)}개`,
          ]);
        return [
          p(
            `평일 일평균 메시지는 ${ins.weekdayAvg.toFixed(1)}개, 주말은 ${ins.weekendAvg.toFixed(1)}개다.`,
          ),
          ...(weekdayRows.length >= 2
            ? [table(["요일", "일평균 메시지"], weekdayRows)]
            : []),
          hours(ins.hours, "시간대별 메시지 수"),
          ...(bandItems.length ? [ul(bandItems)] : []),
        ];
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
