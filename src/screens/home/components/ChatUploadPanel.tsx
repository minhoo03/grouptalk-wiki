"use client";

import {
  AlertTriangleIcon,
  FileTextIcon,
  PlayIcon,
  UploadIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";

import { useWikiStore } from "@/store/wikiStore";
import { ROOM_PATH } from "@/utils/wikiRoutes";
import { sampleChat, sampleChatFileName } from "@/screens/home/sampleChat";
import {
  isChatLoadError,
  processChat,
  type ChatSource,
  type LoadStage,
} from "@/screens/home/utils/processChat";
import { isAbortError } from "@/screens/home/utils/slicing";
import { writeAiProse } from "@/screens/home/utils/aiProse/writeAiProse";
import type {
  ParticipantCandidates,
  ParticipantDecisions,
} from "@/screens/home/utils/participants";
import { ParticipantReview } from "@/screens/home/components/ParticipantReview";
import { UploadProgress } from "@/screens/home/components/UploadProgress";

type ProgressState = {
  percent: number;
  stage: LoadStage;
  fileName: string;
  detail?: string;
};

const MAX_FILE_BYTES = 40 * 1024 * 1024;
/** 브라우저 분석이 진행률의 이 지점까지를 차지하고, 나머지는 AI 서술 단계다. */
const LOCAL_PROGRESS_SHARE = 0.85;
const ACCEPTED_FILE_NAME = /\.(csv|txt)$/i;
const ACCEPTED_MIME_TYPES = ["text/csv", "text/plain"];

const PRIMARY_BUTTON_CLASS_NAME =
  "flex items-center justify-center gap-2 rounded-[6px] border-2 border-ink px-5 py-2.5 font-pixel text-sm shadow-[3px_3px_0_0_#1E2A28] transition-transform duration-100 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-60";

function validateChatFile(file: File): string | null {
  const isAcceptedType =
    ACCEPTED_FILE_NAME.test(file.name) ||
    ACCEPTED_MIME_TYPES.includes(file.type);
  if (!isAcceptedType) {
    return '.csv 또는 .txt 파일만 올릴 수 있어요. 카카오톡 "대화 내보내기"로 저장한 파일을 선택해 주세요.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return "파일이 너무 커요. 40MB 이하의 대화 파일을 올려 주세요.";
  }
  return null;
}

function toErrorMessage(error: unknown) {
  if (isChatLoadError(error)) return error.message;
  console.error("[단톡위키] 문서 생성 오류", error);
  const detail =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return `문서를 만드는 중 문제가 생겼어요. (${detail})`;
}

/**
 * 대화 파일을 받아 브라우저 안에서 분석하고, 통계와 대표 발언만 서버로 보내 AI 서술을 입힌 뒤
 * 완성된 문서를 store에 넣고 단톡방 문서로 이동한다.
 */
export function ChatUploadPanel() {
  const router = useRouter();
  const setGenerated = useWikiStore((state) => state.setGenerated);
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** 봇 후보 확인을 기다리는 중이면 그 후보 */
  const [review, setReview] = useState<ParticipantCandidates | null>(null);
  const reviewRef = useRef<{
    resolve: (decisions: ParticipantDecisions) => void;
    reject: (reason: unknown) => void;
  } | null>(null);

  const isLoading = progress !== null;

  /** processChat이 분석을 멈추고 사용자의 확인을 기다린다. */
  function requestReview(candidates: ParticipantCandidates) {
    return new Promise<ParticipantDecisions>((resolve, reject) => {
      reviewRef.current = { resolve, reject };
      setReview(candidates);
    });
  }

  function handleReviewConfirm(decisions: ParticipantDecisions) {
    reviewRef.current?.resolve(decisions);
    reviewRef.current = null;
    setReview(null);
  }

  async function generateWiki(source: ChatSource, fileName: string) {
    // 이미 진행 중인 작업이 있으면 중복 클릭·드롭을 무시한다.
    if (controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setErrorMessage(null);
    setProgress({ percent: 0, stage: "read", fileName });

    try {
      const result = await processChat(
        source,
        (percent, stage, detail) => {
          if (controller.signal.aborted || stage === "done") return;
          setProgress({
            percent: Math.round(percent * LOCAL_PROGRESS_SHARE),
            stage,
            fileName,
            detail,
          });
        },
        controller.signal,
        requestReview,
      );
      if (controller.signal.aborted) return;

      // 실패해도 throw하지 않고 규칙 기반 문서를 돌려준다.
      const generated = await writeAiProse(
        result,
        (done, total) => {
          if (controller.signal.aborted) return;
          const aiShare = total ? done / total : 1;
          setProgress({
            percent: Math.round(
              100 *
                (LOCAL_PROGRESS_SHARE + (1 - LOCAL_PROGRESS_SHARE) * aiShare),
            ),
            stage: "ai",
            fileName,
            detail: `문단 묶음 ${done}/${total}개 완료 · 묶음마다 30초~1분 정도 걸려요`,
          });
        },
        controller.signal,
      );

      // 취소되지 않고 끝까지 성공한 결과만 반영해 room과 wiki가 항상 함께 바뀌게 한다.
      if (controller.signal.aborted) return;
      setGenerated(generated);
      router.push(ROOM_PATH);
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      setErrorMessage(toErrorMessage(error));
      setProgress(null);
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  function handleCancel() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    reviewRef.current?.reject(new DOMException("취소됨", "AbortError"));
    reviewRef.current = null;
    setReview(null);
    setProgress(null);
    setErrorMessage("문서 생성을 취소했어요.");
  }

  function handleFile(file: File) {
    if (controllerRef.current) return;
    const validationError = validateChatFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    void generateWiki({ file }, file.name);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleSample() {
    void generateWiki(
      { text: sampleChat, fileName: sampleChatFileName },
      sampleChatFileName,
    );
  }

  // 분석 중에 화면을 떠나면 작업을 취소해 나중에 오래된 결과가 반영되지 않게 한다.
  useEffect(() => () => controllerRef.current?.abort(), []);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`mx-auto mt-7 max-w-3xl overflow-hidden rounded-[6px] border-2 border-ink transition-colors duration-150 ${isDragging ? "bg-[#E3F5F2]" : "bg-white"}`}
    >
      <p className="bg-namu px-4 py-2.5 text-center font-pixel text-lg text-white">
        새 문서 작성
      </p>
      <div className="flex flex-col items-center px-6 py-10 text-center">
        {review ? (
          <ParticipantReview
            candidates={review}
            onConfirm={handleReviewConfirm}
            onCancel={handleCancel}
          />
        ) : progress ? (
          <UploadProgress
            percent={progress.percent}
            stage={progress.stage}
            fileName={progress.fileName}
            detail={progress.detail}
            onCancel={handleCancel}
          />
        ) : (
          <>
            <span className="flex h-16 w-16 items-center justify-center rounded-[6px] border-2 border-ink bg-paper shadow-[3px_3px_0_0_#1E2A28]">
              <FileTextIcon className="h-7 w-7 text-namu" />
            </span>
            <p className="mt-5 text-lg font-bold text-ink">
              {isDragging
                ? "여기에 놓으면 시작해요"
                : "카카오톡 대화 .csv 파일을 끌어다 놓으세요"}
            </p>
            <p className="mt-1.5 text-sm text-subtle">
              단톡방 문서와 구성원별 인물 문서가 자동으로 작성됩니다.
            </p>
          </>
        )}

        {!isLoading && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`${PRIMARY_BUTTON_CLASS_NAME} bg-namu text-white`}
            >
              <UploadIcon className="h-4 w-4" />
              파일 선택
            </button>
            <button
              type="button"
              onClick={handleSample}
              className={`${PRIMARY_BUTTON_CLASS_NAME} bg-white text-ink`}
            >
              <PlayIcon className="h-4 w-4" />
              예시 문서 보기
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,.txt,text/plain"
          className="sr-only"
          aria-label="대화 파일 선택"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
            event.target.value = "";
          }}
        />

        {errorMessage && (
          <p
            role="alert"
            className="mt-6 flex max-w-lg items-start gap-2 rounded-[6px] border-2 border-legend bg-[#FFF4E6] px-4 py-3 text-left text-sm text-ink"
          >
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-legend" />
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}
