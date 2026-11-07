import { FileQuestionIcon, HomeIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { HOME_PATH } from "@/utils/wikiRoutes";

type NotFoundNoticeProps = {
  title: string;
  children: ReactNode;
};

/** route의 not-found 화면이 공유하는 안내. 항상 대문으로 돌아가는 길을 함께 보여 준다. */
export function NotFoundNotice({ title, children }: NotFoundNoticeProps) {
  return (
    <div className="py-4">
      <div className="flex items-start gap-3">
        <FileQuestionIcon
          className="mt-1 h-6 w-6 shrink-0 text-subtle"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          <div className="mt-2 space-y-1 text-[15px] leading-relaxed text-ink">
            {children}
          </div>
        </div>
      </div>

      <Link
        href={HOME_PATH}
        className="mt-6 inline-flex items-center gap-2 rounded-[6px] border-2 border-ink bg-namu px-5 py-2.5 text-sm font-bold text-white shadow-[3px_3px_0_0_#1E2A28] transition-transform duration-100 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
      >
        <HomeIcon className="h-4 w-4" aria-hidden="true" />
        대문으로 돌아가기
      </Link>
    </div>
  );
}
