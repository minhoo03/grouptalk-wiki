"use client";

import { MessagesSquareIcon, UploadIcon } from "lucide-react";

import { DocActionButton } from "@/components/wiki/DocActionButton";
import { DocHeader } from "@/components/wiki/DocHeader";
import {
  FootnoteProvider,
  type FootnoteEntry,
} from "@/components/wiki/FootnoteContext";
import { FootnoteList } from "@/components/wiki/FootnoteList";
import { FootnoteRef } from "@/components/wiki/FootnoteRef";
import { BlockRenderer } from "@/components/wiki/BlockRenderer";
import { Infobox } from "@/components/wiki/Infobox";
import { MemberNavbox } from "@/components/wiki/MemberNavbox";
import { NotFoundDocument } from "@/components/wiki/NotFoundDocument";
import { PixelAvatar } from "@/components/wiki/PixelAvatar";
import { QuoteBox } from "@/components/wiki/QuoteBox";
import { StatBar } from "@/components/wiki/StatBar";
import { TableOfContents } from "@/components/wiki/TableOfContents";
import { WikiLink } from "@/components/wiki/WikiLink";
import { WikiNotice } from "@/components/wiki/WikiNotice";
import { WikiSection } from "@/components/wiki/WikiSection";
import { useWikiStore } from "@/store/wikiStore";
import type { PersonProfile, RoomProfile } from "@/types/chat";
import type { Block, PersonProseEntry } from "@/types/wiki";
import { formatDateKey, formatHour, formatTime } from "@/utils/format";
import { hasBatchim, josa } from "@/utils/korean";
import { HOME_PATH, ROOM_PATH, personPath } from "@/utils/wikiRoutes";
import { rarityMeta } from "@/screens/person/rarity";

type PersonScreenProps = {
  name: string;
};

const TOC = [
  { id: "p-1", number: "1", title: "개요" },
  { id: "p-2", number: "2", title: "특징" },
  { id: "p-3", number: "3", title: "별명" },
  { id: "p-4", number: "4", title: "어록" },
  { id: "p-5", number: "5", title: "인간관계" },
  { id: "p-6", number: "6", title: "여담" },
];

/** "읽기만 하는 사람" 농담은 3인 이상 단톡방의 꼴찌에게만 붙인다. */
const MIN_MEMBERS_FOR_LAST_PLACE_JOKE = 3;
const MIN_SHARE_BAR_PERCENT = 2;

export function PersonScreen({ name }: PersonScreenProps) {
  const generated = useWikiStore((state) => state.generated);
  const person = generated?.room.participants.find(
    (participant) => participant.name === name,
  );

  if (!generated || !person) return <NotFoundDocument query={name} />;

  return (
    <PersonDocument
      room={generated.room}
      person={person}
      prose={generated.personProse[person.name] ?? EMPTY_PROSE}
    />
  );
}

type PersonDocumentProps = {
  room: RoomProfile;
  person: PersonProfile;
  /** AI가 쓴 섹션별 블록과 각주. 없는 섹션은 규칙 기반 문장을 보여 준다. */
  prose: PersonProseEntry;
};

const EMPTY_PROSE: PersonProseEntry = { sections: {}, notes: [] };

/** AI 각주 번호(1부터)를 문서의 고정 각주 뒤로 민다. */
function shiftFootnotes(blocks: Block[], offset: number): Block[] {
  return blocks.map((block) =>
    block.type === "p"
      ? {
          ...block,
          content: block.content.map((part) =>
            typeof part !== "string" && part.t === "fn"
              ? { ...part, n: part.n + offset }
              : part,
          ),
        }
      : block,
  );
}

type AiBlocksProps = {
  blocks: Block[] | undefined;
  className?: string;
};

function AiBlocks({ blocks, className }: AiBlocksProps) {
  if (!blocks?.length) return null;
  return (
    <div className={className}>
      <BlockRenderer blocks={blocks} />
    </div>
  );
}

/** 각주에서 단톡방 문서의 계산 방법 문단으로 이동하는 링크 */
function roomSectionLink(room: RoomProfile, anchorId: string, title: string) {
  return { label: `${room.roomTitle} › ${title}`, anchorId, href: ROOM_PATH };
}

