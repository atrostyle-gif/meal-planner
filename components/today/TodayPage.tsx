"use client";

import Link from "next/link";
import { getToday, formatDisplayDate } from "@/lib/date";
import { getOrCreateMealPlan, getDishLabel } from "@/lib/meal-plans";
import { formatIngredientLine } from "@/lib/ingredient";
import { useIsClient } from "@/lib/use-is-client";
import { useMealPlan } from "@/lib/use-meal-plans";
import { useRecipes } from "@/lib/use-recipes";
import { formatCourseLabel } from "@/types/course";
import { getWeekStartFromDate } from "@/lib/date";

function getWeekStartSafe(date: string): string {
  try {
    return getWeekStartFromDate(date);
  } catch {
    return getWeekStartFromDate(getToday());
  }
}

export function TodayPage() {
  const isClient = useIsClient();
  const today = getToday();
  const weekStart = getWeekStartSafe(today);
  const recipes = useRecipes();
  // 週の献立を確実に用意
  if (isClient) {
    getOrCreateMealPlan(weekStart);
  }
  const plan = useMealPlan(weekStart);

  if (!isClient) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  const day = plan?.days.find((entry) => entry.date === today);
  const items = day?.items ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">今日の献立</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          {formatDisplayDate(today)}
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-surface-container px-5 py-10 text-center">
          <p className="font-medium">今日の献立はまだ登録されていません</p>
          <Link
            href="/meals"
            className="mt-4 inline-block text-sm font-medium text-primary"
          >
            週間献立を開く
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const recipe = item.recipeId
              ? recipes.find((entry) => entry.id === item.recipeId)
              : null;
            const title = getDishLabel(item, recipes);
            const servings =
              item.servingsOverride ?? recipe?.servings ?? null;
            const cookHref = item.recipeId
              ? `/recipes/${item.recipeId}/cook?date=${today}&mealItemId=${item.id}`
              : null;

            return (
              <li
                key={item.id}
                className="rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant"
              >
                <p className="text-xs text-on-surface-variant">
                  {formatCourseLabel(item.course)}
                </p>
                <h2 className="mt-1 text-xl font-semibold">{title}</h2>
                <div className="mt-2 space-y-1 text-sm text-on-surface-variant">
                  {servings ? <p>{servings}人分</p> : null}
                  {recipe?.cookingTimeMinutes != null ? (
                    <p>約{recipe.cookingTimeMinutes}分</p>
                  ) : null}
                  {recipe ? (
                    <p className="line-clamp-2">
                      材料:{" "}
                      {recipe.ingredients
                        .slice(0, 4)
                        .map((ing) => formatIngredientLine(ing))
                        .join("、")}
                      {recipe.ingredients.length > 4 ? " など" : ""}
                    </p>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {recipe ? (
                    <Link
                      href={`/recipes/${recipe.id}`}
                      className="rounded-xl px-3 py-2 text-sm font-medium text-primary ring-1 ring-outline-variant"
                    >
                      レシピ詳細
                    </Link>
                  ) : null}
                  {cookHref ? (
                    <Link
                      href={cookHref}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
                    >
                      調理する
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
