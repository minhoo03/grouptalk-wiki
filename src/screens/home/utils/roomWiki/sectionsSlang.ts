import type { Rich, WikiSec } from "@/types/wiki";
import {
  monthLabel,
  type LaughProfile,
  type SlangCandidate,
} from "@/screens/home/utils/slangInsights";
import {
  BuildCtx,
  day,
  facts,
  h,
  link,
  n,
  section,
  table,
  ul,
} from "@/screens/home/utils/roomWiki/builder";

/**
 * 상징·유행어 섹션(prompts/room/slang.md의 5.1~5.8).
 * 앱은 자주 나온 표현을 후보로만 넘긴다(facts). 후보가 정말 이 방의 유행어·말버릇인지는 AI가 쓰임을 읽고 고른다.
 * 유행어 표는 AI가 고른 행만 남고(AI_TABLE_SUBS의 keepOnlyFilled), AI가 비워 둔 하위 문단은 문서에서 빠진다.
 * 화면에는 사람이 읽는 말만 두고, 배율·비율 같은 계산값은 AI에게만 보낸다.
 */

const TOP_ROWS = 10;
const ORIGIN_ITEMS = 4;
const EMPTY_CELL = "-";

const usersText = (c: SlangCandidate, limit = 2) =>
  c.users
    .slice(0, limit)
    .map((u) => u.name)
    .join(", ");

const peakText = (c: SlangCandidate) =>
  c.peakMonth ? monthLabel(c.peakMonth) : EMPTY_CELL;

const candidateLine = (c: SlangCandidate) =>
  `- "${c.text}": ${n(c.count)}회, ${n(c.days)}일에 걸쳐, 사용자 ${c.users.map((u) => `${u.name}(${u.value})`).join(", ")}, 처음 ${day(c.first.dateKey)} ${c.first.author}, 마지막 ${day(c.last.dateKey)} ${c.last.author}, 가장 많이 쓴 달 ${peakText(c)}`;

/** ㅋ 연속 길이 분포에서 가장 많은 구간을 말로 */
function laughHabit(l: LaughProfile) {
  const labels = ["두 개", "3~5개", "6~10개", "11개 넘게"];
  const max = Math.max(...l.runs);
  const most = labels[l.runs.indexOf(max)];
  const style =
    l.hRuns > l.kRuns ? "ㅋ보다 ㅎ를 더 쓴다" : `ㅋ를 주로 ${most}씩 친다`;
  return l.kRuns + l.hRuns ? style : EMPTY_CELL;
}

