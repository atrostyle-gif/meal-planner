"use client";

import {
  MAX_MEAL_SERVINGS,
  MIN_MEAL_SERVINGS,
} from "@/lib/servings/resolve";

type DayServingsEditorProps = {
  servings: number;
  isCustom: boolean;
  defaultMealServings: number;
  /** 互換用（未使用でも受け取る） */
  compact?: boolean;
  onChange: (servings: number) => void;
  onReset: () => void;
};

/**
 * 日付単位の人数。横一列の ⊖ N人分 ⊕。
 */
export function DayServingsEditor({
  servings,
  isCustom,
  defaultMealServings,
  compact = false,
  onChange,
  onReset,
}: DayServingsEditorProps) {
  function commit(next: number): void {
    const clamped = Math.min(
      MAX_MEAL_SERVINGS,
      Math.max(MIN_MEAL_SERVINGS, Math.round(next)),
    );
    onChange(clamped);
  }

  return (
    <div className="space-y-1">
      <div className={`flex items-center gap-2 ${compact ? "gap-1.5" : ""}`}>
        <button
          type="button"
          className={`flex items-center justify-center rounded-xl font-bold ${
            compact ? "h-9 w-9 text-lg" : "h-10 w-10 text-xl"
          } ${
            isCustom
              ? "bg-primary/10 text-primary"
              : "bg-surface-container text-on-surface"
          }`}
          onClick={() => commit(servings - 1)}
          disabled={servings <= MIN_MEAL_SERVINGS}
          aria-label="人数を減らす"
        >
          ⊖
        </button>
        <span
          className={`min-w-[4.5rem] text-center font-semibold ${
            compact ? "text-sm" : "text-base"
          } ${isCustom ? "text-primary" : "text-on-surface"}`}
        >
          {servings}人分
        </span>
        <button
          type="button"
          className={`flex items-center justify-center rounded-xl font-bold ${
            compact ? "h-9 w-9 text-lg" : "h-10 w-10 text-xl"
          } ${
            isCustom
              ? "bg-primary/10 text-primary"
              : "bg-surface-container text-on-surface"
          }`}
          onClick={() => commit(servings + 1)}
          disabled={servings >= MAX_MEAL_SERVINGS}
          aria-label="人数を増やす"
        >
          ⊕
        </button>
        {isCustom ? (
          <button
            type="button"
            className="ml-1 text-xs font-medium text-primary"
            onClick={onReset}
          >
            通常（{defaultMealServings}人）
          </button>
        ) : null}
      </div>
    </div>
  );
}
