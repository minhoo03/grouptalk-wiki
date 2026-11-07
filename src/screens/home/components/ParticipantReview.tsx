"use client";

import { BotIcon } from "lucide-react";
import { useState } from "react";

import type {
  ParticipantCandidates,
  ParticipantDecisions,
} from "../utils/participants";

type ParticipantReviewProps = {
  candidates: ParticipantCandidates;
  onConfirm: (decisions: ParticipantDecisions) => void;
  onCancel: () => void;
};

/**
 * 문서를 만들기 전에 봇으로 보이는 계정을 통계에서 뺄지 확인받는다. 봇 후보는 기본으로 제외된다.
 */
export function ParticipantReview({
  candidates,
  onConfirm,
  onCancel,
}: ParticipantReviewProps) {
  const [excluded, setExcluded] = useState(
    () => new Set(candidates.bots.map((bot) => bot.name)),
  );

  function toggle(set: Set<string>, value: string) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  function handleConfirm() {
    onConfirm({ excludedBots: [...excluded] });
  }

  return (
    <div className="w-full max-w-lg text-left">
      <p className="text-lg font-bold text-ink">문서를 만들기 전에 확인해 주세요</p>
      <p className="mt-1 text-sm text-subtle">
        체크한 내용이 모든 통계와 문서에 반영돼요.
      </p>

      {candidates.bots.length > 0 && (
        <fieldset className="mt-5">
          <legend className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <BotIcon className="h-4 w-4" aria-hidden="true" />
            봇으로 보이는 계정 — 체크하면 통계에서 빼요
          </legend>
          <ul className="mt-2 space-y-2">
            {candidates.bots.map((bot) => (
              <li key={bot.name}>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-[6px] border border-line px-3 py-2.5 hover:bg-paper">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={excluded.has(bot.name)}
                    onChange={() => setExcluded((set) => toggle(set, bot.name))}
                  />
                  <span className="min-w-0 text-sm">
                    <b>{bot.name}</b>{" "}
                    <span className="text-subtle">
                      메시지 {bot.messageCount.toLocaleString()}개
                    </span>
                    <span className="mt-0.5 block text-xs text-subtle">
                      {bot.reasons.join(" · ")}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-[6px] border-2 border-ink bg-namu px-5 py-2.5 text-sm font-bold text-white shadow-[3px_3px_0_0_#1E2A28] transition-transform duration-100 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
        >
          이대로 문서 만들기
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[6px] border-2 border-ink bg-white px-5 py-2.5 text-sm font-bold text-ink"
        >
          취소
        </button>
      </div>
    </div>
  );
}
