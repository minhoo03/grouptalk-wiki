import type { Metadata } from "next";

import { NotFoundNotice } from "@/components/site/NotFoundNotice";

export const metadata: Metadata = {
  title: "없는 페이지 | 단톡위키",
};

/** 존재하지 않는 주소로 들어왔을 때 */
export default function NotFound() {
  return (
    <NotFoundNotice title="페이지를 찾을 수 없습니다">
      <p>주소가 잘못되었거나 더 이상 없는 페이지예요.</p>
    </NotFoundNotice>
  );
}
