"use client";

import { StarIcon } from "lucide-react";
import Link from "next/link";
import {
  Fragment,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { formatDateTime } from "@/utils/format";

type Category = {
  label: string;
  href?: string;
};

type DocHeaderProps = {
  title: string;
  categories: Category[];
  actions?: ReactNode;
};

function subscribeNothing() {
  return () => {};
}

export function DocHeader({ title, categories, actions }: DocHeaderProps) {
  // "최근 수정 시각"은 문서를 연 시각이다. 서버 렌더(빌드 시각)와 달라지지 않도록 hydration 이후에만 표시한다.
  const [openedAt] = useState(() => new Date());
  const isHydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const [isStarred, setIsStarred] = useState(false);

  // 제목마다 고정되는 장식용 별 개수
  const baseStars = ((title.length * 37) % 180) + 12;

  return (
    <header>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="font-pixel text-3xl leading-tight text-ink md:text-[40px]">
            {title}
          </h1>
          <p className="mt-2 text-sm text-subtle">
            최근 수정 시각: {isHydrated && formatDateTime(openedAt, true)}
          </p>
        </div>
        <div className="flex shrink-0 self-start rounded-[6px] border-2 border-ink bg-white shadow-[3px_3px_0_0_#1E2A28]">
          <button
            type="button"
            aria-pressed={isStarred}
            aria-label="이 문서 별표"
            onClick={() => setIsStarred((starred) => !starred)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm transition-colors duration-150 hover:bg-paper"
          >
            <StarIcon
              className={
                isStarred ? "h-4 w-4 fill-gold text-gold" : "h-4 w-4 text-ink"
              }
            />
            <span className="font-pixel text-xs tabular-nums">
              {baseStars + (isStarred ? 1 : 0)}
            </span>
          </button>
          {actions}
        </div>
      </div>
      <nav
        aria-label="분류"
        className="mt-6 rounded-[6px] border border-line px-3 py-2 text-sm"
      >
        <span className="text-ink">분류: </span>
        {categories.map((category, index) => (
          <Fragment key={category.label}>
            {index > 0 && <span className="mx-1.5 text-line">|</span>}
            {category.href ? (
              <Link href={category.href} className="text-link hover:underline">
                {category.label}
              </Link>
            ) : (
              <span className="text-link">{category.label}</span>
            )}
          </Fragment>
        ))}
      </nav>
    </header>
  );
}
