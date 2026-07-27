"use client";

import Link from "next/link";
import { useState } from "react";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { RecipeListFilters } from "@/components/recipes/RecipeListFilters";
import {
  collectRecipeTags,
  EMPTY_RECIPE_FILTER,
  filterRecipesWithReasons,
  hasActiveRecipeFilter,
  type RecipeFilterState,
} from "@/lib/filter-recipes";
import { loadCookingMemberProfiles } from "@/lib/cooking-member-profiles";
import { loadCookingHistory } from "@/lib/cooking-history";
import { loadWeeklyCookingSchedules } from "@/lib/weekly-cooking-schedules";
import { useIsClient } from "@/lib/use-is-client";
import { useRecipes } from "@/lib/use-recipes";

export function RecipeList() {
  const recipes = useRecipes();
  const isClient = useIsClient();
  const [filter, setFilter] = useState<RecipeFilterState>(EMPTY_RECIPE_FILTER);

  if (!isClient) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  const availableTags = collectRecipeTags(recipes);
  const cookingProfiles = loadCookingMemberProfiles();
  const filteredRecipes = filterRecipesWithReasons(recipes, filter, cookingProfiles, loadCookingHistory(), loadWeeklyCookingSchedules());
  const filtering = hasActiveRecipeFilter(filter);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">レシピ</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            家族の得意料理を登録しましょう
          </p>
        </div>
        <Link
          href="/recipes/new"
          className="shrink-0 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm"
        >
          新規登録
        </Link>
      </header>

      {recipes.length === 0 ? (
        <div className="rounded-2xl bg-surface-container px-5 py-10 text-center">
          <p className="font-medium text-on-surface">レシピがまだありません</p>
          <p className="mt-2 text-sm text-on-surface-variant">
            「新規登録」から最初の料理を追加してください。
          </p>
        </div>
      ) : (
        <>
          <RecipeListFilters
            filter={filter}
            availableTags={availableTags}
            onChange={setFilter}
            cookingProfiles={cookingProfiles}
          />

          {filteredRecipes.length === 0 ? (
            <div className="rounded-2xl bg-surface-container px-5 py-10 text-center">
              <p className="font-medium text-on-surface">
                条件に合うレシピがありません
              </p>
              <p className="mt-2 text-sm text-on-surface-variant">
                {filtering
                  ? "検索条件を変えるか、クリアしてください。"
                  : "「新規登録」から追加してください。"}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredRecipes.map(({ recipe, reasons }) => (
                <li key={recipe.id}>
                  <RecipeCard recipe={recipe} />
                  {filtering && reasons.length > 0 ? (
                    <p className="mt-1 px-2 text-xs text-on-surface-variant">
                      選定理由: {reasons.join(" / ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
