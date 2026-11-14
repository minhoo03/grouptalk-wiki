import type { Rich, WikiSec } from "@/types/wiki";
import { josa } from "@/utils/korean";
import { roomReference } from "@/screens/home/utils/chatMetrics";
import {
  bucketOf,
  type Insights,
  type TimedMessage,
} from "@/screens/home/utils/roomInsights";
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
  pct,
  say,
  section,
  table,
  ul,
  who,
} from "@/screens/home/utils/roomWiki/builder";

/** 기본 정보 표에서 AI가 대화 내용을 읽고 채우는 행. applyProse가 이 이름으로 행을 찾는다. */
export const OVERVIEW_INFO_LABELS = {
  relationship: "멤버 관계",
  topics: "주요 화제",
  mood: "분위기",
  peak: "전성기",
} as const;

const INFO_MEMBER_NAMES = 5;

/** 활동량 1위 구간(일평균 기준). 기록이 며칠만 걸친 짧은 구간은 비교에서 뺀다. */
function findPeakBucket(ins: Insights): number {
  const minDays = MIN_COMPARABLE_DAYS[ins.bucketUnit];
  let peakIdx = -1;
  ins.buckets.forEach((bk, i) => {
    const comparable = bk.days >= minDays && bk.count > 0;
    if (comparable && (peakIdx < 0 || bk.perDay > ins.buckets[peakIdx].perDay))
      peakIdx = i;
  });
  return peakIdx;
}

/** 구간 안에서 실제로 대화가 있었던 첫날과 마지막 날 */
function bucketActiveRange(ins: Insights, bucketIdx: number) {
  const key = ins.buckets[bucketIdx].key;
  const keys = ins.days
    .map((d) => d.key)
    .filter((k) => bucketOf(k, ins.bucketUnit).key === key);
  return keys.length ? { from: keys[0], to: keys[keys.length - 1] } : null;
}

function membersText(ctx: BuildCtx) {
  const { ins, bots } = ctx;
  const names = ins.members.slice(0, INFO_MEMBER_NAMES).map((m) => m.name);
  const rest = ins.members.length - names.length;
  const botText = bots.kept.length
    ? `봇 포함: ${bots.kept.join(", ")}`
    : bots.excluded.length
      ? `봇 ${bots.excluded.length}개 제외`
      : "봇 없음";
  return `${ins.members.length}명 (${names.join(", ")}${rest > 0 ? ` 외 ${rest}명` : ""} · ${botText})`;
}

/** AI가 분위기를 채우지 못했을 때 쓰는 통계 기반 키워드 */
function moodFallback(ctx: BuildCtx): string {
  const { room, ins } = ctx;
  const sum = (pick: (person: (typeof room.participants)[number]) => number) =>
    room.participants.reduce((total, person) => total + pick(person), 0);
  const ratio = (count: number) => (ins.total ? count / ins.total : 0);
  const laugh = ratio(sum((person) => person.laughCount));
  const keywords = [
    laugh >= 0.25 ? "웃음 폭발" : laugh >= 0.1 ? "유쾌함" : null,
    ratio(sum((person) => person.nightCount)) >= 0.2 ? "야행성" : null,
    ratio(sum((person) => person.photoCount + person.emoticonCount)) >= 0.15
      ? "사진·이모티콘 공유"
      : null,
    ratio(sum((person) => person.questionCount)) >= 0.15 ? "질문 많음" : null,
    "일상 공유",
    "잔잔함",
  ].filter((keyword): keyword is string => keyword !== null);
  return keywords.slice(0, 3).join(", ");
}

function signedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value}%`;
}

export function overviewSection(ctx: BuildCtx): WikiSec | null {
  const { ins, title, room } = ctx;
  const groupName = `${ins.members.length}인 모임`;

  return section(ctx, "overview", "개요", [
    {
      key: "intro",
      title: "한 줄 소개",
      // AI가 쓰지 못하면 남는 문장. AI는 [관계] + [핵심 행위] + [정의] 공식으로 다시 쓴다.
      build: () => [
        p(b(`${groupName}이 ${n(ins.total)}개의 메시지로 일상을 나눠 온 단톡방`)),
        p(del("요약하면 결국 수다방이다")),
      ],
    },
    {
      key: "info",
      title: "기본 정보",
      build: () => {
        if (!ins.startKey || !ins.endKey) return null;
        const peakIdx = findPeakBucket(ins);
        const peakRange = peakIdx >= 0 ? bucketActiveRange(ins, peakIdx) : null;
        const topics = room.topWords.slice(0, 3).map((w) => w.word);
        const rows: Rich[][] = [
          [["방 이름"], [title]],
          [["인원"], [membersText(ctx)]],
          [
            ["기록 기간"],
            [`${day(ins.startKey)} ~ ${day(ins.endKey)} (${n(ins.spanDays)}일)`],
          ],
          [
            ["활동일"],
            [`${n(ins.activeDays)}일 (전체 기간의 ${pct(ins.activeDays, ins.spanDays)}%)`],
          ],
          [["총 메시지"], [`${n(ins.total)}개`]],
          [
            ["하루 평균"],
            [
              `${ins.activeDays ? (ins.total / ins.activeDays).toFixed(1) : 0}개 (활동일 기준)`,
            ],
          ],
          [[OVERVIEW_INFO_LABELS.relationship], [groupName]],
        ];
        if (topics.length)
          rows.push([
            [OVERVIEW_INFO_LABELS.topics],
            [topics.join(", "), muted(" (자주 쓴 단어 기준)")],
          ]);
        rows.push([[OVERVIEW_INFO_LABELS.mood], [moodFallback(ctx)]]);
        if (peakIdx >= 0 && peakRange)
          // 첫 조각은 시기명(AI가 바꿀 수 있다), 둘째 조각은 기간이다.
          rows.push([
            [OVERVIEW_INFO_LABELS.peak],
            [
              ins.buckets[peakIdx].label,
              ` (${day(peakRange.from)} ~ ${day(peakRange.to)})`,
            ],
          ]);
        return [table(["항목", "내용"], rows)];
      },
    },
    {
      key: "status",
      title: "현재 상태",
      build: () => {
        // "현재" = 마지막 기록일 기준 최근 30일. 달력상 이번 달이 아니다.
        const recent = ins.recent;
        if (!recent) return null;
        const sentences = [
          `마지막 기록일인 ${day(recent.toKey)} 기준 최근 ${recent.days}일(${day(recent.fromKey)} ~ ${day(recent.toKey)}) 동안 메시지 ${n(recent.count)}개가 오갔다.`,
        ];
        let dropped = false;
        if (recent.prevCount === null) {
          sentences.push(
            `기록이 ${recent.days * 2}일보다 짧아 직전 ${recent.days}일과는 비교할 수 없다.`,
          );
        } else if (recent.prevCount === 0) {
          sentences.push(`직전 ${recent.days}일에는 메시지가 한 개도 없었다.`);
        } else {
          const change = Math.round(
            ((recent.count - recent.prevCount) / recent.prevCount) * 100,
          );
          dropped = change <= -40;
          sentences.push(
            `직전 ${recent.days}일(${n(recent.prevCount)}개) 대비 ${signedPercent(change)}${change === 0 ? "로 같은 수준이다." : change > 0 ? " 늘었다." : " 줄었다."}`,
          );
        }
        if (recent.topWords.length)
          sentences.push(
            `이 기간에 자주 나온 단어는 ${recent.topWords.slice(0, 3).join(", ")}다.`,
          );
        return [
          p(
            sentences.join(" "),
            ...(dropped
              ? [" ", del("조용해진 게 아니라 다들 바쁜 것뿐이다")]
              : []),
          ),
        ];
      },
    },
  ]);
}

export function namingSection(ctx: BuildCtx): WikiSec | null {
  const { ins, title } = ctx;
  return section(ctx, "naming", "명칭", [
    {
      key: "origin",
      title: "이름의 유래",
      // 근거가 없어도 하위 문단을 남겨, AI가 "기록에 남아 있지 않다"와 이름에서 읽히는 정체성을 쓸 자리를 둔다.
      build: () => {
        const mentions =
          title.length >= 2
            ? ins.timed.filter((m) => m.text.includes(title))
            : [];
        const naming = [...ins.renames].reverse().find((r) => r.name === title);
        const blocks = [];
        if (naming)
          blocks.push(
            p(
              `현재 이름 '${title}'${josa(title, "은/는")} ${day(naming.dateKey)}에 `,
              ...who(naming.author, "이/가"),
              " 붙인 이름이다.",
            ),
          );
        else
          blocks.push(p("최초 명명 경위는 기록에 남아 있지 않다."));
        if (mentions.length) {
          const first = mentions[0];
          blocks.push(
            p(
              `대화 중 '${title}'이라는 이름이 직접 언급된 것은 ${mentions.length}회다. 기록상 첫 언급은 ${at(first)}, `,
              ...who(first.author, "이/가"),
              ` 남긴 ${say(first.text)}이다.`,
            ),
          );
        }
        return blocks;
      },
    },
    {
      key: "renames",
      title: "역대 방 이름",
      build: () =>
        ins.renames.length
          ? [
              p("대화 기록에 남은 방 이름 변경 내역은 다음과 같다."),
              ul([
                ...ins.renames.map((r): Rich => [
                  `${day(r.dateKey)}: `,
                  b(r.name),
                  ` (${r.author} 변경)`,
                ]),
                [b(title), muted(" (현재)")],
              ]),
            ]
          : [
              p(
                "기록 기간 내 방 이름이 변경된 이력은 확인되지 않으며, 단일 명칭으로 쭉 유지되어 왔다.",
              ),
            ],
    },
    {
      key: "aliases",
      title: "별칭 및 줄임말",
      // 규칙 기반으로는 방을 가리키는 표현 후보만 센다. 별칭인지, 어떤 맥락인지는 AI가 발췌를 읽고 쓴다.
      build: () => {
        const found = new Map<string, { count: number; first: TimedMessage }>();
        for (const m of ins.timed) {
          if (m.kind !== "text") continue;
          const phrase = roomReference(m.text);
          if (!phrase) continue;
          const entry = found.get(phrase);
          if (entry) entry.count += 1;
          else found.set(phrase, { count: 1, first: m });
        }
        if (!found.size)
          return [
            p(
              "단톡방 자체를 가리키는 별도의 줄임말이나 별칭은 기록에서 확인되지 않는다.",
            ),
          ];
        return [
          p("대화에서 이 방을 가리킬 때 쓰인 표현은 다음과 같다."),
          ul(
            [...found.entries()]
              .sort((a, c) => c[1].count - a[1].count)
              .slice(0, ALIAS_LIMIT)
              .map(([phrase, { count, first }]): Rich => [
                b(phrase),
                ` ${n(count)}회. 첫 사용은 ${at(first)}, `,
                ...who(first.author, "이/가"),
                ` 남긴 ${say(first.text)}.`,
              ]),
          ),
        ];
      },
    },
  ]);
}

const ALIAS_LIMIT = 8;

/** 역사 문단을 나누는 최대 시기 수. 구간(월·주·일)이 더 많으면 이웃한 구간을 묶는다. */
const MAX_ERAS = 6;
/** 일평균 비교에서 빼는 짧은 구간 기준. 기록이 며칠만 걸친 첫·마지막 달(주)이 일평균으로 부풀려지는 것을 막는다. */
const MIN_COMPARABLE_DAYS = { 월: 7, 주: 3, 일: 1 } as const;
const ERA_TOP_SPEAKERS = 3;

type Era = {
  key: string;
  title: string;
  fromKey: string;
  toKey: string;
  count: number;
  days: number;
  tags: string[];
};

/**
 * 기록 기간을 최대 MAX_ERAS개의 시기로 나눈다.
 * 시기의 성격(전성기·침체기·부활기)은 총량이 아니라 일평균으로 판단해 태그로만 붙이고,
 * 무슨 일이 있었는지는 서술(AI)이 그 시기의 대화 장면을 읽고 쓴다.
 */
function groupEras(ins: Insights): Era[] {
  const B = ins.buckets;
  if (!B.length) return [];
  const minDays = MIN_COMPARABLE_DAYS[ins.bucketUnit];
  const comparable = (i: number) => B[i].days >= minDays && B[i].count > 0;

  const peakIdx = findPeakBucket(ins);
  let troughIdx = -1;
  if (peakIdx >= 0)
    for (let i = peakIdx + 1; i < B.length; i++)
      if (
        comparable(i) &&
        B[i].perDay < B[peakIdx].perDay * 0.5 &&
        (troughIdx < 0 || B[i].perDay < B[troughIdx].perDay)
      )
        troughIdx = i;
  let revivalIdx = -1;
  if (troughIdx >= 0)
    for (let i = troughIdx + 1; i < B.length; i++)
      if (comparable(i) && B[i].perDay >= B[troughIdx].perDay * 1.5) {
        revivalIdx = i;
        break;
      }

  // 활동한 날짜를 구간 index로 묶어 시기별 실제 기록 범위를 구한다.
  const bucketIndex = new Map(B.map((bk, i) => [bk.key, i]));
  const activeByBucket = B.map(() => [] as string[]);
  for (const d of ins.days) {
    const i = bucketIndex.get(bucketOf(d.key, ins.bucketUnit).key);
    if (i !== undefined) activeByBucket[i].push(d.key);
  }

  const size = Math.ceil(B.length / MAX_ERAS);
  const eras: Era[] = [];
  for (let start = 0; start < B.length; start += size) {
    const idx = Array.from(
      { length: Math.min(size, B.length - start) },
      (_, k) => start + k,
    );
    const activeDays = idx.flatMap((i) => activeByBucket[i]).sort();
    if (!activeDays.length) continue;
    const tags: string[] = [];
    if (idx.includes(peakIdx)) tags.push("전성기");
    if (idx.includes(troughIdx)) tags.push("침체기");
    if (idx.includes(revivalIdx)) tags.push("부활기");
    const firstLabel = B[idx[0]].label;
    const lastLabel = B[idx[idx.length - 1]].label;
    eras.push({
      key: `era${eras.length + 1}`,
      title:
        ins.bucketUnit === "월"
          ? firstLabel === lastLabel
            ? firstLabel
            : `${firstLabel} ~ ${lastLabel}`
          : activeDays[0] === activeDays[activeDays.length - 1]
            ? day(activeDays[0])
            : `${day(activeDays[0])} ~ ${day(activeDays[activeDays.length - 1])}`,
      fromKey: activeDays[0],
      toKey: activeDays[activeDays.length - 1],
      count: idx.reduce((s, i) => s + B[i].count, 0),
      days: idx.reduce((s, i) => s + B[i].days, 0),
      tags,
    });
  }
  return eras;
}

function eraBlocks(ins: Insights, era: Era, index: number, total: number) {
  const speakers = new Map<string, number>();
  for (const m of ins.timed) {
    if (!m.dateKey || m.dateKey < era.fromKey || m.dateKey > era.toKey)
      continue;
    speakers.set(m.author, (speakers.get(m.author) ?? 0) + 1);
  }
  const leaders = [...speakers.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, ERA_TOP_SPEAKERS)
    .map(([name]) => name);
  const busiest = ins.days
    .filter((d) => d.key >= era.fromKey && d.key <= era.toKey)
    .reduce<(typeof ins.days)[number] | null>(
      (best, d) => (!best || d.count > best.count ? d : best),
      null,
    );
  const tags = [
    ...(index === 0 ? ["초창기"] : []),
    ...era.tags,
    ...(index === total - 1 && total > 1 ? ["가장 최근 시기"] : []),
  ];
  const perDay = era.days ? era.count / era.days : 0;

  return [
    p(
      ...(tags.length ? [b(tags.join(" · ")), ". "] : []),
      `${speakers.size}명이 일평균 ${perDay.toFixed(1)}개의 메시지를 주고받았다.`,
      ...(leaders.length
        ? [
            " 대화를 주로 이끈 것은 ",
            ...leaders.flatMap((name, i) => [i > 0 ? ", " : "", link(name)]),
            "다.",
          ]
        : []),
      ...(busiest
        ? [
            ` 가장 붐빈 날은 ${day(busiest.key)}(${n(busiest.count)}개)이다.`,
          ]
        : []),
    ),
  ];
}

export function historySection(ctx: BuildCtx): WikiSec | null {
  const { ins } = ctx;
  const first = ins.timed[0];
  const last = ins.timed[ins.timed.length - 1];
  const eras = groupEras(ins);

  return section(ctx, "history", "역사", [
    {
      key: "before",
      title: "첫 기록",
      build: () =>
        first
          ? [
              p(
                `대화 파일에 남아 있는 가장 오래된 기록은 ${at(first)}에 `,
                ...who(first.author, "이/가"),
                ` 남긴 ${say(first.text)}이다.`,
                ctx.fn(
                  "내보낸 파일 기준이므로 실제 개설일은 이보다 앞설 수 있다.",
                ),
                " 개설 계기는 기록에 남아 있지 않다.",
              ),
            ]
          : null,
    },
    ...(eras.length >= 2
      ? eras.map((era, i) => ({
          key: era.key,
          title: era.title,
          build: () => eraBlocks(ins, era, i, eras.length),
        }))
      : []),
    {
      key: "now",
      title: "현재",
      build: () => {
        // "현재" = 마지막 기록일 기준 최근 30일
        const recent = ins.recent;
        if (!recent || eras.length < 2 || !last) return null;
        return [
          p(
            `최근 ${recent.days}일(${day(recent.fromKey)} ~ ${day(recent.toKey)}) 동안 ${recent.members}명이 메시지 ${n(recent.count)}개를 남겼다. 가장 최근 메시지는 ${at(last)}, `,
            ...who(last.author, "이/가"),
            ` 남긴 ${say(last.text)}이다.`,
          ),
        ];
      },
    },
    {
      key: "timeline",
      title: "주요 사건 연표",
      // AI가 대화 내용을 읽고 사건 이름을 붙이면 행 전체가 바뀐다(applyProse). 그 전에는 대화량 급증일을 보여 준다.
      build: () => {
        const spikes = [...ins.days]
          .sort((a, b) => b.count - a.count)
          .slice(0, TIMELINE_SPIKE_DAYS)
          .sort((a, b) => a.key.localeCompare(b.key));
        if (spikes.length < 2) return null;
        return [
          table(
            [...TIMELINE_HEAD],
            spikes.map((d) => {
              const leader = [...d.authors.entries()].sort(
                (a, b) => b[1] - a[1],
              )[0]?.[0];
              return [
                [d.key],
                ["대화량 급증"],
                [
                  `메시지 ${n(d.count)}개${leader ? ` · 가장 많이 말한 사람 ${leader}` : ""}`,
                ],
              ];
            }),
          ),
        ];
      },
    },
  ]);
}

/** 주요 사건 연표 표의 열. applyProse가 AI 연표로 행을 바꿀 때도 같은 열을 쓴다. */
export const TIMELINE_HEAD = ["날짜", "사건", "한 줄 요약"] as const;
const TIMELINE_SPIKE_DAYS = 10;
