import type { ReactNode } from "react";

type PageEnterProps = {
  children: ReactNode;
};

/**
 * 문서가 바뀔 때 아래에서 살짝 올라오며 나타나는 전환 효과.
 * 같은 route 안에서 문서만 바뀌는 경우(인물 → 인물)에도 다시 실행되도록 사용하는 쪽에서 문서마다 key를 준다.
 * 움직임 줄이기 설정에서는 투명도만 바뀐다.
 */
export function PageEnter({ children }: PageEnterProps) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1.5 duration-180 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:slide-in-from-bottom-0">
      {children}
    </div>
  );
}
