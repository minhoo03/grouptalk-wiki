import type { Rich, WikiSec } from "@/types/wiki";
import { formatTime } from "@/utils/format";
import type { DayStat, TimedMessage } from "../roomInsights";
import {
  BuildCtx,
  at,
  b,
  day,
  del,
  link,
  muted,
  n,
  p,
  say,
  section,
  ul,
  who,
} from "./builder";

function spikeDays(days: DayStat[]): { day: DayStat; ratio: number }[] {
  if (days.length < 5) return [];
  const sorted = [...days].map((d) => d.count).sort((a, c) => a - c);
  const median = sorted[Math.floor(sorted.length / 2)] || 1;
  return days
    .filter((d) => d.count >= 10 && d.count >= median * 3)
    .map((d) => ({ day: d, ratio: d.count / median }))
    .sort((a, c) => c.ratio - a.ratio);
}

const msgItem = (m: TimedMessage): Rich => [
  muted(`${at(m)} `),
  link(m.author),
  `: ${say(m.text, 60)}`,
];

export function episodeSection(ctx: BuildCtx): WikiSec | null {
  const { ins } = ctx;
  return section(ctx, "episodes", "주요 에피소드", [
    {
      key: "loudest",
      title: "가장 시끄러웠던 날",
      build: () => {
        const d = ins.busiestDay;
        if (!d) return null;
        const topAuthor = [...d.authors.entries()].sort(
          (a, c) => c[1] - a[1],
        )[0];
        return [
          p(
            `${day(d.key)}에는 하루 동안 ${n(d.count)}개의 메시지가 쏟아졌다.`,
            ...(topAuthor
              ? [
                  " 가장 말이 많았던 것은 ",
                  link(topAuthor[0]),
                  ` (${topAuthor[1]}개).`,
                ]
              : []),
            ...(ins.busiestTopWord
              ? [` 이날의 키워드는 '${ins.busiestTopWord}'.`]
              : []),
          ),
        ];
      },
    },
    {
      key: "quietest",
      title: "가장 조용했던 시기",
      build: () => {
        const g = ins.dayGaps[0];
        if (!g || g.days < 2) return null;
        const breaker = ins.timed.find((m) => m.dateKey === g.toKey);
        return [
          p(
            `${day(g.fromKey)} 이후 ${g.days}일 동안 아무도 말하지 않았다.`,
            ...(breaker
              ? [
                  " 침묵을 깬 것은 ",
                  link(breaker.author),
                  `의 ${say(breaker.text)}.`,
                ]
              : []),
          ),
        ];
      },
    },
    {
      key: "allnight",
      title: "새벽까지 이어진 대화",
      build: () => {
        const s = [...ins.sessions]
          .filter((x) => x.night >= 5)
          .sort((a, c) => c.night - a.night)[0];
        if (!s) return null;
        const start = ins.timed[s.start];
        const end = ins.timed[s.end];
        return [
          p(
            `${at(start)}에 시작된 대화는 새벽까지 이어져 ${s.count}개의 메시지가 오갔다. 마지막 메시지는 ${formatTime(end.hour, end.minute)}, `,
            ...who(end.author, "이/가"),
            ` 남긴 ${say(end.text)}.`,
          ),
        ];
      },
    },
    {
      key: "mediaFlood",
      title: "사진·이모티콘 폭주",
      build: () => {
        const d = [...ins.days].sort((a, c) => c.media - a.media)[0];
        if (!d || d.media < 3) return null;
        return [
          p(
            `${day(d.key)}에는 사진·동영상·이모티콘이 ${d.media}개 쏟아졌다. 이날 메시지의 ${Math.round((d.media / d.count) * 100)}%다.`,
          ),
        ];
      },
    },
    {
      key: "burst",
      title: "특정 유행어가 폭발한 날",
      build: () =>
        ins.wordBurst
          ? [
              p(
                `${day(ins.wordBurst.key)}에는 '${ins.wordBurst.word}'라는 말이 하루에만 ${ins.wordBurst.count}번 등장했다.`,
              ),
            ]
          : null,
    },
    {
      key: "absence",
      title: "장기 잠수와 복귀",
      build: () =>
        ins.personGaps.length
          ? [
              ul(
                ins.personGaps
                  .slice(0, 5)
                  .map(
                    (g): Rich => [
                      link(g.name),
                      ` - ${day(g.fromKey)} 이후 ${g.days}일간 잠수, ${day(g.toKey)}에 복귀`,
                    ],
                  ),
              ),
            ]
          : null,
    },
    {
      key: "allPresent",
      title: "모두가 등장한 날",
      build: () =>
        ins.allPresentDays.length
          ? [
              p(
                `${ins.members.length}명 전원이 같은 날 발언한 날은 ${ins.allPresentDays.length}일이다. 처음은 ${day(ins.allPresentDays[0])}, 가장 최근은 ${day(ins.allPresentDays[ins.allPresentDays.length - 1])}.`,
              ),
            ]
          : null,
    },
    {
      key: "other",
      title: "기타 기억할 만한 날",
      build: () => {
        const m = ins.longestMessage;
        if (!m || m.text.length < 40) return null;
        return [
          p(
            `${day(m.dateKey)}에는 `,
            ...who(m.author, "이/가"),
            ` 무려 ${m.text.length}자짜리 메시지를 남겼다. `,
            del("읽은 사람은 몇 명이었을까"),
          ),
        ];
      },
    },
  ]);
}

