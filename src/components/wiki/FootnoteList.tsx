"use client";

import { scrollToAnchor } from "@/utils/scrollToAnchor";
import type { FootnoteEntry } from "@/components/wiki/FootnoteContext";
import { FootnoteLink } from "@/components/wiki/FootnoteLink";

type FootnoteListProps = {
  notes: FootnoteEntry[];
};

export function FootnoteList({ notes }: FootnoteListProps) {
  return (
    <ol className="mt-12 space-y-1 border-t border-ink pt-5 text-[15px] leading-relaxed text-ink">
      {notes.map((note, index) => {
        const n = index + 1;
        return (
          <li
            key={n}
            id={`fn-${n}`}
            className="-mx-2 scroll-mt-24 rounded-[3px] px-2 py-1"
          >
            <a
              href={`#fnref-${n}`}
              onClick={(event) => {
                event.preventDefault();
                scrollToAnchor(`fnref-${n}`);
              }}
              className="mr-1.5 text-link hover:underline"
              aria-label={`본문의 각주 ${n}로 돌아가기`}
            >
              [{n}]
            </a>
            {note.content}
            {note.link && <FootnoteLink target={note.link} />}
          </li>
        );
      })}
    </ol>
  );
}
