/**
 * 献立人数の解決と分量倍率の共通処理。
 * 買い物・調理・予算・栄養はここを通す（個別計算しない）。
 */

import { loadFamilyMemberProfiles } from "@/lib/family-member-profiles";
import { loadHouseholdPreferences } from "@/lib/meal-preferences";
import type { DayMeal, MealDishItem, ServingsMode } from "@/types/meal-plan";

export const MIN_MEAL_SERVINGS = 1;
export const MAX_MEAL_SERVINGS = 20;
/** 家族人数・設定が不明なときの安全な既定 */
export const FALLBACK_DEFAULT_MEAL_SERVINGS = 4;

export function clampMealServings(value: number): number {
  if (!Number.isFinite(value)) {
    return FALLBACK_DEFAULT_MEAL_SERVINGS;
  }
  return Math.min(
    MAX_MEAL_SERVINGS,
    Math.max(MIN_MEAL_SERVINGS, Math.round(value)),
  );
}

export function isServingsMode(value: unknown): value is ServingsMode {
  return value === "default" || value === "custom";
}

/**
 * 家庭の通常食事人数。
 * 設定 → 家族メンバー数 → 安全な既定、の順。
 */
export function resolveDefaultMealServings(options?: {
  defaultMealServings?: number | null;
  familyMemberCount?: number | null;
}): number {
  if (
    typeof options?.defaultMealServings === "number" &&
    Number.isFinite(options.defaultMealServings) &&
    options.defaultMealServings >= 1
  ) {
    return clampMealServings(options.defaultMealServings);
  }
  if (
    typeof options?.familyMemberCount === "number" &&
    Number.isFinite(options.familyMemberCount) &&
    options.familyMemberCount >= 1
  ) {
    return clampMealServings(options.familyMemberCount);
  }
  return FALLBACK_DEFAULT_MEAL_SERVINGS;
}

/** ローカルストアから通常食事人数を取得 */
export function loadDefaultMealServings(): number {
  if (typeof window === "undefined") {
    return FALLBACK_DEFAULT_MEAL_SERVINGS;
  }
  try {
    const prefs = loadHouseholdPreferences();
    const familyCount = loadFamilyMemberProfiles().length;
    return resolveDefaultMealServings({
      defaultMealServings: prefs.defaultMealServings,
      familyMemberCount: familyCount > 0 ? familyCount : null,
    });
  } catch {
    return FALLBACK_DEFAULT_MEAL_SERVINGS;
  }
}

function legacyDishOverride(items: MealDishItem[]): number | null {
  for (const item of items) {
    if (
      typeof item.servingsOverride === "number" &&
      Number.isFinite(item.servingsOverride) &&
      item.servingsOverride >= 1
    ) {
      return clampMealServings(item.servingsOverride);
    }
  }
  return null;
}

export type ResolvedDayServings = {
  servings: number;
  mode: ServingsMode;
  /** 表示用。custom のとき true */
  isCustom: boolean;
};

/**
 * 日付単位の献立人数を解決する。
 * custom → day.servings、default → 家庭の通常人数。
 * 旧 servingsOverride のみある日は custom として引き継ぐ。
 */
export function resolveDayServings(
  day: Pick<DayMeal, "servings" | "servingsMode" | "items">,
  defaultMealServings: number,
): ResolvedDayServings {
  const fallback = resolveDefaultMealServings({
    defaultMealServings,
  });

  if (day.servingsMode === "custom") {
    if (
      typeof day.servings === "number" &&
      Number.isFinite(day.servings) &&
      day.servings >= 1
    ) {
      return {
        servings: clampMealServings(day.servings),
        mode: "custom",
        isCustom: true,
      };
    }
  }

  if (
    day.servingsMode !== "default" &&
    typeof day.servings === "number" &&
    Number.isFinite(day.servings) &&
    day.servings >= 1
  ) {
    const servings = clampMealServings(day.servings);
    if (servings === fallback) {
      return { servings, mode: "default", isCustom: false };
    }
    return { servings, mode: "custom", isCustom: true };
  }

  const legacy = legacyDishOverride(day.items ?? []);
  if (legacy != null) {
    if (legacy === fallback) {
      return { servings: legacy, mode: "default", isCustom: false };
    }
    return { servings: legacy, mode: "custom", isCustom: true };
  }

  return { servings: fallback, mode: "default", isCustom: false };
}

/**
 * 人数変更パッチを作る。通常人数と同じなら default に戻す。
 */
export function buildDayServingsPatch(
  nextServings: number,
  defaultMealServings: number,
): Pick<DayMeal, "servings" | "servingsMode"> {
  const servings = clampMealServings(nextServings);
  const defaults = resolveDefaultMealServings({ defaultMealServings });
  if (servings === defaults) {
    return { servings: null, servingsMode: "default" };
  }
  return { servings, servingsMode: "custom" };
}

export function buildResetDayServingsPatch(): Pick<
  DayMeal,
  "servings" | "servingsMode"
> {
  return { servings: null, servingsMode: "default" };
}

export type ServingScaleResult = {
  scale: number;
  recipeServingsKnown: boolean;
  recipeServings: number | null;
  plannedServings: number;
};

/**
 * servingScale = plannedServings / recipe.servings
 * 元レシピ人数が不明なら倍率 1（勝手に4人と断定しない）。
 */
export function getServingScale(input: {
  recipeServings: number | null | undefined;
  plannedServings: number | null | undefined;
}): ServingScaleResult {
  const planned =
    typeof input.plannedServings === "number" &&
    Number.isFinite(input.plannedServings) &&
    input.plannedServings > 0
      ? clampMealServings(input.plannedServings)
      : FALLBACK_DEFAULT_MEAL_SERVINGS;

  const recipeKnown =
    typeof input.recipeServings === "number" &&
    Number.isFinite(input.recipeServings) &&
    input.recipeServings > 0;

  if (!recipeKnown) {
    return {
      scale: 1,
      recipeServingsKnown: false,
      recipeServings: null,
      plannedServings: planned,
    };
  }

  const recipeServings = input.recipeServings as number;
  return {
    scale: planned / recipeServings,
    recipeServingsKnown: true,
    recipeServings,
    plannedServings: planned,
  };
}
