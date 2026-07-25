"use client";

import { useState } from "react";
import { RecipeListFilters } from "@/components/recipes/RecipeListFilters";
import {
  collectRecipeTags,
  EMPTY_RECIPE_FILTER,
  filterRecipes,
  type RecipeFilterState,
} from "@/lib/filter-recipes";
import { formatCourseLabel, type Recipe } from "@/types/recipe";

type RecipePickerModalProps = {
  recipes: Recipe[];
  onSelect: (recipe: Recipe) => void;
  onClose: () => void;
};

/** 献立に追加するレシピを絞り込んで選ぶ */
export function RecipePickerModal({
  recipes,
  onSelect,
  onClose,
}: RecipePickerModalProps) {
  const [filter, setFilter] = useState<RecipeFilterState>(EMPTY_RECIPE_FILTER);
  const availableTags = collectRecipeTags(recipes);
  const filtered = filterRecipes(recipes, filter);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="レシピを選ぶ"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-surface shadow-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
          <h2 className="text-lg font-bold">料理を追加</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm font-medium text-on-surface-variant"
          >
            閉じる
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-4">
          <RecipeListFilters
            filter={filter}
            availableTags={availableTags}
            onChange={setFilter}
            showCourse
          />

          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-on-surface-variant">
              条件に合うレシピがありません
            </p>
          ) : (
            <ul className="space-y-2 pb-4">
              {filtered.map((recipe) => (
                <li key={recipe.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(recipe)}
                    className="w-full rounded-2xl bg-surface-container-lowest px-4 py-3 text-left ring-1 ring-outline-variant hover:bg-surface-container"
                  >
                    <p className="font-semibold text-on-surface">{recipe.name}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {recipe.category}　・　{formatCourseLabel(recipe.course)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
