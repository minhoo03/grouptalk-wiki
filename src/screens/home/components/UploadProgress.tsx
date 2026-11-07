import { CheckIcon, XIcon } from "lucide-react";

import type { LoadStage } from "../utils/processChat";

type UploadProgressProps = {
  percent: number;
  stage: LoadStage;
  fileName: string;
  detail?: string;
  onCancel?: () => void;
};

const STEPS: { stage: Exclude<LoadStage, "done">; label: string }[] = [
  { stage: "read", label: "파일 읽기" },
  { stage: "parse", label: "대화 정리" },
  { stage: "analyze", label: "인물 분석" },
  { stage: "build", label: "문서 작성" },
  { stage: "ai", label: "AI 서술" },
];

const STAGE_TEXT: Record<LoadStage, string> = {
  read: "파일을 조금씩 나눠 읽고 있어요",
  parse: "메시지를 한 줄씩 정리하고 있어요",
  analyze: "구성원별 말버릇과 기록을 분석하고 있어요",
  build: "나무위키 문서를 작성하고 있어요",
  ai: "AI가 나무위키 문체로 서술을 다듬고 있어요",
  done: "문서가 완성됐어요",
};

export function UploadProgress({
  percent,
  stage,
  fileName,
  detail,
  onCancel,
}: UploadProgressProps) {
  const currentStepIndex =
    stage === "done"
      ? STEPS.length
      : STEPS.findIndex((step) => step.stage === stage);

  return (
    <div className="w-full max-w-lg text-left" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-4">
        <p className="truncate text-sm text-subtle">{fileName}</p>
        <p className="shrink-0 font-pixel text-lg text-ink tabular-nums">
          {percent}%
        </p>
      </div>

      <div
        className="mt-2 h-5 overflow-hidden rounded-[6px] border-2 border-ink bg-white"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="문서 생성 진행률"
      >
        <div
          className="h-full bg-namu transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-3 text-[15px] font-bold text-ink">
        {STAGE_TEXT[stage]}…
      </p>
      {detail && (
        <p className="mt-1 text-sm text-subtle tabular-nums">{detail}</p>
      )}

      <ol className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {STEPS.map((step, index) => {
          const isDone = index < currentStepIndex;
          const isActive = index === currentStepIndex;
          const boxClassName = isDone
            ? "border-namu bg-namu"
            : isActive
              ? "border-namu bg-white"
              : "border-line bg-white";
          return (
            <li
              key={step.stage}
              className={`flex items-center gap-1.5 text-sm ${isDone || isActive ? "text-ink" : "text-subtle"}`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 ${boxClassName}`}
                aria-hidden="true"
              >
                {isDone && (
                  <CheckIcon className="h-3 w-3 text-white" strokeWidth={3} />
                )}
              </span>
              <span className={isActive ? "font-bold" : ""}>{step.label}</span>
            </li>
          );
        })}
      </ol>

      {onCancel && stage !== "done" && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-5 flex items-center gap-1.5 rounded-[6px] border-2 border-ink bg-white px-3 py-1.5 text-sm text-ink transition-colors duration-150 hover:bg-paper"
        >
          <XIcon className="h-4 w-4" />
          취소
        </button>
      )}
    </div>
  );
}
