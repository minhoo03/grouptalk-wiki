import type { Metadata } from "next";

import { PageEnter } from "@/components/site/PageEnter";
import { RoomScreen } from "@/screens/room/RoomScreen";

export const metadata: Metadata = {
  title: "단톡방 문서 | 단톡위키",
};

export default function RoomPage() {
  return (
    <PageEnter>
      <RoomScreen />
    </PageEnter>
  );
}
