"use client";

import Link from "next/link";
import { CompactMenu } from "@/components/meals/CompactMenu";
import { getCourseIcon } from "@/types/course";
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

/** 普段は料理名・時間・ジャンルのみ。操作は…メニューへ */
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
  // 空き枠、またはレシピ参照が切れている枠
  if (empty || !item || !recipe) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container/60 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-on-surface-variant">{courseLabel}</p>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              {!item || empty ? "未設定" : "レシピなし"}
            </p>
          </div>
          {onRegenerate ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRegenerate();
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary ring-1 ring-outline-variant"
            >
              料理を入れる
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const locked = Boolean(item.slotLocked);
  const menuItems = [
    onToggleLock
      ? {
          id: "lock",
          label: locked ? "ロック解除" : "ロック",
          onClick: onToggleLock,
        }
      : null,
    onRegenerate && !locked
      ? {
          id: "regen",
          label: "再生成",
          onClick: onRegenerate,
        }
      : null,
    onRemove && !locked
      ? {
          id: "remove",
          label: "削除",
          onClick: onRemove,
          danger: true,
        }
      : null,
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return (
    <article
      className={`rounded-xl bg-surface-container-lowest px-3 py-2.5 ring-1 ring-outline-variant ${
        isDragging ? "opacity-70 ring-2 ring-primary" : ""
      } ${locked ? "bg-fixed-container ring-fixed" : ""}`}
      {...dragHandleProps}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-lg leading-none" aria-hidden>
          {getCourseIcon(item.course)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-on-surface-variant">{courseLabel}</p>
          <Link
            href={`/recipes/${recipe.id}`}
            className="block truncate text-sm font-semibold text-on-surface"
          >
            {recipe.name}
          </Link>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {recipe.cookingTimeMinutes != null
              ? `${recipe.cookingTimeMinutes}分`
              : "時間未設定"}
            {" · "}
            {recipe.category}
            {locked ? " · 🔒" : ""}
          </p>
        </div>
        <CompactMenu label={`${recipe.name}の操作`} items={menuItems} />
      </div>
    </article>
  );
}
