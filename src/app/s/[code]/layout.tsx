import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { SharedWikiLoader } from "@/screens/shared/SharedWikiLoader";
import { getSharedWiki } from "@/services/sharedWiki/sharedWiki";

type SharedWikiLayoutProps = {
  children: ReactNode;
  params: Promise<{ code: string }>;
};

// 1일 뒤 사라지는 개인 대화 문서이므로 검색엔진에 노출하지 않는다.
const robots = { index: false, follow: false };

export const metadata: Metadata = {
  title: "공유된 단톡방 문서 | 단톡위키",
  robots,
};

export default async function SharedWikiLayout({
  children,
  params,
}: SharedWikiLayoutProps) {
  const { code } = await params;
  const sharedWiki = await getSharedWiki(code);

  // 잘못된 코드, 만료·삭제된 문서, 복호화 실패는 모두 같은 "없는 링크" 화면(app/s/not-found.tsx)으로 보낸다.
  if (!sharedWiki) notFound();

  return (
    <SharedWikiLoader code={code} sharedWiki={sharedWiki}>
      {children}
    </SharedWikiLoader>
  );
}
