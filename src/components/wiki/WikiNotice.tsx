import { ArrowRightIcon, LockIcon } from "lucide-react";
import type { ReactNode } from "react";

type WikiNoticeProps = {
  kind: "lock" | "redirect";
  children: ReactNode;
};

export function WikiNotice({ kind, children }: WikiNoticeProps) {
  return (
    <p className="flex items-start gap-2.5 text-[15px] leading-relaxed text-ink">
      {kind === "lock" ? (
        <LockIcon
          className="mt-0.5 h-5 w-5 shrink-0 text-subtle"
          aria-hidden="true"
        />
      ) : (
        <span
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-namu"
          aria-hidden="true"
        >
          <ArrowRightIcon className="h-3.5 w-3.5 text-white" strokeWidth={3} />
        </span>
      )}
      <span>{children}</span>
    </p>
  );
}
