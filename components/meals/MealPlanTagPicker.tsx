"use client";

import {
  MEAL_PLAN_TAG_DEFS,
  type MealPlanTagId,
} from "@/types/meal-plan-tags";

type MealPlanTagPickerProps = {
  selected: readonly MealPlanTagId[];
  onChange: (next: MealPlanTagId[]) => void;
};

/**
 * 「今週の献立を作る」用の複数選択タグ。
 */
export function MealPlanTagPicker({
  selected,
  onChange,
}: MealPlanTagPickerProps) {
  function toggle(id: MealPlanTagId): void {
    if (selected.includes(id)) {
      onChange(selected.filter((tag) => tag !== id));
      return;
    }
    onChange([...selected, id]);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-on-surface-variant">
        献立の希望（任意・複数可）
      </p>
      <div className="flex flex-wrap gap-2">
        {MEAL_PLAN_TAG_DEFS.map((tag) => {
          const active = selected.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                  : "bg-surface-container text-on-surface-variant ring-1 ring-outline-variant"
              }`}
              aria-pressed={active}
            >
              {tag.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
