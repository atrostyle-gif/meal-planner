"use client";

import Link from "next/link";
import { getDishLabel } from "@/lib/meal-plans";
import {
  formatCourseLabel,
  getCourseIcon,
  RECIPE_COURSES,
  type Recipe,
  type RecipeCourse,
} from "@/types/recipe";
import type { MealDishItem } from "@/types/meal-plan";

type MealDishRowProps = {
  item: MealDishItem;
  recipes: Recipe[];
  date: string;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  onChangeCourse: (course: RecipeCourse) => void;
  onRemove: () => void;
};

export function MealDishRow({
  item,
  recipes,
  date,
  isFirst,
  isLast,
  onMove,
  onChangeCourse,
  onRemove,
}: MealDishRowProps) {
  const label = getDishLabel(item, recipes);

  return (
    <div className="rounded-xl bg-surface-container px-3 py-3">
      <div className="flex items-start gap-2">
        <span className="text-xl leading-none" aria-hidden>
          {getCourseIcon(item.course)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-on-surface">{label}</p>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {formatCourseLabel(item.course)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            className="rounded px-2 py-0.5 text-sm text-on-surface-variant disabled:opacity-30"
            aria-label="上へ"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            className="rounded px-2 py-0.5 text-sm text-on-surface-variant disabled:opacity-30"
            aria-label="下へ"
          >
            ↓
          </button>
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <select
          value={item.course}
          onChange={(event) =>
            onChangeCourse(event.target.value as RecipeCourse)
          }
          className="min-w-0 flex-1 rounded-lg border-0 bg-surface-container-lowest px-2 py-2 text-sm outline-none ring-1 ring-outline-variant"
          aria-label="料理区分"
        >
          {RECIPE_COURSES.map((course) => (
            <option key={course} value={course}>
              {formatCourseLabel(course)}
            </option>
          ))}
        </select>
        {item.recipeId ? (
          <Link
            href={`/recipes/${item.recipeId}/cook?date=${date}&mealItemId=${item.id}`}
            className="rounded-lg px-3 py-2 text-sm font-medium text-primary ring-1 ring-outline-variant"
          >
            調理
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg px-3 py-2 text-sm text-error hover:bg-error-container"
        >
          削除
        </button>
      </div>
    </div>
  );
}
