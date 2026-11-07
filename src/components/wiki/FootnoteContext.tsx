"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * 각주가 가리키는 관련 문단.
 * `href`가 있으면 다른 문서로 이동한 뒤 `anchorId`로 스크롤하고, 없으면 현재 문서 안에서 스크롤한다.
 */
export type FootnoteLinkTarget = {
  label: string;
  anchorId: string;
  href?: string;
};

export type FootnoteEntry = {
  content: ReactNode;
  link?: FootnoteLinkTarget;
};

const FootnoteContext = createContext<FootnoteEntry[]>([]);

type FootnoteProviderProps = {
  notes: FootnoteEntry[];
  children: ReactNode;
};

/** 문서의 모든 [n] 참조가 hover 미리보기에 같은 각주 목록을 사용하게 한다. */
export function FootnoteProvider({ notes, children }: FootnoteProviderProps) {
  return (
    <FootnoteContext.Provider value={notes}>
      {children}
    </FootnoteContext.Provider>
  );
}

export function useFootnote(n: number): FootnoteEntry | undefined {
  return useContext(FootnoteContext)[n - 1];
}