function PersonDocument({ room, person, prose }: PersonDocumentProps) {
  const topCatchphrase = person.catchphrases[0];
  const topPartner = person.replyPartners[0];
  const mainBadge = person.badges[0];
  const maxPartnerCount = topPartner?.count ?? 1;
  const memberCount = room.participants.length;
  const isFirstPlace = person.rank === 1;
  const isLastPlace =
    memberCount >= MIN_MEMBERS_FOR_LAST_PLACE_JOKE &&
    person.rank === memberCount;
  const withRo = (word: string) => (hasBatchim(word) ? "으로" : "로");

  const notes: FootnoteEntry[] = [
    {
      content: `${formatDateKey(room.startDate)} ~ ${formatDateKey(room.endDate)} 대화 기록 기준.`,
      link: roomSectionLink(room, "w-method-scope", "분석 대상과 기간"),
    },
    {
      content: "각 항목에서 단톡방 내 최고 기록을 100%로 놓고 환산한 값이다.",
      link: roomSectionLink(room, "w-members-traits", "멤버별 특징"),
    },
    {
      content: `${person.longestMessage.length}자. 사진, 이모티콘 등은 제외하고 셌다.`,
      link: roomSectionLink(room, "w-method-excluded", "제외된 메시지"),
    },
    {
      content:
        "직전 발언자가 다른 사람일 경우, 그 사람의 말을 받아 준 것으로 계산했다.",
      link: roomSectionLink(room, "w-method-graph", "관계도 계산 방법"),
    },
  ];
  // AI 각주는 고정 각주 뒤에 붙이고, AI 블록의 각주 번호도 같은 만큼 민다.
  const aiNoteOffset = notes.length;
  notes.push(...prose.notes.map((content) => ({ content })));
  const ai = Object.fromEntries(
    Object.entries(prose.sections).map(([key, blocks]) => [
      key,
      shiftFootnotes(blocks, aiNoteOffset),
    ]),
  );

  return (
    <FootnoteProvider notes={notes}>
      <DocHeader
        title={person.name}
        categories={[
          { label: room.roomTitle, href: ROOM_PATH },
          { label: `${room.roomTitle}/등장인물` },
        ]}
        actions={
          <>
            <DocActionButton
              icon={<MessagesSquareIcon className="h-4 w-4" />}
              label="단톡방"
              href={ROOM_PATH}
            />
            <DocActionButton
              icon={<UploadIcon className="h-4 w-4" />}
              label="새 대화"
              href={HOME_PATH}
            />
          </>
        }
      />

      <div className="mt-5 space-y-3">
        <WikiNotice kind="lock">
          이 문서는 대화 기록을 바탕으로 자동 작성된 문서입니다.
        </WikiNotice>
        <WikiNotice kind="redirect">
          <b>{person.name}</b>
          {josa(person.name, "은/는")} 여기로 연결됩니다. 단톡방 전체에 대한
          내용은 <WikiLink href={ROOM_PATH}>{room.roomTitle}</WikiLink> 문서를
          참고하십시오.
        </WikiNotice>
      </div>

      <MemberNavbox
        roomTitle={room.roomTitle}
        people={room.participants}
        currentName={person.name}
      />

      <div className="mt-8 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="order-2 md:order-1">
          <TableOfContents items={TOC} />
        </div>
        <div className="order-1 md:order-2">
          <Infobox
            title={person.name}
            subtitle={mainBadge?.name ?? ""}
            hero={
              <div className="flex items-center gap-5">
                <PixelAvatar name={person.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-subtle">대화 지분</p>
                  <p className="text-3xl font-bold text-ink tabular-nums">
                    {person.share}%
                  </p>
                  <div className="mt-2 h-3 overflow-hidden rounded-[2px] border border-ink bg-white">
                    <div
                      className="h-full bg-namu"
                      style={{
                        width: `${Math.max(person.share, MIN_SHARE_BAR_PERCENT)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            }
            rows={[
              {
                label: "소속",
                value: <WikiLink href={ROOM_PATH}>{room.roomTitle}</WikiLink>,
              },
              {
                label: "발언량",
                value: `${person.messageCount.toLocaleString()}개 (${person.rank}위 / ${memberCount}명)`,
              },
              {
                label: "주 활동",
                value: `${formatHour(person.peakHour)} 무렵`,
              },
              {
                label: "출석",
                value: `${person.activeDays}일 / ${room.activeDays}일`,
              },
              {
                label: "별명",
                value: person.badges.map((badge) => badge.name).join(", "),
              },
            ]}
          />
        </div>
      </div>

      <WikiSection id="p-1" number="1" title="개요">
        {topCatchphrase && (
          <QuoteBox
            quote={`“${topCatchphrase.word}”`}
            caption={
              <>
                {person.name}의 대표 어록. 기록상 {topCatchphrase.count}회
                사용했다.
              </>
            }
          />
        )}
        {ai.overview ? (
          <AiBlocks blocks={ai.overview} />
        ) : (
          <>
            <p>
              <WikiLink href={ROOM_PATH}>{room.roomTitle}</WikiLink>의 구성원. 총{" "}
              {person.messageCount.toLocaleString()}
              개의 메시지를 남겨 전체 대화의 {person.share}%를 차지하고 있으며,
              단톡방 내 발언량 순위는 {person.rank}
              위다.
              <FootnoteRef n={1} />
              {isFirstPlace && (
                <>
                  {" "}
                  <del>사실상 이 단톡방의 주인</del>
                </>
              )}
              {isLastPlace && (
                <>
                  {" "}
                  <del>읽기만 하는 사람</del>
                </>
              )}
            </p>
            <p className="mt-3">
              주로 {formatHour(person.peakHour)} 무렵에 모습을 드러낸다.
              {topPartner && (
                <>
                  {" "}
                  가장 자주 말을 받아 주는 상대는{" "}
                  <WikiLink href={personPath(topPartner.name)}>
                    {topPartner.name}
                  </WikiLink>
                  {withRo(topPartner.name)}, 두 사람의 대화가 단톡방의 상당 부분을
                  차지한다.
                </>
              )}
            </p>
          </>
        )}
      </WikiSection>

      <WikiSection id="p-2" number="2" title="특징">
        <AiBlocks blocks={ai.traits} className="mb-4" />
        <p className="mb-5">
          대화 습관을 단톡방 구성원끼리 비교한 결과는 아래와 같다. 막대가 꽉 찬
          항목이 단톡방 내 1위다.
          <FootnoteRef n={2} />
        </p>
        <div className="max-w-xl space-y-3">
          {person.stats.map((stat) => (
            <StatBar
              key={stat.key}
              label={stat.label}
              value={stat.value}
              raw={stat.raw}
            />
          ))}
        </div>
      </WikiSection>

      <WikiSection id="p-3" number="3" title="별명">
        <AiBlocks blocks={ai.nicknames} className="mb-4" />
        <ul className="list-disc space-y-3 pl-6">
          {person.badges.map((badge) => (
            <li key={badge.id}>
              <span className="inline-flex items-center gap-2 font-bold">
                <span
                  className={`h-2.5 w-2.5 rounded-[2px] ${rarityMeta[badge.rarity].square}`}
                  aria-hidden="true"
                />
                {badge.name}
              </span>
              <br />
              {badge.description}
              {badge.joke && (
                <>
                  {" "}
                  <del>{badge.joke}</del>
                </>
              )}
            </li>
          ))}
        </ul>
      </WikiSection>

      <WikiSection id="p-4" number="4" title="어록">
        <AiBlocks blocks={ai.quotes} className="mb-4" />
        {person.catchphrases.length ? (
          <ul className="list-disc space-y-1.5 pl-6">
            {person.catchphrases.map((catchphrase) => (
              <li key={catchphrase.word}>
                “{catchphrase.word}”
                {catchphrase.count > 1 && (
                  <span className="text-subtle"> - {catchphrase.count}회</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          !ai.quotes && <p>기록상 이 사람만의 뚜렷한 말버릇은 없다.</p>
        )}
        {person.longestMessage && (
          <>
            <p className="mt-6">기록상 가장 긴 메시지는 다음과 같다.</p>
            <blockquote className="mt-2 border-l-4 border-namu bg-paper px-4 py-3 whitespace-pre-line">
              {person.longestMessage}
              <FootnoteRef n={3} />
            </blockquote>
          </>
        )}
      </WikiSection>

      <WikiSection id="p-5" number="5" title="인간관계">
        <AiBlocks blocks={ai.relationships} className="mb-4" />
        {person.replyPartners.length ? (
          <>
            <p className="mb-4">
              다른 사람의 말 바로 뒤에 대답한 횟수를 기준으로 정리했다.
              <FootnoteRef n={4} />
            </p>
            <ul className="space-y-3">
              {person.replyPartners.map((partner) => (
                <li
                  key={partner.name}
                  className="grid grid-cols-[100px_1fr_auto] items-center gap-3 sm:grid-cols-[140px_1fr_auto]"
                >
                  <WikiLink
                    href={personPath(partner.name)}
                    className="truncate text-left"
                  >
                    {partner.name}
                  </WikiLink>
                  <span className="h-3 overflow-hidden rounded-[2px] border border-ink bg-white">
                    <span
                      className="block h-full bg-namu"
                      style={{
                        width: `${(partner.count / maxPartnerCount) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="text-sm text-subtle tabular-nums">
                    {partner.count}회
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>다른 구성원과 주고받은 기록이 없다.</p>
        )}
      </WikiSection>

      <WikiSection id="p-6" number="6" title="여담">
        <AiBlocks blocks={ai.trivia} className="mb-4" />
        <ul className="list-disc space-y-1.5 pl-6">
          {person.firstMessage && (
            <li>
              기록상 첫 발언은 {formatDateKey(person.firstMessage.dateKey)}{" "}
              {formatTime(person.firstMessage.hour, person.firstMessage.minute)}
              에 보낸 “{person.firstMessage.text}
              ”이다.
            </li>
          )}
          {person.lastMessage && (
            <li>가장 최근 발언은 “{person.lastMessage.text}”.</li>
          )}
          <li>
            ‘ㅋㅋ’가 들어간 메시지는 {person.laughCount}개, 보낸 사진은{" "}
            {person.photoCount}장, 이모티콘은 {person.emoticonCount}개다.
          </li>
          <li>
            물음표가 들어간 메시지는 {person.questionCount}개.
            {person.questionCount === 0 && (
              <>
                {" "}
                <del>궁금한 게 없는 사람</del>
              </>
            )}
          </li>
        </ul>
      </WikiSection>

      <FootnoteList notes={notes} />
    </FootnoteProvider>
  );
}
