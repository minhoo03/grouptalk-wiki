import type { ReactNode } from "react";
import type { Block } from "@/types/wiki";
import { HourChart } from "@/components/wiki/HourChart";
import { InlineRich } from "@/components/wiki/InlineRich";
import { QuoteBox } from "@/components/wiki/QuoteBox";
import { MIN_BAR_PERCENT } from "@/components/wiki/StatBar";

type BlockRendererProps = {
  blocks: Block[];
};

/** 나무위키 접기({{{#!folding}}}). label이 없으면 그대로 펼쳐 둔다. */
function Fold({ label, children }: { label?: string; children: ReactNode }) {
  if (!label) return <>{children}</>;
  return (
    <details className="group rounded-[6px] border border-line">
      <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-namu select-none">
        {label}
      </summary>
      <div className="p-3 pt-0">{children}</div>
    </details>
  );
}

export function BlockRenderer({ blocks }: BlockRendererProps) {
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "p":
            return (
              <p key={index}>
                <InlineRich content={block.content} />
              </p>
            );
          case "list":
            return (
              <ul key={index} className="list-disc space-y-1.5 pl-6">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <InlineRich content={item} />
                  </li>
                ))}
              </ul>
            );
          case "facts":
            // AI 입력용 계산값. 화면에는 그리지 않는다.
            return null;
          case "fold":
            return (
              <Fold key={index} label={block.label}>
                <BlockRenderer blocks={block.blocks} />
              </Fold>
            );
          case "h":
            return (
              <h4 key={index} className="pt-2 text-base font-bold">
                {block.text}
              </h4>
            );
          case "table":
            return (
              <Fold key={index} label={block.fold}>
                <div className="overflow-x-auto rounded-[6px] border-2 border-ink">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead className="bg-namu text-white">
                      <tr>
                        {block.head.map((heading, headingIndex) => (
                          <th
                            key={headingIndex}
                            scope="col"
                            className="px-3 py-2.5 font-bold whitespace-nowrap"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t border-line">
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="px-3 py-2.5 align-top text-ink"
                            >
                              <InlineRich content={cell} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Fold>
            );
          case "bars":
            return (
              <ul key={index} className="max-w-2xl space-y-2.5">
                {block.items.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    className="grid grid-cols-[110px_1fr_auto] items-center gap-3 sm:grid-cols-[150px_1fr_auto]"
                  >
                    <span className="truncate text-sm">
                      <InlineRich content={item.label} />
                    </span>
                    <span className="h-3 overflow-hidden rounded-[2px] border border-ink bg-white">
                      <span
                        className="block h-full bg-namu"
                        style={{
                          width: `${Math.max(item.value, MIN_BAR_PERCENT)}%`,
                        }}
                      />
                    </span>
                    <span className="text-right text-xs whitespace-nowrap text-subtle tabular-nums">
                      {item.raw}
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "hours":
            return (
              <HourChart key={index} data={block.data} label={block.label} />
            );
          case "quote":
            return (
              <QuoteBox
                key={index}
                quote={block.quote}
                caption={<InlineRich content={block.caption} />}
              />
            );
          case "dialogue":
            return (
              <Fold key={index} label={block.fold}>
                <blockquote className="space-y-1 border-l-4 border-namu bg-paper px-4 py-3 text-[15px]">
                  {block.lines.map((line, lineIndex) => (
                    <p key={lineIndex} className="whitespace-pre-line">
                      <span className="font-bold">{line.author}</span>
                      <span className="text-subtle">: </span>
                      {line.text}
                    </p>
                  ))}
                </blockquote>
              </Fold>
            );
        }
      })}
    </div>
  );
}
