"use client";

import Link from "next/link";
import { getCourseIcon } from "@/types/course";
import { getMainIngredientNames } from "@/lib/weekly-auto-plan";
import type { MealDishItem } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";

type MealSlotCardProps = {
  item: MealDishItem | null;
  courseLabel: string;
  recipe: Recipe | null;
  empty?: boolean;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
  onToggleLock?: () => void;
  onRegenerate?: () => void;
  onRemove?: () => void;
};

export function MealSlotCard({
  item,
  courseLabel,
  recipe,
  empty = false,
  dragHandleProps,
  isDragging = false,
  onToggleLock,
  onRegenerate,
  onRemove,
}: MealSlotCardProps) {
  if (empty || !item || !recipe) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container/60 p-3">
        <p className="text-xs font-medium text-on-surface-variant">
          {courseLabel}
        </p>
        <p className="mt-2 text-sm text-on-surface-variant">空き枠</p>
        {onRegenerate ? (
          <button
            type="button"
            onClick={onRegenerate}
            className="mt-2 text-xs font-medium text-primary"
          >
            この枠を埋める
          </button>
        ) : null}
      </div>
    );
  }

  const locked = Boolean(item.slotLocked);
  const mains = getMainIngredientNames(recipe);
  const badges = item.selectionBadges ?? [];
  const reasons = item.selectionReasons ?? item.engineReasons ?? [];

  return (
    <article
      className={`rounded-xl bg-surface-container-lowest p-3 shadow-sm ring-1 ring-outline-variant transition ${
        isDragging ? "opacity-70 ring-2 ring-primary" : ""
      } ${locked ? "bg-fixed-container ring-fixed" : ""}`}
      {...dragHandleProps}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-2xl"
          aria-hidden
        >
          {getCourseIcon(item.course)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-on-surface-variant">
            {courseLabel}
          </p>
          <Link
            href={`/recipes/${recipe.id}`}
            className="mt-0.5 block truncate text-sm font-semibold text-on-surface"
          >
            {recipe.name}
          </Link>
          <p className="mt-1 text-xs text-on-surface-variant">
            {recipe.cookingTimeMinutes != null
              ? `${recipe.cookingTimeMinutes}分`
              : "時間未設定"}
            {" · "}
            {recipe.category}
          </p>
          {mains.length > 0 ? (
            <p className="mt-1 truncate text-xs text-on-surface-variant">
              主な食材: {mains.join("・")}
            </p>
          ) : null}
        </div>
      </div>

      {badges.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <li
              key={badge}
              className="rounded-lg bg-secondary-container px-2 py-0.5 text-[11px] font-medium text-on-secondary-container"
            >
              {badge}
            </li>
          ))}
        </ul>
      ) : null}

      {reasons.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-[11px] text-on-surface-variant">
          {reasons.slice(0, 2).map((reason) => (
            <li key={reason}>・{reason}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {onToggleLock ? (
          <button
            type="button"
            onClick={onToggleLock}
            className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-secondary-container"
          >
            {locked ? "ロック解除" : "ロック"}
          </button>
        ) : null}
        {onRegenerate && !locked ? (
          <button
            type="button"
            onClick={onRegenerate}
            className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-secondary-container"
          >
            この枠だけ再生成
          </button>
        ) : null}
        {onRemove && !locked ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg px-2 py-1 text-xs font-medium text-error hover:bg-error-container"
          >
            削除
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-[10px] text-on-surface-variant">
        長押し／ドラッグで曜日間を移動できます
      </p>
    </article>
  );
}
