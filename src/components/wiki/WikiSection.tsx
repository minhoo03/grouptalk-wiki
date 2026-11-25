"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { SectionNumberLink } from "@/components/wiki/SectionNumberLink";

type WikiSectionProps = {
  id: string;
  number: string;
  title: string;
  children: ReactNode;
};

export function WikiSection({ id, number, title, children }: WikiSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const bodyId = `${id}-body`;

  function toggle() {
    setIsOpen((open) => !open);
  }

  return (
    <section id={id} className="scroll-mt-20 pt-8">
      {/* 번호는 목차로 가는 링크라서 접기 버튼과 나눠 둔다(버튼 안에 링크를 둘 수 없다). */}
      <h2 className="flex items-center gap-2 border-b border-line pb-2">
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={toggle}
          className="shrink-0"
        >
          <ChevronDownIcon
            className={`h-5 w-5 text-subtle transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? "" : "-rotate-90"}`}
          />
        </button>
        <SectionNumberLink
          number={number}
          className="font-pixel text-2xl md:text-[28px]"
        />
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={toggle}
          className="flex-1 text-left font-pixel text-2xl text-ink md:text-[28px]"
        >
          {title}
        </button>
      </h2>
      {isOpen && (
        <div id={bodyId} className="pt-5 text-[15px] leading-[1.85] text-ink">
          {children}
        </div>
      )}
    </section>
  );
}
