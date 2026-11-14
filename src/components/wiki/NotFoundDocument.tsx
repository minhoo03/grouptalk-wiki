"use client";

import { useWikiStore } from "@/store/wikiStore";
import { HOME_PATH, ROOM_PATH, personPath } from "@/utils/wikiRoutes";
import { DocHeader } from "@/components/wiki/DocHeader";
import { WikiLink } from "@/components/wiki/WikiLink";

type NotFoundDocumentProps = {
  query: string;
};

/** 검색 결과가 없거나, 생성된 문서 없이 단톡방·인물 문서 URL로 들어왔을 때 보여 준다. */
export function NotFoundDocument({ query }: NotFoundDocumentProps) {
  const room = useWikiStore((state) => state.generated?.room ?? null);

  return (
    <>
      <DocHeader
        title={query || "없는 문서"}
        categories={[{ label: "없는 문서" }]}
      />
      <div className="mt-8 text-[15px] leading-relaxed text-ink">
        <p>
          <b>“{query}”</b> 문서를 찾을 수 없습니다.
        </p>
        {room ? (
          <>
            <p className="mt-4">이 단톡방에 있는 문서:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <WikiLink href={ROOM_PATH}>{room.roomTitle}</WikiLink>
              </li>
              {room.participants.map((person) => (
                <li key={person.name}>
                  <WikiLink href={personPath(person.name)}>
                    {person.name}
                  </WikiLink>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-4">
            아직 올린 대화가 없어요. <WikiLink href={HOME_PATH}>대문</WikiLink>
            에서 대화를 올려 보세요.
          </p>
        )}
      </div>
    </>
  );
}
