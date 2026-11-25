import type { PersonProfile } from "@/types/chat";
import type { Block, Rich, WikiSec } from "@/types/wiki";
import { HALL_OF_FAME_KEY } from "@/services/wikiWriter/wikiWriter.schema";
import { formatHour } from "@/utils/format";
import {
  PAIR_MIN_MESSAGES_RELAXED,
  ROLE_THRESHOLD,
  type RoleScore,
} from "@/screens/home/utils/memberInsights";
import {
  BuildCtx,
  b,
  day,
  facts,
  link,
  n,
  p,
  say,
  section,
  table,
} from "@/screens/home/utils/roomWiki/builder";

const NO_CELL = "-";
/** 관계도 요약표에 넣는 최대 인원(메시지 많은 순) */
const RELATION_MEMBERS = 10;
/** 분기별 지분 표에 따로 보여 주는 최대 인원. 나머지는 "기타"로 묶는다. */
const QUARTER_MEMBERS = 5;
/** 인원 변동 표가 이보다 길면 접는다. */
const ROSTER_FOLD_ROWS = 10;
const ROSTER_ROWS = 40;

const fixed = (v: number, digits = 2) => v.toFixed(digits);

/** 정규화 값이 ROLE_THRESHOLD 이상인 지표 1~2개 */
function strongRoles(scores: RoleScore[]) {
  return scores
    .filter((s) => s.value >= ROLE_THRESHOLD && s.count > 0)
    .slice(0, 2);
}

/** AI가 역할명을 짓지 못했을 때 쓰는 이름 */
function roleName(scores: RoleScore[]) {
  const strong = strongRoles(scores);
  return strong.length ? `${strong[0].label} 담당` : "고르게 참여";
}

/** 친밀도 지수를 사람이 읽는 말로 */
function closeness(index: number) {
  if (index >= 1.5) return "유난히 자주 주고받는다";
  if (index >= 1.1) return "자주 주고받는 편";
  if (index >= 0.9) return "말하는 양만큼 주고받는다";
  return "상대적으로 덜 주고받는다";
}

/**
 * 멤버 섹션(prompts/room/members.md의 1.1~1.8).
 * 화면에는 사람이 읽는 말만 두고, 정규화 값·친밀도 지수 같은 계산값은 AI에게만 보낸다(facts).
 * 표의 "한 줄 캐릭터", "퇴장 전후 상황", "역할", "대표 장면" 칸은 AI가 채운다(AI_TABLE_SUBS).
 * 멤버별 특징·케미·의외의 조합은 AI가 멤버·쌍마다 소제목을 단다(AI_PARTS_SUBS).
 * 근거가 없는 하위 문단은 "없다"고 쓰지 않고 만들지 않는다.
 */
