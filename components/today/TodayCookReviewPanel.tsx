"use client";

import { useState } from "react";
import { recordCookingWithFeedback } from "@/lib/recipe-learning/service";
import {
  getImprovementTagById,
  HOME_REVIEW_TAG_IDS,
  IMPROVEMENT_TAGS,
} from "@/types/recipe-learning";
import type { TodayPrimaryCook, TodayReviewSummary } from "@/lib/today/dashboard";

type TodayCookReviewPanelProps = {
  primaryCook: TodayPrimaryCook;
  /** ready: 入力可 / done: 結果表示のみ */
  mode: "ready" | "done";
  summary: TodayReviewSummary | null;
  onSaved?: () => void;
};

function StarPicker({
  value,
  onChange,
  readOnly = false,
}: {
  value: number | null;
  onChange?: (n: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="総合評価">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = value != null && star <= value;
        if (readOnly) {
          return (
            <span
              key={star}
              className={`text-3xl leading-none ${
                active ? "text-primary" : "text-outline-variant"
              }`}
              aria-hidden
            >
              ★
            </span>
          );
        }
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            className={`text-3xl leading-none ${
              active ? "text-primary" : "text-outline-variant"
            }`}
            aria-label={`${star}点`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

const HOME_TAGS = IMPROVEMENT_TAGS.filter((tag) =>
  (HOME_REVIEW_TAG_IDS as readonly string[]).includes(tag.id),
);

/**
 * ホーム用の簡易調理後レビュー。
 * 保存は既存の学習パイプライン（CookingFeedback）へ流す。
 */
export function TodayCookReviewPanel({
  primaryCook,
  mode,
  summary,
  onSaved,
}: TodayCookReviewPanelProps) {
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggleTag(id: string): void {
    setTags((current) =>
      current.includes(id)
        ? current.filter((tag) => tag !== id)
        : [...current, id],
    );
  }

  function handleSave(): void {
    if (overallRating == null) {
      setMessage("★で評価してください");
      return;
    }
    recordCookingWithFeedback({
      recipeId: primaryCook.recipeId,
      householdId: "local",
      createdBy: null,
      servings: primaryCook.servings,
      cookingTimeActual: primaryCook.cookingTimeMinutes,
      overallRating,
      wantAgain: tags.includes("want_again") ? true : null,
      improvementTags: tags,
      memo,
      memberRatings: [],
    });
    setSaved(true);
    setMessage("保存しました");
    onSaved?.();
  }

  if (mode === "done" || saved) {
    const rating = saved ? overallRating : summary?.overallRating ?? null;
    const savedTags = saved ? tags : (summary?.improvementTags ?? []);
    const savedMemo = saved ? memo : (summary?.memo ?? "");
    return (
      <section className="rounded-2xl bg-surface-container-lowest px-4 py-5 ring-1 ring-outline-variant">
        <h2 className="text-lg font-semibold">今日のレビュー</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          {primaryCook.title}
        </p>
        <div className="mt-4">
          <StarPicker value={rating} readOnly />
        </div>
        {savedTags.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {savedTags.map((id) => (
              <li
                key={id}
                className="rounded-xl bg-secondary-container px-3 py-1.5 text-sm text-on-secondary-container"
              >
                {getImprovementTagById(id)?.label ?? id}
              </li>
            ))}
          </ul>
        ) : null}
        {savedMemo.trim() ? (
          <p className="mt-3 text-sm text-on-surface-variant">
            {savedMemo.trim()}
          </p>
        ) : null}
        <p className="mt-3 text-sm text-on-surface-variant" role="status">
          レビュー済み
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-surface-container-lowest px-4 py-5 ring-1 ring-outline-variant">
      <h2 className="text-lg font-semibold">今日のレビュー</h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        {primaryCook.title}はどうでしたか？
      </p>

      <div className="mt-4">
        <StarPicker value={overallRating} onChange={setOverallRating} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {HOME_TAGS.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggleTag(tag.id)}
            className={`rounded-xl px-3 py-2 text-sm ${
              tags.includes(tag.id)
                ? "bg-primary text-on-primary"
                : "bg-surface-container ring-1 ring-outline-variant"
            }`}
          >
            {tag.label}
          </button>
        ))}
      </div>

      <label className="mt-4 block space-y-1 text-sm">
        <span className="text-on-surface-variant">次回メモ</span>
        <textarea
          value={memo}
          maxLength={500}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          className="w-full rounded-xl bg-surface-container px-3 py-2"
          placeholder="任意"
        />
      </label>

      <button
        type="button"
        onClick={handleSave}
        className="mt-4 w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary"
      >
        保存する
      </button>
      {message ? (
        <p className="mt-2 text-sm text-on-surface-variant" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
