"use client";

import { useEffect, type ReactNode } from "react";

import type { SharedWiki } from "@/services/sharedWiki/sharedWiki.schema";
import { useWikiStore } from "@/store/wikiStore";

type SharedWikiLoaderProps = {
  code: string;
  sharedWiki: SharedWiki;
  children: ReactNode;
};

/**
 * 서버에서 복호화한 공유 문서를 store에 넣은 뒤 `/s/[code]` 아래 화면(단톡방·인물·검색)을 그린다.
 * layout에서 쓰므로 같은 공유 문서 안에서 이동할 때는 다시 불러오지 않는다.
 */
export function SharedWikiLoader({
  code,
  sharedWiki,
  children,
}: SharedWikiLoaderProps) {
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

  return children;
}
