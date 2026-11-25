import type { Metadata } from "next";

import { NotFoundNotice } from "@/components/site/NotFoundNotice";

export const metadata: Metadata = {
  title: "사라진 문서 | 단톡위키",
};

/** 공유 링크가 잘못됐거나, 1일이 지나 삭제됐거나, 복호화할 수 없을 때 */
export default function SharedWikiNotFound() {
  return (
    <NotFoundNotice title="공유된 문서를 찾을 수 없습니다">
      <p>링크가 잘못되었거나, 공유한 지 1일이 지나 문서가 삭제되었어요.</p>
      <p>대문에서 대화 파일을 올리면 문서를 새로 만들 수 있어요.</p>
    </NotFoundNotice>
  );
}
