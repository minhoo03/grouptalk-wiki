import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageEnter } from "@/components/site/PageEnter";
import { SharedWikiScreen } from "@/screens/shared/SharedWikiScreen";
import { getSharedWiki } from "@/services/sharedWiki/sharedWiki";

type SharedWikiPageProps = {
  params: Promise<{ code: string }>;
};

export const metadata: Metadata = {
  title: "공유된 단톡방 문서 | 단톡위키",
  // 1일 뒤 사라지는 개인 대화 문서이므로 검색엔진에 노출하지 않는다.
  robots: { index: false, follow: false },
};

export default async function SharedWikiPage({ params }: SharedWikiPageProps) {
  const { code } = await params;
  const sharedWiki = await getSharedWiki(code);

  // 잘못된 코드, 만료·삭제된 문서, 복호화 실패는 모두 같은 "없는 링크" 화면으로 보낸다.
  if (!sharedWiki) notFound();

  return (
    <PageEnter key={code}>
      <SharedWikiScreen code={code} sharedWiki={sharedWiki} />
    </PageEnter>
  );
}