export function slangSection(ctx: BuildCtx): WikiSec | null {
  const { slang } = ctx;
  const spread = slang.candidates.filter((c) => c.users.length >= 2);

  return section(ctx, "slang", "상징·유행어", [
    {
      key: "top",
      title: "대표 유행어",
      build: () =>
        spread.length
          ? [
              table(
                ["유행어", "뜻·쓰임", "주로 쓰는 사람", "많이 쓰인 시기"],
                spread
                  .slice(0, TOP_ROWS)
                  .map((c): Rich[] => [
                    [c.text],
                    [EMPTY_CELL],
                    [usersText(c)],
                    [peakText(c)],
                  ]),
              ),
              facts(
                "유행어 후보(자주 나온 표현일 뿐이다. 대부분은 평범한 낱말이라 유행어가 아니다):",
                ...spread.slice(0, TOP_ROWS).map(candidateLine),
              ),
            ]
          : null,
    },
    {
      key: "origin",
      title: "유행어의 기원",
      build: () => {
        const items = spread.slice(0, ORIGIN_ITEMS);
        if (!items.length) return null;
        return [
          facts(
            "유행어 후보의 첫 사용과 확산(대표 유행어로 고른 표현만 쓴다):",
            ...items.map((c) => {
              const followers = c.spread
                .slice(1, 3)
                .map((f) => `${f.name}(${day(f.first.dateKey)})`)
                .join(", ");
              return `- "${c.text}": 처음 ${day(c.first.dateKey)} ${c.first.author} "${c.first.text.slice(0, 60)}"${c.first.dateKey === ctx.ins.startKey ? " (기록 첫날)" : ""}${followers ? `, 이후 ${followers} 순으로 받아 씀` : ""}`;
            }),
          ),
        ];
      },
    },
    {
      key: "habits",
      title: "멤버별 말버릇",
      build: () => {
        const rows = slang.habits.filter((m) => m.habits.length);
        if (!rows.length) return null;
        return [
          facts(
            "멤버별로 다른 멤버보다 유난히 자주 쓰는 표현 후보(배율 = 그 멤버의 사용 비율 ÷ 나머지 멤버의 사용 비율). 평범한 낱말이면 말버릇이 아니다:",
            ...rows.map(
              (m) =>
                `- ${m.name}: ${m.habits
                  .map(
                    (hb) =>
                      `"${hb.text}" ${hb.uses}회(${hb.ratio === null ? "혼자만 씀" : `${hb.ratio.toFixed(1)}배`})`,
                  )
                  .join(", ")} / 메시지 중 물결 ${m.style.tilde}%, 마침표 ${m.style.period}%, 느낌표 ${m.style.exclaim}%, ㅠㅜ ${m.style.cry}%`,
            ),
          ),
        ];
      },
    },
    {
      key: "nicknames",
      title: "별명과 호칭",
      build: () =>
        slang.address.length
          ? [
              facts(
                "누군가를 부른 표현 후보(\"야 OO\", \"OO아/야\", \"OO님\", \"@OO\"):",
                ...slang.address.map(
                  (a) =>
                    `- "${a.term}" ${a.count}회, 부른 사람 ${a.callers
                      .slice(0, 3)
                      .map((c) => `${c.name}(${c.value})`)
                      .join(", ")}`,
                ),
              ),
            ]
          : null,
    },
    {
      key: "emoji",
      title: "대표 이모티콘",
      build: () => {
        const blocks = [];
        if (slang.emoji.length)
          blocks.push(
            h("자주 쓰는 이모지"),
            table(
              ["이모지", "횟수", "주로 쓰는 사람", "주로 쓰이는 상황"],
              slang.emoji.map((e): Rich[] => [
                [e.emoji],
                [`${n(e.count)}회`],
                [
                  e.users
                    .slice(0, 2)
                    .map((u) => u.name)
                    .join(", "),
                ],
                [EMPTY_CELL],
              ]),
            ),
          );
        if (slang.emoticons.length)
          blocks.push(
            h("카카오 이모티콘"),
            ul(
              slang.emoticons.map((e): Rich => [
                link(e.name),
                ` ${n(e.count)}개`,
              ]),
            ),
            facts(
              "카카오 이모티콘 사용 행태:",
              ...slang.emoticons.map(
                (e) =>
                  `- ${e.name} ${e.count}개: 다른 사람 말 뒤 1분 안 ${e.afterOthers}%, 웃음 메시지 직후 ${e.afterLaugh}%, 연속 전송 ${e.chained}%`,
              ),
            ),
          );
        return blocks.length ? blocks : null;
      },
    },
    {
      key: "laugh",
      title: "웃음 표현",
      build: () => {
        const rows = slang.laughs.filter((l) => l.kRuns + l.hRuns > 0);
        if (!rows.length) return null;
        return [
          table(
            ["멤버", "웃음 시그니처", "특징"],
            rows.map((l): Rich[] => [
              [link(l.name)],
              [EMPTY_CELL],
              [laughHabit(l)],
            ]),
          ),
          facts(
            "멤버별 웃음 통계:",
            ...rows.map(
              (l) =>
                `- ${l.name}: ㅋ 연속 길이 2개 ${l.runs[0]}번, 3~5개 ${l.runs[1]}번, 6~10개 ${l.runs[2]}번, 11개 이상 ${l.runs[3]}번 / ㅋ ${l.kRuns}번 vs ㅎ ${l.hRuns}번${l.tails.length ? ` / 웃음 뒤에 붙는 말 ${l.tails.map((t) => `"${t.word}"(${t.count})`).join(", ")}` : ""}${l.typo ? ` / 오타 웃음 ${l.typo}번` : ""}${l.cryMix ? ` / 웃음+울음 ${l.cryMix}번` : ""}${l.initials.length ? ` / 초성 ${l.initials.map((i) => `${i.word}(${i.count})`).join(" ")}` : ""}`,
            ),
            slang.sideSplit &&
              `크게 웃은 기준: ㅋ ${slang.sideSplit.threshold}개 이상 연달아 친 웃음(방 전체 상위 5%), ${slang.sideSplit.messages}번.`,
          ),
        ];
      },
    },
    {
      key: "faded",
      title: "한때 유행했던 표현",
      build: () => {
        const faded = spread.filter((c) => slang.fadedKeys.has(c.text));
        if (!faded.length) return null;
        return [
          table(
            ["표현", "전성기", "그때 한 달 사용", "최근 30일 사용"],
            faded.map((c): Rich[] => [
              [c.text],
              [peakText(c)],
              [`${n(c.peakCount)}회`],
              [`${n(c.recentCount)}회`],
            ]),
          ),
        ];
      },
    },
    {
      key: "vanished",
      title: "사라진 유행어",
      build: () => {
        const gone = slang.candidates.filter((c) =>
          slang.vanishedKeys.has(c.text),
        );
        if (!gone.length) return null;
        return [
          table(
            ["표현", "쓰이던 기간", "마지막 목격", "마지막으로 쓴 사람"],
            gone.map((c): Rich[] => [
              [c.text],
              [`${day(c.first.dateKey)} ~ ${day(c.last.dateKey)}`],
              [day(c.last.dateKey)],
              [link(c.last.author)],
            ]),
          ),
        ];
      },
    },
  ]);
}
