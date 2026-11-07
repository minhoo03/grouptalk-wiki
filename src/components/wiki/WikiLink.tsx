import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

type WikiLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function WikiLink({ href, children, className }: WikiLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-[2px] text-link hover:underline focus-visible:ring-2 focus-visible:ring-link/40 focus-visible:outline-none",
        className,
      )}
    >
      {children}
    </Link>
  );
}
