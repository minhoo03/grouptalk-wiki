import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, type ReactNode } from "react";

import { SharedWikiLoader } from "@/screens/shared/SharedWikiLoader";
import { getSharedWiki } from "@/services/sharedWiki/sharedWiki";

type SharedWikiLayoutProps = {
  children: ReactNode;
  params: Promise<{ code: string }>;
};

/** generateMetadata와 layout이 한 요청 안에서 같은 행을 두 번 조회·복호화하지 않게 한다. */
const loadSharedWiki = cache(getSharedWiki);

// 1일 뒤 사라지는 개인 대화 문서이므로 검색엔진에 노출하지 않는다.
const robots = { index: false, follow: false };

/**
 * 메신저 미리보기에는 방 이름과 인원수만 보낸다.
 * 인물 이름·대화 내용은 외부 크롤러로 넘기지 않으려고 하위 page에서도 title을 바꾸지 않는다.
 */
export async function generateMetadata({
  params,
}: SharedWikiLayoutProps): Promise<Metadata> {
  const { code } = await params;
  const sharedWiki = await loadSharedWiki(code);
  if (!sharedWiki) return { title: "사라진 문서 | 단톡위키", robots };

  const { roomTitle, participants } = sharedWiki.room;
  const title = `${roomTitle} | 단톡위키`;
  const description = `${participants.length}인 단톡방 문서예요. 공유한 지 1일이 지나면 사라져요.`;

  return {
    title,
    description,
    robots,
    openGraph: { title, description, siteName: "단톡위키", type: "article" },
  };
}

export default async function SharedWikiLayout({
  children,
  params,
}: SharedWikiLayoutProps) {
  const { code } = await params;
  const sharedWiki = await loadSharedWiki(code);

  // 잘못된 코드, 만료·삭제된 문서, 복호화 실패는 모두 같은 "없는 링크" 화면(app/s/not-found.tsx)으로 보낸다.
  if (!sharedWiki) notFound();

  return (
    <SharedWikiLoader code={code} sharedWiki={sharedWiki}>
      {children}
    </SharedWikiLoader>
  );
}