export function memberSection(ctx: BuildCtx): WikiSec | null {
  const { people, events } = ctx;
  const cards = [...people.cards].sort((a, b) => b.count - a.count);
  const current = cards.filter((c) => c.status !== "퇴장");
  const former = cards.filter((c) => c.status === "퇴장");
  const rolesOf = new Map(people.roles.map((r) => [r.name, r.scores]));
  const hasMemberEvents = events.some((e) => e.type !== "rename");
  const topPairs = people.pairs.slice(0, 3);
  const scoreLine = (scores: RoleScore[]) =>
    scores.map((s) => `${s.label} ${fixed(s.value)}`).join(", ");

  return section(ctx, "members", "멤버", [
    {
      key: "current",
      title: "현재 멤버",
      build: () =>
        current.length
          ? [
              table(
                ["이름", "상태", "합류", "한 줄 캐릭터", "지분"],
                current.map((c): Rich[] => [
                  [link(c.name)],
                  [c.status],
                  [c.joinKey ? day(c.joinKey) : "기록 시작 시점부터"],
                  [roleName(rolesOf.get(c.name) ?? [])],
                  [`${c.share}%`],
                ]),
              ),
              p(
                "활동은 최근 30일 안에 말한 멤버, 휴면은 퇴장 기록 없이 최근 30일 동안 말이 없는 멤버다.",
                ...(hasMemberEvents
                  ? []
                  : [
                      ctx.fn(
                        "대화 파일에 입장 기록이 없어 모든 멤버를 기록 시작 시점부터 있던 것으로 본다.",
                      ),
                    ]),
              ),
            ]
          : null,
    },
    {
      key: "former",
      title: "이전 멤버",
      build: () =>
        former.length
          ? [
              table(
                ["이름", "활동 기간", "퇴장일", "퇴장 전후 상황"],
                former.map((c): Rich[] => [
                  [link(c.name)],
                  [
                    c.firstKey
                      ? `${day(c.firstKey)} ~ ${day(c.lastKey)}`
                      : "발언 없음",
                  ],
                  [day(c.leaveKey)],
                  [NO_CELL],
                ]),
              ),
            ]
          : null,
    },
    {
      key: "traits",
      title: "멤버별 특징",
      // AI가 장면을 읽고 쓰는 하위 문단. 숫자는 근거로만 넘기고 화면에는 내지 않는다.
      build: () => {
        const speakers = current.filter((c) => c.count > 0);
        if (!speakers.length) return null;
        return [
          facts(
            "멤버별 활동 통계(근거로만 쓰고 숫자를 나열하지 않는다):",
            ...speakers.map(
              (c) =>
                `- ${c.name}: 메시지 ${n(c.count)}개(지분 ${c.share}%), 평균 ${c.avgLength}자, 한 번에 평균 ${c.avgRun}개씩 이어 보냄, 주 활동 ${formatHour(c.peakHour)}, 23~5시 비율 ${c.nightShare}%, 두드러진 행동 ${roleName(rolesOf.get(c.name) ?? [])}`,
            ),
          ),
        ];
      },
    },
    {
      key: "roles",
      title: "멤버별 역할",
      build: () => {
        const rows = people.roles.filter((r) =>
          current.some((c) => c.name === r.name && c.count > 0),
        );
        if (!rows.length) return null;
        return [
          table(
            ["멤버", "역할", "대표 장면"],
            rows.map((r): Rich[] => {
              const example = strongRoles(r.scores)[0]?.example;
              return [
                [link(r.name)],
                [roleName(r.scores)],
                [
                  example
                    ? `${day(example.dateKey)} ${say(example.text, 30)}`
                    : NO_CELL,
                ],
              ];
            }),
          ),
          facts(
            "역할 지표: (그 행동에서 멤버가 차지한 비율 ÷ 전체 메시지에서 멤버가 차지한 비율). 1.3 이상이면 그 멤버가 평소 말하는 양보다 그 행동을 눈에 띄게 많이 한다. 대화 시작·마무리는 앞뒤 2시간 공백, 리액션은 다른 사람 말 뒤 1분 안의 10자 이하, 장문은 50자 이상.",
            ...rows.map((r) => {
              const strong = strongRoles(r.scores);
              return `- ${r.name}: ${strong.length ? `두드러진 지표 ${scoreLine(strong)}` : "1.3 이상인 지표 없음"} / 전체 ${scoreLine(r.scores)}`;
            }),
          ),
        ];
      },
    },
    {
      key: "chemistry",
      title: "멤버 간 케미",
      build: () =>
        topPairs.length
          ? [
              table(
                ["두 사람", "주고받는 정도"],
                topPairs.map((pr): Rich[] => [
                  [link(pr.a), " × ", link(pr.b)],
                  [closeness(pr.index)],
                ]),
              ),
              p("두 사람이 서로의 말에 바로 답한 횟수를, 각자 말하는 양에 비춰 견준 것이다."),
              facts(
                `친밀도 상위 쌍(5분 안 상호 응답 기준${people.relaxed ? ", 작은 방이라 기준을 30개·10회로 낮춤" : ""}):`,
                ...topPairs.map(
                  (pr) =>
                    `- ${pr.a} × ${pr.b}: 5분 내 상호 응답 ${n(pr.actual)}회(기대값 ${fixed(pr.expected, 1)}회), 친밀도 지수 ${fixed(pr.index, 3)}, ${pr.rank}위/${people.pairs.length}쌍`,
                ),
              ),
            ]
          : null,
    },
    {
      key: "unexpected",
      title: "의외의 조합",
      build: () =>
        people.unexpected.length
          ? [
              facts(
                "의외의 조합 후보:",
                ...people.unexpected.map((pr) => `- ${pr.a} × ${pr.b}: ${pr.reason}`),
              ),
            ]
          : null,
    },
    {
      key: "roster",
      title: "인원 변천사",
      build: () => {
        const blocks: Block[] = [];
        if (people.roster.length) {
          const rows = people.roster.slice(0, ROSTER_ROWS);
          blocks.push(
            table(
              ["날짜", "변동", "인원"],
              rows.map((r): Rich[] => [
                [day(r.dateKey)],
                [r.change],
                [`${n(r.count)}명`],
              ]),
              rows.length > ROSTER_FOLD_ROWS ? "인원 변동 전체 펼치기" : undefined,
            ),
          );
        } else {
          blocks.push(
            p(`기록 기간 내내 ${n(cards.length)}명 체제가 그대로 유지되었다.`),
          );
        }
        if (people.quarters.length >= 2) {
          const speakers = cards.filter((c) => c.count > 0);
          const shown = speakers.slice(0, QUARTER_MEMBERS);
          const others = speakers.length > shown.length;
          blocks.push(
            table(
              [
                "분기",
                ...shown.map((c) => c.name),
                ...(others ? ["기타"] : []),
                "총 메시지",
              ],
              people.quarters.map((q): Rich[] => {
                const shareOf = (count: number) =>
                  q.total ? `${Math.round((count / q.total) * 100)}%` : "0%";
                const shownSum = shown.reduce(
                  (sum, c) => sum + (q.counts.get(c.name) ?? 0),
                  0,
                );
                return [
                  [q.label],
                  ...shown.map((c): Rich => [shareOf(q.counts.get(c.name) ?? 0)]),
                  ...(others ? [[shareOf(q.total - shownSum)]] : []),
                  [n(q.total)],
                ];
              }),
            ),
          );
        }
        return blocks;
      },
    },
    {
      key: "relations",
      title: "멤버 관계도",
      build: () => {
        const eligible = new Set(
          cards
            .filter((c) => c.count >= PAIR_MIN_MESSAGES_RELAXED)
            .slice(0, RELATION_MEMBERS)
            .map((c) => c.name),
        );
        const pairs = people.allPairs.filter(
          (pr) => eligible.has(pr.a) && eligible.has(pr.b),
        );
        if (eligible.size < 3 || !pairs.length) return null;
        const partner = (name: string, pick: "best" | "worst") => {
          const mine = pairs.filter((pr) => pr.a === name || pr.b === name);
          const chosen = pick === "best" ? mine[0] : mine[mine.length - 1];
          if (!chosen) return NO_CELL;
          return chosen.a === name ? chosen.b : chosen.a;
        };
        const names = people.matrix.names.filter((name) => eligible.has(name));
        return [
          table(
            ["멤버", "가장 잘 받아주는 상대", "가장 덜 엮이는 상대"],
            names.map((name): Rich[] => [
              [link(name)],
              [partner(name, "best")],
              [partner(name, "worst")],
            ]),
          ),
          p("각자 말하는 양에 비해 서로의 말에 바로 답한 정도로 견줬다."),
        ];
      },
    },
  ]);
}

