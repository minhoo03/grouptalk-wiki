"use client";

import {
  ArrowRightIcon,
  BookOpenIcon,
  MessagesSquareIcon,
  SearchIcon,
  ShuffleIcon,
  SproutIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useWikiStore } from "@/store/wikiStore";
import {
  HOME_PATH,
  ROOM_PATH,
  personPath,
  resolveSearchPath,
} from "@/utils/wikiRoutes";

const NAV_ITEM_CLASS_NAME =
  "flex items-center gap-1.5 whitespace-nowrap rounded-[6px] px-2.5 py-2 text-[15px] font-bold text-white transition-colors duration-150 hover:bg-namu-dark";

export function SiteHeader() {
  const router = useRouter();
  const room = useWikiStore((state) => state.generated?.room ?? null);
  const [query, setQuery] = useState("");

  const hasRoom = room !== null;
  const names = room?.participants.map((person) => person.name) ?? [];
  const suggestions = room ? [room.roomTitle, ...names] : [];

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    router.push(resolveSearchPath(room, trimmedQuery));
    setQuery("");
  }

  function handleRandom() {
    if (names.length === 0) return;
    // 인물 문서에서 누르면 가능한 한 다른 사람으로 이동한다.
    // event handler 안에서만 현재 URL을 읽어 layout 전체가 useSearchParams의 Suspense 경계를 갖지 않게 한다.
    const currentUrl = new URL(window.location.href);
    const currentName =
      currentUrl.pathname === "/person"
        ? currentUrl.searchParams.get("name")
        : null;
    const pool =
      currentName && names.length > 1
        ? names.filter((name) => name !== currentName)
        : names;
    router.push(personPath(pool[Math.floor(Math.random() * pool.length)]));
  }

  return (
    <header className="sticky top-0 z-20 w-full border-b-[3px] border-ink bg-namu">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-2 px-4 md:gap-6">
        <Link
          href={HOME_PATH}
          className="flex shrink-0 items-center gap-2 text-white"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-[6px] border-2 border-ink bg-white shadow-[2px_2px_0_0_#1E2A28]">
            <SproutIcon className="h-5 w-5 text-namu" strokeWidth={2.5} />
          </span>
          <span className="hidden font-pixel text-xl sm:inline">단톡위키</span>
        </Link>

        <nav aria-label="주 메뉴" className="flex items-center gap-1">
          <Link href={HOME_PATH} className={NAV_ITEM_CLASS_NAME}>
            <BookOpenIcon className="h-4 w-4" />
            <span className="hidden md:inline">대문</span>
          </Link>
          {hasRoom ? (
            <Link href={ROOM_PATH} className={NAV_ITEM_CLASS_NAME}>
              <MessagesSquareIcon className="h-4 w-4" />
              <span className="hidden md:inline">단톡방 문서</span>
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={`${NAV_ITEM_CLASS_NAME} cursor-not-allowed opacity-50 hover:bg-transparent`}
            >
              <MessagesSquareIcon className="h-4 w-4" />
              <span className="hidden md:inline">단톡방 문서</span>
            </span>
          )}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={handleRandom}
            disabled={!hasRoom}
            aria-label="랜덤 문서"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border-2 border-ink bg-white shadow-[2px_2px_0_0_#1E2A28] transition-transform duration-100 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60"
          >
            <ShuffleIcon className="h-4 w-4 text-ink" />
          </button>
          <form
            onSubmit={handleSearch}
            role="search"
            className="flex h-10 min-w-0 items-center rounded-[6px] border-2 border-ink bg-white shadow-[2px_2px_0_0_#1E2A28]"
          >
            <label htmlFor="wiki-search" className="sr-only">
              문서 검색
            </label>
            <input
              id="wiki-search"
              list="wiki-suggestions"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="여기에서 검색"
              className="w-28 min-w-0 bg-transparent px-3 text-sm text-ink placeholder:text-subtle focus:outline-none sm:w-56"
            />
            <datalist id="wiki-suggestions">
              {suggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
            <button type="submit" aria-label="검색" className="px-2 text-ink">
              <SearchIcon className="h-4 w-4" />
            </button>
            <button
              type="submit"
              aria-label="이동"
              className="hidden pr-2.5 text-ink sm:block"
            >
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
