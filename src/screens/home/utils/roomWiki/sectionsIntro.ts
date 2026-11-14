import type { Rich, WikiSec } from "@/types/wiki";
import { josa } from "@/utils/korean";
import { bucketOf, type Insights } from "@/screens/home/utils/roomInsights";
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
  quote,
  say,
  section,
  ul,
  who,
} from "@/screens/home/utils/roomWiki/builder";

export function overviewSection(ctx: BuildCtx): WikiSec | null {
  const { ins, title } = ctx;

  return section(ctx, "overview", "개요", [
    {
      key: "intro",
      title: "한 줄 소개",
      build: () => [
        quote(
          `${ins.members.length}명이 ${ins.activeDays}일 동안 ${n(ins.total)}개의 메시지를 주고받은 단톡방`,
          [`${title}${josa(title, "을/를")} 한 줄로 요약하면 이렇다.`],
        ),
      ],
    },
    {
      key: "status",
      title: "현재 상태",
      build: () => {
        // "현재" = 마지막 기록일 기준 최근 30일. 기록 전체가 그보다 짧으면 비교할 대상이 없다.
        const recent = ins.recent;
        if (!recent || recent.days >= ins.spanDays || !ins.perDay) return null;
        const ratio = recent.perDay / ins.perDay;
        const state =
          ratio >= 1.2
            ? "평소보다 활발한"
            : ratio >= 0.6
              ? "평소 수준의"
              : "눈에 띄게 조용해진";
        return [
          p(
            `마지막 기록일인 ${day(recent.toKey)} 기준 최근 ${recent.days}일 동안 메시지 ${n(recent.count)}개가 오갔다. 일평균 ${recent.perDay.toFixed(1)}개로, 전체 기간 일평균(${ins.perDay.toFixed(1)}개)에 비해 ${state} 상태다.`,
            ...(ratio < 0.6
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
      build: () => {
        if (title.length < 2) return null;
        const mentions = ins.timed.filter((m) => m.text.includes(title));
        if (!mentions.length) return null;
        const first = mentions[0];
        return [
          p(
            `대화 중 '${title}'이라는 이름이 직접 언급된 것은 ${mentions.length}회다. 기록상 첫 언급은 ${at(first)}, `,
            ...who(first.author, "이/가"),
            ` 남긴 ${say(first.text)}이다.`,
          ),
        ];
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
                [b(title), muted(" (현재)")],
                ...ins.renames.map((r): Rich => [r]),
              ]),
            ]
          : null,
    },
  ]);
}

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

  let peakIdx = -1;
  B.forEach((bk, i) => {
    if (comparable(i) && (peakIdx < 0 || bk.perDay > B[peakIdx].perDay))
      peakIdx = i;
  });
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
      title: "개설 이전",
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
                " 그 이전의 역사는 문서화되지 않았다.",
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
  ]);
}
