import type { RecipeCourse } from "@/types/course";
import type { Recipe, RecipeCategory } from "@/types/recipe";
import { resolveRecipeCookingProfile } from "@/lib/cooking-suitability";
import type {
  CookingHistory,
  CookingMemberProfile,
  EffortLevel,
  RecipeDifficultyLevel,
  WeeklyCookingSchedule,
} from "@/types/weekly-lifestyle";

export type RecipeFilterState = {
  query: string;
  category: RecipeCategory | "";
  tag: string;
  course: RecipeCourse | "";
  cookMemberId?: string;
  dayOfWeek?: WeeklyCookingSchedule["dayOfWeek"] | "";
  maxCookingMinutes?: number | null;
  difficulty?: RecipeDifficultyLevel | "";
  effortLevel?: EffortLevel | "";
  maxStepCount?: number | null;
  lowCleanupOnly?: boolean;
  noDeepFrying?: boolean;
  beginnerFriendlyOnly?: boolean;
  familiarOnly?: boolean;
  learningOnly?: boolean;
  makeAheadOnly?: boolean;
};

export const EMPTY_RECIPE_FILTER: RecipeFilterState = {
  query: "",
  category: "",
  tag: "",
  course: "",
  cookMemberId: "",
  dayOfWeek: "",
  maxCookingMinutes: null,
  difficulty: "",
  effortLevel: "",
  maxStepCount: null,
  lowCleanupOnly: false,
  noDeepFrying: false,
  beginnerFriendlyOnly: false,
  familiarOnly: false,
  learningOnly: false,
  makeAheadOnly: false,
};

/** 検索条件が何か指定されているか */
export function hasActiveRecipeFilter(filter: RecipeFilterState): boolean {
  return (
    filter.query.trim() !== "" ||
    filter.category !== "" ||
    filter.tag !== "" ||
    filter.course !== "" ||
    filter.cookMemberId !== "" ||
    filter.dayOfWeek !== "" ||
    filter.maxCookingMinutes != null ||
    filter.difficulty !== "" ||
    filter.effortLevel !== "" ||
    filter.maxStepCount != null ||
    filter.lowCleanupOnly === true ||
    filter.noDeepFrying === true ||
    filter.beginnerFriendlyOnly === true ||
    filter.familiarOnly === true ||
    filter.learningOnly === true ||
    filter.makeAheadOnly === true
  );
}

/** 登録済みタグを重複なく昇順で返す */
export function collectRecipeTags(recipes: Recipe[]): string[] {
  const tags = new Set<string>();
  for (const recipe of recipes) {
    for (const tag of recipe.tags) {
      tags.add(tag);
    }
  }
  return [...tags].sort((left, right) => left.localeCompare(right, "ja"));
}

/** レシピ名検索・カテゴリー・タグ・course で絞り込む */
export function filterRecipes(
  recipes: Recipe[],
  filter: RecipeFilterState,
): Recipe[] {
  const query = filter.query.trim().toLowerCase();

  return recipes.filter((recipe) => {
    if (query !== "" && !recipe.name.toLowerCase().includes(query)) {
      return false;
    }

    if (filter.category !== "" && recipe.category !== filter.category) {
      return false;
    }

    if (filter.tag !== "" && !recipe.tags.includes(filter.tag)) {
      return false;
    }

    if (filter.course !== "" && recipe.course !== filter.course) {
      return false;
    }

    return true;
  });
}

export type FilteredRecipeWithReasons = {
  recipe: Recipe;
  reasons: string[];
};

function findCookProfile(
  cookMemberId: string | undefined,
  cookingProfiles: CookingMemberProfile[],
): CookingMemberProfile | null {
  if (!cookMemberId) return null;
  return cookingProfiles.find(
    (profile) =>
      profile.id === cookMemberId || profile.familyMemberProfileId === cookMemberId,
  ) ?? null;
}

/**
 * 調理条件を満たすレシピを、選定理由とともに返す。
 * 曜日を指定した場合は、その曜日に設定された上限も適用する。
 */
export function filterRecipesWithReasons(
  recipes: Recipe[],
  filter: RecipeFilterState,
  cookingProfiles: CookingMemberProfile[] = [],
  cookingHistory: CookingHistory[] = [],
  schedules: WeeklyCookingSchedule[] = [],
): FilteredRecipeWithReasons[] {
  const basicRecipes = filterRecipes(recipes, filter);
  const cook = findCookProfile(filter.cookMemberId, cookingProfiles);
  const schedule = filter.dayOfWeek
    ? schedules.find((entry) => entry.isActive && entry.dayOfWeek === filter.dayOfWeek) ?? null
    : null;
  const maxMinutes =
    filter.maxCookingMinutes ??
    schedule?.cookingTimeLimitMinutes ??
    cook?.defaultMaxCookingMinutes ??
    null;
  const maxSteps =
    filter.maxStepCount ??
    schedule?.maxStepCount ??
    cook?.maxComfortableStepCount ??
    null;

  return basicRecipes.flatMap((recipe) => {
    const profile = resolveRecipeCookingProfile(recipe);
    const minutes = profile.totalCookingMinutes ?? recipe.cookingTimeMinutes;
    const steps = profile.stepCount ?? recipe.steps.length;
    const isFamiliar =
      cook != null &&
      (cook.masteredRecipeIds.includes(recipe.id) ||
        cookingHistory.filter(
          (entry) =>
            entry.recipeId === recipe.id &&
            entry.cookedByMemberId === cook.familyMemberProfileId,
        ).length >= 3);
    const reasons: string[] = [];

    if (maxMinutes != null && minutes != null && minutes > maxMinutes) return [];
    if (filter.difficulty && profile.difficulty !== filter.difficulty) return [];
    if (filter.effortLevel && profile.effortLevel !== filter.effortLevel) return [];
    if (maxSteps != null && steps > maxSteps) return [];
    if (filter.lowCleanupOnly && profile.cleanupLevel !== "low") return [];
    if (filter.noDeepFrying && profile.requiresDeepFrying) return [];
    if (filter.beginnerFriendlyOnly && !profile.beginnerFriendly) return [];
    if (filter.familiarOnly && !isFamiliar) return [];
    if (
      filter.learningOnly &&
      (!cook || !cook.learningRecipeIds.includes(recipe.id))
    ) return [];
    if (filter.makeAheadOnly && !profile.makeAheadSuitable) return [];
    if (schedule?.avoidDeepFrying && profile.requiresDeepFrying) return [];

    if (maxMinutes != null && minutes != null) reasons.push("調理時間の条件に合います");
    if (maxSteps != null) reasons.push("工程数の条件に合います");
    if (isFamiliar) reasons.push("担当者が作り慣れた料理です");
    if (filter.learningOnly) reasons.push("担当者が挑戦中の料理です");
    if (profile.beginnerFriendly && filter.beginnerFriendlyOnly) {
      reasons.push("初心者でも作りやすい料理です");
    }
    if (profile.makeAheadSuitable && filter.makeAheadOnly) {
      reasons.push("作り置きに向く料理です");
    }
    return [{ recipe, reasons }];
  });
}
