import { create } from "zustand";

import type { RoomProfile } from "@/types/chat";
import type { PersonProse, RoomWiki } from "@/types/wiki";

export type GeneratedWiki = {
  room: RoomProfile;
  wiki: RoomWiki;
  /** AI가 쓴 인물 문서 문단. 없거나 비어 있으면 규칙 기반 문장을 보여 준다. */
  personProse: PersonProse;
  /** 서술 일부라도 AI가 썼는지 */
  aiWritten: boolean;
};

type WikiStore = {
  generated: GeneratedWiki | null;
  /** 지금 문서가 공유 링크로 저장돼 있으면 그 코드. 새로 업로드한 문서는 null에서 시작한다. */
  shareCode: string | null;
  setGenerated: (generated: GeneratedWiki, shareCode?: string | null) => void;
  setShareCode: (shareCode: string) => void;
};

/**
 * 업로드한 대화로 만든 문서를 여러 route(대문·단톡방·인물·검색)와 header·sidebar가 함께 읽는다.
 * 메모리에만 두고 persist하지 않는다. 서버에는 사용자가 "공유"를 눌렀을 때만 암호화해 저장한다.
 * room과 wiki(와 공유 코드)는 항상 한 번에 바뀌도록 함께 저장한다.
 */
export const useWikiStore = create<WikiStore>((set) => ({
  generated: null,
  shareCode: null,
  setGenerated: (generated, shareCode = null) => set({ generated, shareCode }),
  setShareCode: (shareCode) => set({ shareCode }),
}));
