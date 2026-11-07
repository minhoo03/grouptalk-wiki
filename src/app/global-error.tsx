"use client";

import { useEffect } from "react";

import "@/styles/globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * root layout(header·sidebar·Provider) 자체가 렌더링에 실패했을 때의 마지막 Error Boundary.
 * layout을 대체하므로 html·body를 직접 그리고, client router 대신 전체 새로고침으로 대문에 돌아간다.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  // 외부 시스템(브라우저 console)에 오류를 남긴다.
  useEffect(() => {
    console.error("[단톡위키] 앱 전체 렌더링 오류", error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="min-h-screen bg-paper text-ink">
        <main
          role="alert"
          className="mx-auto mt-16 max-w-xl rounded-[6px] border-2 border-ink bg-white px-6 py-8 shadow-[5px_5px_0_0_#1E2A28]"
        >
          <h1 className="text-2xl font-bold">단톡위키를 표시하지 못했습니다</h1>
          <p className="mt-2 text-[15px]">
            예상하지 못한 오류가 발생했어요. 다시 시도하거나 대문으로 돌아가
            주세요.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-[6px] border-2 border-ink bg-white px-5 py-2.5 text-sm font-bold"
            >
              다시 시도
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 깨진 앱 상태를 버리기 위해 전체 새로고침한다. */}
            <a
              href="/"
              className="rounded-[6px] border-2 border-ink bg-namu px-5 py-2.5 text-sm font-bold text-white"
            >
              대문으로 돌아가기
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
