"use client";

import { useState } from "react";
import type { MealDecisionExplanation } from "@/types/meal-decision-explanation";

type MealReasonPanelProps = {
  title?: string;
  /** 短い表示メッセージ */
  messages: string[];
  /** 詳細（あれば「さらに表示」） */
  details?: MealDecisionExplanation[];
  defaultOpen?: boolean;
};

/**
 * 「💡 この献立になった理由」折りたたみパネル。
 */
export function MealReasonPanel({
  title = "💡 この献立になった理由",
  messages,
  details,
  defaultOpen = false,
}: MealReasonPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [showMore, setShowMore] = useState(false);

  if (messages.length === 0 && (!details || details.length === 0)) {
    return null;
  }

  const shortList = messages.slice(0, 4);
  const moreMessages = messages.slice(4);
  const detailLines =
    details
      ?.filter((d) => d.detail && d.detail !== d.message)
      .map((d) => d.detail!) ?? [];

  return (
    <div className="mt-4 rounded-xl bg-surface-container px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-on-surface">{title}</span>
        <span className="text-xs text-primary">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="mt-2 space-y-1.5">
          <ul className="space-y-1 text-sm text-on-surface-variant">
            {shortList.map((message) => (
              <li key={message}>・{message}</li>
            ))}
            {showMore
              ? moreMessages.map((message) => (
                  <li key={message}>・{message}</li>
                ))
              : null}
          </ul>
          {showMore && detailLines.length > 0 ? (
            <ul className="space-y-1 border-t border-outline-variant pt-2 text-xs text-on-surface-variant">
              {detailLines.slice(0, 4).map((line) => (
                <li key={line}>・{line}</li>
              ))}
            </ul>
          ) : null}
          {moreMessages.length > 0 || detailLines.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="text-xs font-medium text-primary"
            >
              {showMore ? "閉じる" : "さらに表示"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
