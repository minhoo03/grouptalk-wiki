import type { ReactNode } from "react";

type QuoteBoxProps = {
  quote: string;
  caption: ReactNode;
};

export function QuoteBox({ quote, caption }: QuoteBoxProps) {
  return (
    <figure className="mb-5 flex max-w-xl overflow-hidden rounded-[6px] border-2 border-namu">
      <span className="w-8 shrink-0 bg-namu" aria-hidden="true" />
      <div className="flex-1 px-6 py-5">
        <blockquote className="text-base font-bold whitespace-pre-line text-ink">
          {quote}
        </blockquote>
        <figcaption className="mt-3 border-t border-line pt-3 text-sm text-ink">
          {caption}
        </figcaption>
      </div>
    </figure>
  );
}
