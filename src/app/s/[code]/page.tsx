import { PageEnter } from "@/components/site/PageEnter";
import { RoomScreen } from "@/screens/room/RoomScreen";

/** 공유된 단톡방 문서. 데이터와 metadata는 `/s/[code]` layout이 준비한다. */
export default function SharedRoomPage() {
  return (
    <PageEnter>
      <RoomScreen />
    </PageEnter>
  );
}
