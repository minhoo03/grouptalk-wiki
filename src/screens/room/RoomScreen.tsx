"use client";

import { UploadIcon } from "lucide-react";

import { BlockRenderer } from "@/components/wiki/BlockRenderer";
import { DocActionButton } from "@/components/wiki/DocActionButton";
import { DocHeader } from "@/components/wiki/DocHeader";
import {
  FootnoteProvider,
  type FootnoteEntry,
} from "@/components/wiki/FootnoteContext";
import { FootnoteList } from "@/components/wiki/FootnoteList";
import { Infobox } from "@/components/wiki/Infobox";
import { MemberNavbox } from "@/components/wiki/MemberNavbox";
import { NotFoundDocument } from "@/components/wiki/NotFoundDocument";
import { PixelAvatar } from "@/components/wiki/PixelAvatar";
import {
  TableOfContents,
  type TocItem,
} from "@/components/wiki/TableOfContents";
import { WikiLink } from "@/components/wiki/WikiLink";
import { WikiNotice } from "@/components/wiki/WikiNotice";
import { WikiSection } from "@/components/wiki/WikiSection";
import { useWikiStore } from "@/store/wikiStore";
import { formatDateKey, formatHour } from "@/utils/format";
import { HOME_PATH, personPath } from "@/utils/wikiRoutes";
import { ShareLinkButton } from "@/screens/room/components/ShareLinkButton";

const HERO_AVATAR_LIMIT = 8;
const FOOTNOTE_SECTION_ID = "w-footnotes";

export function RoomScreen() {
  const generated = useWikiStore((state) => state.generated);

  if (!generated) return <NotFoundDocument query="단톡방 문서" />;

  const { room, wiki } = generated;
  const leader = room.participants[0];
  const notes: FootnoteEntry[] = wiki.notes.map((note) => ({
    content: note.text,
    link: note.link
      ? { label: note.link.label, anchorId: note.link.id }
      : undefined,
  }));
  const footnoteNumber = String(wiki.sections.length + 1);
  const toc: TocItem[] = [
    ...wiki.sections.flatMap((section) => [
      { id: section.id, number: section.number, title: section.title },
      ...section.subs.map((sub) => ({
        id: sub.id,
        number: sub.number,
        title: sub.title,
      })),
    ]),
    { id: FOOTNOTE_SECTION_ID, number: footnoteNumber, title: "각주" },
  ];

  return (
    <FootnoteProvider notes={notes}>
      <DocHeader
        title={room.roomTitle}
        categories={[
          { label: "단톡방" },
          { label: `${room.participants.length}인 단톡방` },
        ]}
        actions={
          <>
            <ShareLinkButton />
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
          {generated.aiWritten
            ? "이 문서는 대화 기록에서 계산한 통계와 일부 발언을 바탕으로 AI가 서술했습니다. 표와 그래프의 숫자는 기록에서 직접 계산한 값입니다."
            : "이 문서는 업로드한 대화 기록만으로 자동 작성되었습니다. 기록으로 확인할 수 없는 문단은 생략되었습니다."}
        </WikiNotice>
        {leader && (
          <WikiNotice kind="redirect">
            이 단톡방의 실세에 대한 내용은{" "}
            <WikiLink href={personPath(leader.name)}>{leader.name}</WikiLink>{" "}
            문서를 참고하십시오.
          </WikiNotice>
        )}
      </div>

      <MemberNavbox roomTitle={room.roomTitle} people={room.participants} />

      <div className="mt-8 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="order-2 md:order-1">
          <TableOfContents items={toc} />
        </div>
        <div className="order-1 md:order-2">
          <Infobox
            title={room.roomTitle}
            subtitle="카카오톡 단톡방"
            hero={
              <div className="flex flex-wrap justify-center gap-2">
                {room.participants.slice(0, HERO_AVATAR_LIMIT).map((person) => (
                  <PixelAvatar key={person.name} name={person.name} size="md" />
                ))}
              </div>
            }
            rows={[
              { label: "인원", value: `${room.participants.length}명` },
              {
                label: "총 메시지",
                value: `${room.totalMessages.toLocaleString()}개`,
              },
              {
                label: "기간",
                value: `${formatDateKey(room.startDate)} ~ ${formatDateKey(room.endDate)}`,
              },
              {
                label: "최다 기록",
                value: room.busiestDay
                  ? `${formatDateKey(room.busiestDay.date)} (${room.busiestDay.count}개)`
                  : "불명",
              },
              { label: "주 활동", value: `${formatHour(room.peakHour)} 무렵` },
            ]}
          />
        </div>
      </div>

      {wiki.sections.map((section) => (
        <WikiSection
          key={section.id}
          id={section.id}
          number={section.number}
          title={section.title}
        >
          <div className="space-y-8">
            {section.subs.map((sub) => (
              <div key={sub.id} id={sub.id} className="scroll-mt-20">
                <h3 className="mb-3 text-xl font-bold text-ink">
                  <span className="text-link">{sub.number}.</span> {sub.title}
                </h3>
                <BlockRenderer blocks={sub.blocks} />
              </div>
            ))}
          </div>
        </WikiSection>
      ))}

      <WikiSection
        id={FOOTNOTE_SECTION_ID}
        number={footnoteNumber}
        title="각주"
      >
        {notes.length ? (
          <FootnoteList notes={notes} />
        ) : (
          <p className="text-subtle">각주가 없다.</p>
        )}
      </WikiSection>
    </FootnoteProvider>
  );
}
