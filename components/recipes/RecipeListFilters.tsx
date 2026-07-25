"use client";

import {
  EMPTY_RECIPE_FILTER,
  hasActiveRecipeFilter,
  type RecipeFilterState,
} from "@/lib/filter-recipes";
import {
  RECIPE_CATEGORIES,
  RECIPE_COURSES,
  type RecipeCategory,
  type RecipeCourse,
} from "@/types/recipe";
import type { CookingMemberProfile } from "@/types/weekly-lifestyle";

type RecipeListFiltersProps = {
  filter: RecipeFilterState;
  availableTags: string[];
  onChange: (filter: RecipeFilterState) => void;
  /** 献立のレシピ選択など、course 絞り込みを出すか */
  showCourse?: boolean;
  cookingProfiles?: CookingMemberProfile[];
};

export function RecipeListFilters({
  filter,
  availableTags,
  onChange,
  showCourse = true,
  cookingProfiles = [],
}: RecipeListFiltersProps) {
  const active = hasActiveRecipeFilter(filter);

  return (
    <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-on-surface">レシピ名検索</span>
        <input
          type="search"
          value={filter.query}
          onChange={(event) =>
            onChange({ ...filter, query: event.target.value })
          }
          className="w-full rounded-xl border-0 bg-surface-container px-4 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          placeholder="料理名で検索"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-on-surface">カテゴリー</span>
          <select
            value={filter.category}
            onChange={(event) =>
              onChange({
                ...filter,
                category: event.target.value as RecipeCategory | "",
              })
            }
            className="w-full rounded-xl border-0 bg-surface-container px-3 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          >
            <option value="">すべて</option>
            {RECIPE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-on-surface">タグ</span>
          <select
            value={filter.tag}
            onChange={(event) =>
              onChange({ ...filter, tag: event.target.value })
            }
            className="w-full rounded-xl border-0 bg-surface-container px-3 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          >
            <option value="">すべて</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>

        {showCourse ? (
          <label className="block space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-on-surface">料理区分</span>
            <select
              value={filter.course}
              onChange={(event) =>
                onChange({
                  ...filter,
                  course: event.target.value as RecipeCourse | "",
                })
              }
              className="w-full rounded-xl border-0 bg-surface-container px-3 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
            >
              <option value="">すべて</option>
              {RECIPE_COURSES.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <details className="rounded-xl bg-surface-container p-3">
        <summary className="cursor-pointer text-sm font-medium">生活スタイル条件</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs">作る人<select value={filter.cookMemberId ?? ""} onChange={(e) => onChange({ ...filter, cookMemberId: e.target.value })} className="mt-1 w-full rounded-lg bg-surface-container-lowest p-2 text-sm"><option value="">指定なし</option>{cookingProfiles.map((profile) => <option key={profile.id} value={profile.familyMemberProfileId}>{profile.familyMemberProfileId}</option>)}</select></label>
          <label className="text-xs">時間上限（分）<input type="number" value={filter.maxCookingMinutes ?? ""} onChange={(e) => onChange({ ...filter, maxCookingMinutes: e.target.value === "" ? null : Number(e.target.value) })} className="mt-1 w-full rounded-lg bg-surface-container-lowest p-2 text-sm" /></label>
          {([["lowCleanupOnly","洗い物少なめ"],["noDeepFrying","揚げ物なし"],["beginnerFriendlyOnly","初心者向け"],["familiarOnly","慣れた料理"],["learningOnly","挑戦中"],["makeAheadOnly","作り置き向き"]] as const).map(([key, label]) => <label key={key} className="flex gap-1 text-xs"><input type="checkbox" checked={filter[key] === true} onChange={(e) => onChange({ ...filter, [key]: e.target.checked })} />{label}</label>)}
        </div>
      </details>

      <button
        type="button"
        onClick={() => onChange(EMPTY_RECIPE_FILTER)}
        disabled={!active}
        className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium ${
          active
            ? "bg-surface-container text-on-surface ring-1 ring-outline-variant"
            : "cursor-not-allowed text-on-surface-variant opacity-50"
        }`}
      >
        検索条件をクリア
      </button>
    </section>
  );
}
