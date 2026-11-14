import type { Block, Rich, WikiSec } from "@/types/wiki";
import { formatTime } from "@/utils/format";
import type {
  Insights,
  TimedMessage,
} from "@/screens/home/utils/roomInsights";
import {
  BuildCtx,
  at,
  b,
  day,
  del,
  dialogueAround,
  link,
  muted,
  n,
  p,
  say,
  section,
  ul,
  who,
} from "@/screens/home/utils/roomWiki/builder";

/** 해명·소문·정정 메시지를 앞뒤 대화와 함께 보여 준다(최대 max건). */
function contextCases(
  ins: Insights,
  messages: TimedMessage[],
  max = 2,
): Block[] {
  return messages.slice(0, max).flatMap((m): Block[] => [
    p(muted(`${at(m)} `), link(m.author), `의 ${say(m.text, 60)} 전후 대화`),
    dialogueAround(ins, m.idx),
  ]);
}

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
        const keyword = ins.busiestTopWord;
        const scene = ins.timed.find(
          (m) =>
            m.dateKey === d.key &&
            (keyword ? m.text.includes(keyword) : true),
        );
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
          ...(scene ? [dialogueAround(ins, scene.idx, 2, 5)] : []),
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
          ...(breaker ? [dialogueAround(ins, breaker.idx, 0, 5)] : []),
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
          dialogueAround(ins, end.idx, 5, 0),
        ];
      },
    },
    {
      key: "burst",
      title: "특정 유행어가 폭발한 날",
      build: () => {
        const burst = ins.wordBurst;
        if (!burst) return null;
        const first = ins.timed.find(
          (m) => m.dateKey === burst.key && m.text.includes(burst.word),
        );
        return [
          p(
            `${day(burst.key)}에는 '${burst.word}'라는 말이 하루에만 ${burst.count}번 등장했다. 처음 나온 장면은 다음과 같다.`,
          ),
          ...(first ? [dialogueAround(ins, first.idx, 2, 5)] : []),
        ];
      },
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
  const longStops = ins.dayGaps.filter((g) => g.days >= 3);
  const deletedByDay = new Map<string, number>();
  ins.timed.forEach((m) => {
    if (m.kind === "deleted" && m.dateKey)
      deletedByDay.set(m.dateKey, (deletedByDay.get(m.dateKey) ?? 0) + 1);
  });
  const hasAny =
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
      key: "misunderstanding",
      title: "오해가 발생한 대화",
      build: () =>
        ins.misunderstandings.length
          ? [
              p("해명성 표현이 등장한 대화다. 앞뒤 흐름을 함께 옮긴다."),
              ...contextCases(ins, ins.misunderstandings),
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
          ? [...contextCases(ins, ins.rumors), p(del("카더라는 카더라일 뿐"))]
          : null,
    },
    {
      key: "correction",
      title: "정정 및 당사자 반론",
      build: () =>
        ins.corrections.length ? contextCases(ins, ins.corrections) : null,
    },
  ]);
}