/** 규칙 기반 제목의 대표 장면: 별명 → 말버릇 → 메시지 수 */
function hallOfFameHeadline(person: PersonProfile) {
  if (person.badges[0]) return person.badges[0].name;
  if (person.catchphrases[0]) return `“${person.catchphrases[0].word}”`;
  return `메시지 ${n(person.messageCount)}개`;
}

/**
 * 명예의 전당. 구성원 전원에게 하위 문단 하나씩 둔다(누락 방지).
 * 제목은 "이름 — 대표 장면" 형식이고, AI가 쓰면 제목과 본문이 그 사람의 대표 장면으로 바뀐다.
 */
export function hallOfFameSection(ctx: BuildCtx): WikiSec | null {
  const { room } = ctx;
  return section(
    ctx,
    HALL_OF_FAME_KEY,
    "명예의 전당",
    room.participants.map((person, index) => ({
      key: `m${index + 1}`,
      title: `${person.name} — ${hallOfFameHeadline(person)}`,
      build: () => {
        const badge = person.badges[0];
        const phrases = person.catchphrases.slice(0, 3);
        const content: Rich = [
          link(person.name),
          ` 메시지 ${n(person.messageCount)}개로 발언량 ${person.rank}위.`,
        ];
        if (badge)
          content.push(" 별명은 ", b(badge.name), `(${badge.description}).`);
        if (phrases.length)
          content.push(
            ` 말버릇은 ${phrases.map((c) => `“${c.word}”(${n(c.count)}회)`).join(", ")}.`,
          );
        if (person.longestMessage)
          content.push(
            ` 가장 긴 메시지는 ${say(person.longestMessage, 80)}였다.`,
          );
        return [p(...content)];
      },
    })),
  );
}
