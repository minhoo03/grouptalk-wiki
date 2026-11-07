"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";

import { scrollToAnchor } from "@/utils/scrollToAnchor";
import { useFootnote } from "./FootnoteContext";
import { FootnoteLink } from "./FootnoteLink";

type TooltipPosition = {
  left: number;
  top: number;
  arrowLeft: number;
  isBelow: boolean;
};

type FootnoteRefProps = {
  n: number;
};

const VIEWPORT_MARGIN_PX = 12;
const ANCHOR_GAP_PX = 10;
const ARROW_EDGE_PX = 14;
/** [n]에서 tooltip 안의 링크까지 포인터를 옮길 수 있도록 닫기를 잠시 미룬다. */
const CLOSE_DELAY_MS = 140;

export function FootnoteRef({ n }: FootnoteRefProps) {
  const note = useFootnote(n);
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const tooltipId = `fn-tip-${n}`;

  function cancelClose() {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }

  function close() {
    cancelClose();
    setIsOpen(false);
    setPosition(null);
  }

  function handleShow() {
    cancelClose();
    if (note) setIsOpen(true);
  }

  function handleHideSoon() {
    cancelClose();
    closeTimerRef.current = window.setTimeout(close, CLOSE_DELAY_MS);
  }

  function handleAnchorClick(event: MouseEvent) {
    event.preventDefault();
    close();
    scrollToAnchor(`fn-${n}`);
  }

  function handleAnchorBlur(event: FocusEvent) {
    if (!tooltipRef.current?.contains(event.relatedTarget as Node | null))
      handleHideSoon();
  }

  function handleTooltipBlur(event: FocusEvent) {
    const nextFocus = event.relatedTarget as Node | null;
    if (
      !tooltipRef.current?.contains(nextFocus) &&
      nextFocus !== anchorRef.current
    )
      handleHideSoon();
  }

  useEffect(() => cancelClose, []);

  // tooltip 크기는 DOM에 그린 뒤에만 알 수 있으므로 paint 전에 위치를 측정한다.
  useLayoutEffect(() => {
    if (!isOpen) return;

    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (anchor && tooltip) {
      const rect = anchor.getBoundingClientRect();
      const width = tooltip.offsetWidth;
      const height = tooltip.offsetHeight;
      const center = rect.left + rect.width / 2;
      const left = Math.min(
        Math.max(center - width / 2, VIEWPORT_MARGIN_PX),
        window.innerWidth - width - VIEWPORT_MARGIN_PX,
      );
      const isBelow = rect.top - height - ANCHOR_GAP_PX < VIEWPORT_MARGIN_PX;
      setPosition({
        left,
        top: isBelow
          ? rect.bottom + ANCHOR_GAP_PX
          : rect.top - height - ANCHOR_GAP_PX,
        arrowLeft: Math.min(
          Math.max(center - left, ARROW_EDGE_PX),
          width - ARROW_EDGE_PX,
        ),
        isBelow,
      });
    }

    function handleClose() {
      setIsOpen(false);
      setPosition(null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }

    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <sup>
      <a
        ref={anchorRef}
        href={`#fn-${n}`}
        id={`fnref-${n}`}
        onClick={handleAnchorClick}
        onMouseEnter={handleShow}
        onMouseLeave={handleHideSoon}
        onFocus={handleShow}
        onBlur={handleAnchorBlur}
        aria-describedby={isOpen ? tooltipId : undefined}
        className="scroll-mt-24 rounded-[2px] px-px text-link hover:underline focus-visible:outline-2 focus-visible:outline-namu"
      >
        [{n}]
      </a>
      {/* isOpen은 사용자 상호작용 이후에만 true가 되므로 서버 렌더에서는 document에 접근하지 않는다. */}
      {isOpen &&
        note &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            onMouseEnter={cancelClose}
            onMouseLeave={handleHideSoon}
            onBlur={handleTooltipBlur}
            style={{
              position: "fixed",
              left: position?.left ?? -9999,
              top: position?.top ?? -9999,
              visibility: position ? "visible" : "hidden",
              transformOrigin: position
                ? `${position.arrowLeft}px ${position.isBelow ? "0%" : "100%"}`
                : "center",
            }}
            className="z-50 w-max max-w-[min(420px,calc(100vw-24px))] rounded-[6px] border border-line bg-white px-5 py-4 text-[15px] leading-relaxed text-ink shadow-[0_4px_16px_rgba(0,0,0,0.12)] duration-150 animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
          >
            <span className="mr-1.5 text-link">[{n}]</span>
            {note.content}
            {note.link && (
              <FootnoteLink target={note.link} onNavigate={close} />
            )}
            {position && (
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute h-2.5 w-2.5 rotate-45 border-line bg-white ${position.isBelow ? "-top-[6px] border-t border-l" : "-bottom-[6px] border-r border-b"}`}
                style={{ left: position.arrowLeft - 5 }}
              />
            )}
            {/* tooltip과 [n] 사이 틈을 덮어 포인터가 이동하는 동안 닫히지 않게 한다. */}
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 h-[12px] ${position?.isBelow ? "-top-[12px]" : "-bottom-[12px]"}`}
            />
          </div>,
          document.body,
        )}
    </sup>
  );
}
