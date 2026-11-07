"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

export type TocItem = {
  id: string;
  number: string;
  title: string;
};

type TableOfContentsProps = {
  items: TocItem[];
};

const INDENT_PER_DEPTH_PX = 16;

export function TableOfContents({ items }: TableOfContentsProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <nav
      aria-label="목차"
      className="w-full rounded-[6px] border-2 border-ink bg-white px-5 py-4 md:max-w-[300px]"
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between"
      >
        <span className="font-pixel text-lg text-ink">목차</span>
        <ChevronDownIcon
          className={`h-5 w-5 text-subtle transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
        />
      </button>
      {isOpen && (
        <ol className="mt-3 space-y-1.5">
          {items.map((item) => {
            const depth = item.number.split(".").length - 1;
            return (
              <li
                key={item.id}
                style={{ paddingLeft: `${depth * INDENT_PER_DEPTH_PX}px` }}
              >
                <a
                  href={`#${item.id}`}
                  className="text-[15px] text-ink hover:underline"
                >
                  <span className="text-link">{item.number}.</span> {item.title}
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
