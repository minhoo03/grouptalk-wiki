import { TOC_ANCHOR_ID } from "@/components/wiki/TableOfContents";

type SectionNumberLinkProps = {
  number: string;
  className?: string;
};

/** 나무위키처럼 문단 번호를 누르면 목차로 바로 돌아간다. */
export function SectionNumberLink({ number, className }: SectionNumberLinkProps) {
  return (
    <a
      href={`#${TOC_ANCHOR_ID}`}
      className={`text-link hover:underline ${className ?? ""}`}
      aria-label={`${number}. 목차로 이동`}
    >
      {number}.
    </a>
  );
}
