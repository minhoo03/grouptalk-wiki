"use client";

import { ChevronRightIcon, HistoryIcon, TrendingUpIcon } from "lucide-react";
import Link from "next/link";

import { WikiLink } from "@/components/wiki/WikiLink";
import { useWikiStore } from "@/store/wikiStore";
import { formatTime, truncate } from "@/utils/format";
import { ROOM_PATH, personPath } from "@/utils/wikiRoutes";

const PANEL_CLASS_NAME =
  "rounded-[6px] border-2 border-ink bg-white p-5 shadow-[4px_4px_0_0_#1E2A28]";
const TOP_WORD_LIMIT = 10;
const HIGHLIGHTED_RANK_COUNT = 3;
const RECENT_MESSAGE_PREVIEW_LENGTH = 40;

export function Sidebar() {
  const room = useWikiStore((state) => state.generated?.room ?? null);
  const topWords = room?.topWords.slice(0, TOP_WORD_LIMIT) ?? [];

  return (
    <aside className="flex flex-col gap-6" aria-label="사이드바">
      <section className={PANEL_CLASS_NAME}>
        <h2 className="flex items-center gap-2 font-pixel text-base text-ink">
          <TrendingUpIcon className="h-4 w-4 text-namu" />
          실시간 인기 단어
        </h2>
        {topWords.length > 0 ? (
          <ol className="mt-3 space-y-1.5">
            {topWords.map((word, index) => (
              <li
                key={word.word}
                className="flex items-center gap-3 text-[15px]"
              >
                <span
                  className={`w-5 text-right font-pixel text-sm ${index < HIGHLIGHTED_RANK_COUNT ? "text-namu" : "text-subtle"}`}
                >
                  {index + 1}
                </span>
                <span className="flex-1 truncate text-ink">{word.word}</span>
                <span className="text-xs text-subtle tabular-nums">
                  {word.count}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-subtle">
            대화를 올리면 단톡방에서 가장 많이 나온 단어가 여기에 떠요.
          </p>
        )}
      </section>

      <section className={PANEL_CLASS_NAME}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-pixel text-base text-ink">
            <HistoryIcon className="h-4 w-4 text-namu" />
            최근 발언
          </h2>
          {room && (
            <Link
              href={ROOM_PATH}
              aria-label="단톡방 문서로"
              className="text-subtle hover:text-ink"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </Link>
          )}
        </div>
        {room ? (
          <ul className="mt-3 space-y-3">
            {room.recentMessages.map((message, index) => (
              <li key={index} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <WikiLink
                    href={personPath(message.author)}
                    className="text-[15px]"
                  >
                    {message.author}
                  </WikiLink>
                  <span className="shrink-0 text-xs text-subtle">
                    {formatTime(message.hour, message.minute)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-subtle">
                  {truncate(message.text, RECENT_MESSAGE_PREVIEW_LENGTH)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-subtle">아직 올린 대화가 없어요.</p>
        )}
      </section>
    </aside>
  );
}