export function controversySection(ctx: BuildCtx): WikiSec | null {
  const { ins } = ctx;
  const spikes = spikeDays(ins.days);
  const longStops = ins.dayGaps.filter((g) => g.days >= 3);
  const deletedByDay = new Map<string, number>();
  ins.timed.forEach((m) => {
    if (m.kind === "deleted" && m.dateKey)
      deletedByDay.set(m.dateKey, (deletedByDay.get(m.dateKey) ?? 0) + 1);
  });
  const hasAny =
    spikes.length ||
    deletedByDay.size ||
    ins.misunderstandings.length ||
    longStops.length ||
    ins.rumors.length ||
    ins.corrections.length;

  return section(ctx, "controversy", "논란 및 사건·사고", [
    {
      key: "criteria",
      title: "작성 기준",
      build: () =>
        hasAny
          ? [
              p(
                "이 문단은 대화 기록에서 기계적으로 감지된 사건만 다룬다. 당사자의 의도나 앞뒤 맥락은 반영되지 않았으니 참고만 하자.",
              ),
            ]
          : null,
    },
    {
      key: "byDate",
      title: "날짜별 사건",
      build: () => {
        const events: { key: string; rich: Rich }[] = [];
        spikes.slice(0, 3).forEach((s) =>
          events.push({
            key: s.day.key,
            rich: [
              b(day(s.day.key)),
              ` - 평소의 ${s.ratio.toFixed(1)}배인 ${s.day.count}개 메시지 폭주`,
            ],
          }),
        );
        deletedByDay.forEach((c, k) =>
          events.push({ key: k, rich: [b(day(k)), ` - 삭제된 메시지 ${c}개`] }),
        );
        if (!events.length) return null;
        return [
          ul(
            events
              .sort((a, c) => a.key.localeCompare(c.key))
              .slice(0, 8)
              .map((e) => e.rich),
          ),
        ];
      },
    },
    {
      key: "misunderstanding",
      title: "오해가 발생한 대화",
      build: () =>
        ins.misunderstandings.length
          ? [
              p("해명성 표현이 등장한 메시지들이다."),
              ul(ins.misunderstandings.map(msgItem)),
            ]
          : null,
    },
    {
      key: "stops",
      title: "장기간 대화 중단",
      build: () =>
        longStops.length
          ? [
              ul(
                longStops
                  .slice(0, 3)
                  .map(
                    (g): Rich => [
                      b(`${g.days}일`),
                      ` - ${day(g.fromKey)} ~ ${day(g.toKey)}`,
                    ],
                  ),
              ),
            ]
          : null,
    },
    {
      key: "deleted",
      title: "삭제 메시지 관련 기록",
      build: () =>
        ins.media.deleted.length
          ? [
              p(
                `삭제된 메시지는 총 ${ins.mediaTotal.deleted}개다. 무슨 말이었는지는 영원한 비밀.`,
              ),
              ul(
                ins.media.deleted.map(
                  (r): Rich => [link(r.name), ` - ${r.value}개`],
                ),
              ),
            ]
          : null,
    },
    {
      key: "rumor",
      title: "확인되지 않은 이야기",
      build: () =>
        ins.rumors.length
          ? [ul(ins.rumors.map(msgItem)), p(del("카더라는 카더라일 뿐"))]
          : null,
    },
    {
      key: "correction",
      title: "정정 및 당사자 반론",
      build: () =>
        ins.corrections.length ? [ul(ins.corrections.map(msgItem))] : null,
    },
  ]);
}

