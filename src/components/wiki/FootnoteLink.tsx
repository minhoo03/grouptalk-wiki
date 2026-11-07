"use client";

import { LinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  scrollToAnchor,
  scrollToAnchorWhenReady,
} from "@/utils/scrollToAnchor";
import type { FootnoteLinkTarget } from "./FootnoteContext";

type FootnoteLinkProps = {
  target: FootnoteLinkTarget;
  onNavigate?: () => void;
};

/** 각주 끝에 붙는 나무위키식 링크: 초록 링크 아이콘 + 이동할 문단 이름 */
export function FootnoteLink({ target, onNavigate }: FootnoteLinkProps) {
  const router = useRouter();

  function handleNavigate() {
    onNavigate?.();
    if (target.href) {
      router.push(target.href);
      // 다른 문서의 문단은 화면 전환이 끝난 뒤에 생기므로 나타날 때까지 기다렸다가 스크롤한다.
      scrollToAnchorWhenReady(target.anchorId);
      return;
    }
    scrollToAnchor(target.anchorId);
  }

  return (
    <button
      type="button"
      onClick={handleNavigate}
      className="ml-1.5 inline-flex items-baseline gap-1 rounded-[2px] align-baseline text-namu hover:underline focus-visible:outline-2 focus-visible:outline-namu"
      aria-label={`관련 문단으로 이동: ${target.label}`}
    >
      <span
        className="inline-flex h-[1.1em] w-[1.35em] translate-y-[0.15em] items-center justify-center rounded-[3px] bg-namu"
        aria-hidden="true"
      >
        <LinkIcon
          className="h-[0.75em] w-[0.75em] text-white"
          strokeWidth={2.75}
        />
      </span>
      <span>{target.label}</span>
    </button>
  );
}
