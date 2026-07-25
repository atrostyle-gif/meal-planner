import {
  resolveRecipeMealNutrition,
  recipeHasUsableNutrition,
} from "@/lib/diabetes-meal-support/recipe-nutrition";
import type {
  CarbTargetStatus,
  DailyNutritionTotals,
  DiabetesMealSupportSettings,
  MealNutritionTotals,
  WeeklyNutritionTotals,
} from "@/types/diabetes-meal-support";
import type { DayMeal, MealDishItem, MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";

function emptyTotals(
  recipeCount: number,
  recipesWithNutrition: number,
): MealNutritionTotals {
  const coverage =
    recipeCount === 0
      ? 0
      : Math.round((recipesWithNutrition / recipeCount) * 100);
  return {
    caloriesKcal: null,
    carbohydratesG: null,
    sugarsG: null,
    dietaryFiberG: null,
    proteinG: null,
    fatG: null,
    saturatedFatG: null,
    sodiumMg: null,
    saltEquivalentG: null,
    nutritionCoverage: coverage,
    recipeCount,
    recipesWithNutrition,
  };
}

type SummableKey =
  | "caloriesKcal"
  | "carbohydratesG"
  | "sugarsG"
  | "dietaryFiberG"
  | "proteinG"
  | "fatG"
  | "saturatedFatG"
  | "sodiumMg"
  | "saltEquivalentG";

const SUM_KEYS: SummableKey[] = [
  "caloriesKcal",
  "carbohydratesG",
  "sugarsG",
  "dietaryFiberG",
  "proteinG",
  "fatG",
  "saturatedFatG",
  "sodiumMg",
  "saltEquivalentG",
];

/**
 * 複数レシピの栄養を合算する。
 * ある項目について1件でも null なら、その項目の合計は null（不完全）。
 * 0 埋めしない。
 */
export function sumMealNutrition(
  recipes: Recipe[],
): MealNutritionTotals {
  if (recipes.length === 0) {
    return emptyTotals(0, 0);
  }

  const withNutrition = recipes.filter(recipeHasUsableNutrition);
  const resolved = recipes.map(resolveRecipeMealNutrition);
  const result = emptyTotals(recipes.length, withNutrition.length);

  for (const key of SUM_KEYS) {
    let sum = 0;
    let complete = true;
    for (const row of resolved) {
      const value = row[key];
      if (value === null) {
        complete = false;
        break;
      }
      sum += value;
    }
    result[key] = complete ? Math.round(sum * 10) / 10 : null;
  }

  return result;
}

export function mealNutritionTotalsForSlot(
  item: MealDishItem,
  recipes: Recipe[],
): MealNutritionTotals {
  if (!item.recipeId) return emptyTotals(0, 0);
  const recipe = recipes.find((r) => r.id === item.recipeId);
  if (!recipe) return emptyTotals(1, 0);
  return sumMealNutrition([recipe]);
}

export function mealNutritionTotalsForDay(
  day: DayMeal,
  recipes: Recipe[],
): MealNutritionTotals {
  const dayRecipes: Recipe[] = [];
  for (const item of day.items) {
    if (!item.recipeId) continue;
    const recipe = recipes.find((r) => r.id === item.recipeId);
    if (recipe) dayRecipes.push(recipe);
  }
  return sumMealNutrition(dayRecipes);
}

export function evaluateCarbTargetStatus(
  carbohydratesG: number | null,
  settings: DiabetesMealSupportSettings,
  scope: "meal" | "day",
): CarbTargetStatus {
  if (carbohydratesG === null) return "unknown";

  if (scope === "meal") {
    const min = settings.targetCarbsPerMealMin;
    const max = settings.targetCarbsPerMealMax;
    if (min == null && max == null) return "no_target";
    if (max != null && carbohydratesG > max) return "over";
    if (min != null && carbohydratesG < min) return "under";
    return "in_range";
  }

  const dayTarget = settings.targetCarbsPerDay;
  if (dayTarget == null) {
    // 1日目標が無い場合、1食目標×想定食数は推測しない
    return "no_target";
  }
  // 1日目標は「上限目安」として超過判定（未設定の下限は作らない）
  if (carbohydratesG > dayTarget) return "over";
  return "in_range";
}

export function dailyNutritionTotals(
  day: DayMeal,
  recipes: Recipe[],
  settings: DiabetesMealSupportSettings,
): DailyNutritionTotals {
  const totals = mealNutritionTotalsForDay(day, recipes);
  return {
    ...totals,
    date: day.date,
    carbStatus: evaluateCarbTargetStatus(
      totals.carbohydratesG,
      settings,
      "day",
    ),
  };
}

export function weeklyNutritionTotals(
  plan: MealPlan,
  recipes: Recipe[],
  settings: DiabetesMealSupportSettings,
): WeeklyNutritionTotals {
  const daily = plan.days.map((day) =>
    dailyNutritionTotals(day, recipes, settings),
  );
  const allRecipes: Recipe[] = [];
  for (const day of plan.days) {
    for (const item of day.items) {
      if (!item.recipeId) continue;
      const recipe = recipes.find((r) => r.id === item.recipeId);
      if (recipe) allRecipes.push(recipe);
    }
  }
  const week = sumMealNutrition(allRecipes);
  return {
    ...week,
    weekStart: plan.weekStart,
    daily,
  };
}
