"use client";

import { useEffect } from "react";

import { RoomScreen } from "@/screens/room/RoomScreen";
import type { SharedWiki } from "@/services/sharedWiki/sharedWiki.schema";
import { useWikiStore } from "@/store/wikiStore";

type SharedWikiScreenProps = {
  code: string;
  sharedWiki: SharedWiki;
};

/**
 * 서버에서 복호화한 공유 문서를 store에 넣고 단톡방 문서를 그린다.
 * header·sidebar·인물 문서가 같은 store를 읽으므로, 공유 링크로 들어와도 인물 문서 링크가 그대로 동작한다.
 */
export function SharedWikiScreen({ code, sharedWiki }: SharedWikiScreenProps) {
  const setGenerated = useWikiStore((state) => state.setGenerated);
  const isLoaded = useWikiStore(
    (state) => state.shareCode === code && state.generated !== null,
  );

  // 외부(다른 route들이 공유하는 store)와 서버 데이터를 동기화한다.
  useEffect(() => {
    setGenerated(sharedWiki, code);
  }, [code, sharedWiki, setGenerated]);

  // store에 반영되기 전 한 번의 렌더에서 "없는 문서"가 깜빡이지 않게 한다.
  if (!isLoaded) return null;

  return <RoomScreen />;
}
