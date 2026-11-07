import Link from "next/link";
import type { ReactNode } from "react";

type DocActionButtonProps = {
  icon: ReactNode;
  label: string;
  href: string;
};

export function DocActionButton({ icon, label, href }: DocActionButtonProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 border-l-2 border-ink px-3 py-2 text-sm whitespace-nowrap text-ink transition-colors duration-150 hover:bg-paper focus-visible:bg-paper focus-visible:outline-none"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
