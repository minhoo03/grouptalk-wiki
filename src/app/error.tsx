"use client";

import { AlertTriangleIcon, HomeIcon, RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

import { HOME_PATH } from "@/utils/wikiRoutes";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * 문서를 그리거나 공유 문서를 불러오다 예상하지 못한 오류가 났을 때 header·sidebar는 유지하고 본문만 대체한다.
 * 없는 링크·만료된 링크는 오류가 아니라 not-found.tsx가 처리한다.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const router = useRouter();

  // 서버에서 난 오류(예: DB 연결 실패)는 reset만으로 다시 요청되지 않으므로 route 데이터를 함께 새로 받는다.
  function handleRetry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  function handleGoHome() {
    router.push(HOME_PATH);
    reset();
  }

  // 외부 시스템(브라우저 console)에 오류를 남긴다.
  useEffect(() => {
    console.error("[단톡위키] 문서 렌더링 오류", error);
  }, [error]);

  return (
    <div role="alert" className="py-4">
      <div className="flex items-start gap-3">
        <AlertTriangleIcon
          className="mt-1 h-6 w-6 shrink-0 text-legend"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">
            문서를 표시하는 중 오류가 발생했습니다
          </h1>
          <p className="mt-2 text-[15px] text-ink">
            일시적인 문제일 수 있어요. 다시 시도하거나, 대문으로 돌아가 다른
            파일로 문서를 만들어 보세요.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-[6px] border-2 border-legend bg-[#FFF4E6] px-4 py-3">
        <p className="text-sm font-bold text-ink">
          {error.name}: <span className="font-normal">{error.message}</span>
        </p>
      </div>

      {error.stack && (
        <details className="mt-4 rounded-[6px] border border-line">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-bold text-ink hover:bg-paper">
            오류 상세 정보 보기
          </summary>
          <pre className="max-h-80 overflow-auto border-t border-line bg-paper px-4 py-3 text-xs leading-relaxed break-all whitespace-pre-wrap text-ink">
            {error.stack}
          </pre>
        </details>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleRetry}
          className="flex items-center gap-2 bg-white text-ink rounded-[6px] border-2 border-ink px-5 py-2.5 text-sm font-bold shadow-[3px_3px_0_0_#1E2A28] transition-transform duration-100 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
        >
          <RotateCcwIcon className="h-4 w-4" aria-hidden="true" />
          다시 시도
        </button>
        <button
          type="button"
          onClick={handleGoHome}
          className="flex items-center gap-2 bg-namu text-white rounded-[6px] border-2 border-ink px-5 py-2.5 text-sm font-bold shadow-[3px_3px_0_0_#1E2A28] transition-transform duration-100 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
        >
          <HomeIcon className="h-4 w-4" aria-hidden="true" />
          대문으로 돌아가기
        </button>
      </div>
    </div>
  );
}
