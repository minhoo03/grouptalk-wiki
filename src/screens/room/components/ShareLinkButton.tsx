"use client";

import { useMutation } from "@tanstack/react-query";
import { CheckIcon, Share2Icon } from "lucide-react";
import { useState } from "react";

import { useWikiStore } from "@/store/wikiStore";
import { sharedWikiPath } from "@/utils/wikiRoutes";
import { createShareLinkAction } from "@/screens/room/createShareLinkAction";

type ShareStatus =
  | { kind: "idle" }
  /** copied: null이면 복사 시도 중, false면 직접 복사해야 함 */
  | { kind: "ready"; url: string; copied: boolean | null }
  | { kind: "error"; message: string };

function toShareUrl(code: string) {
  return new URL(sharedWikiPath(code), window.location.origin).toString();
}

/** 클립보드 권한이 없거나 거부되면 false. 권한 요청 등으로 끝나지 않을 수 있으므로 결과를 기다려 UI를 막지 않는다. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * 단톡방 문서를 1일짜리 공유 링크로 만든다.
 * 이미 공유된 문서(공유 링크로 들어왔거나 한 번 만든 경우)는 서버에 다시 저장하지 않고 링크만 복사한다.
 */
export function ShareLinkButton() {
  const generated = useWikiStore((state) => state.generated);
  const shareCode = useWikiStore((state) => state.shareCode);
  const setShareCode = useWikiStore((state) => state.setShareCode);
  const [status, setStatus] = useState<ShareStatus>({ kind: "idle" });

  const { mutate, isPending } = useMutation({
    mutationFn: createShareLinkAction,
    // onSuccess가 끝나야 isPending이 풀리므로 여기서 클립보드 결과를 기다리지 않는다.
    onSuccess: (result) => {
      if (!result.ok) {
        setStatus({ kind: "error", message: result.message });
        return;
      }
      setShareCode(result.code);
      showLink(result.code);
    },
    onError: () => {
      setStatus({
        kind: "error",
        message: "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
      });
    },
  });

  /** 링크는 바로 보여 주고, 클립보드 복사 결과는 끝나는 대로 덧붙인다. */
  function showLink(code: string) {
    const url = toShareUrl(code);
    setStatus({ kind: "ready", url, copied: null });
    void copyText(url).then((copied) => {
      setStatus((current) =>
        current.kind === "ready" && current.url === url
          ? { ...current, copied }
          : current,
      );
    });
  }

  function handleClick() {
    if (!generated || isPending) return;
    if (shareCode) {
      showLink(shareCode);
      return;
    }
    setStatus({ kind: "idle" });
    mutate(generated);
  }

  return (
    <div className="relative border-l-2 border-ink">
      <button
        type="button"
        onClick={handleClick}
        disabled={!generated || isPending}
        className="flex h-full items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap text-ink transition-colors duration-150 hover:bg-paper focus-visible:bg-paper focus-visible:outline-none disabled:opacity-60"
      >
        {status.kind === "ready" && status.copied ? (
          <CheckIcon className="h-4 w-4" />
        ) : (
          <Share2Icon className="h-4 w-4" />
        )}
        <span>{isPending ? "링크 만드는 중…" : "공유"}</span>
      </button>

      {status.kind !== "idle" && (
        <div
          role={status.kind === "error" ? "alert" : "status"}
          className="absolute top-full right-0 z-10 mt-2 w-72 rounded-[6px] border-2 border-ink bg-white px-3 py-2.5 text-left text-xs text-ink shadow-[3px_3px_0_0_#1E2A28]"
        >
          {status.kind === "error" && status.message}
          {status.kind === "ready" && (
            <>
              <p>
                {status.copied
                  ? "링크를 복사했어요. 만든 지 1일이 지나면 사라져요."
                  : "아래 링크를 복사해 공유하세요. 만든 지 1일이 지나면 사라져요."}
              </p>
              <input
                readOnly
                value={status.url}
                aria-label="공유 링크"
                onFocus={(event) => event.currentTarget.select()}
                className="mt-1.5 w-full rounded-[4px] border border-line px-2 py-1"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
