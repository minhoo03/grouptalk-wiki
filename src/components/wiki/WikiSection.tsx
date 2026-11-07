"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

type WikiSectionProps = {
  id: string;
  number: string;
  title: string;
  children: ReactNode;
};

export function WikiSection({ id, number, title, children }: WikiSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const bodyId = `${id}-body`;

  return (
    <section id={id} className="scroll-mt-20 pt-8">
      <h2 className="border-b border-line pb-2">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => setIsOpen((open) => !open)}
          className="group flex w-full items-center gap-2 text-left"
        >
          <ChevronDownIcon
            className={`h-5 w-5 shrink-0 text-subtle transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? "" : "-rotate-90"}`}
            aria-hidden="true"
          />
          <span className="font-pixel text-2xl text-link md:text-[28px]">
            {number}.
          </span>
          <span className="font-pixel text-2xl text-ink md:text-[28px]">
            {title}
          </span>
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
