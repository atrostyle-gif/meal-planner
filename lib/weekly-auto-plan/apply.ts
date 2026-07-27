import { collectRecentRecipeIds, getOrCreateMealPlan, replaceWeekDays } from "@/lib/meal-plans";
import { loadMealPlans } from "@/lib/meal-plans";
import {
  generateWeeklyMealPlan,
  type GenerateWeeklyPlanResult,
} from "@/lib/weekly-auto-plan/generate";
import { loadDiabetesMealSupportSettings } from "@/lib/diabetes-meal-support/settings";
import { loadFoodBudgetSettings } from "@/lib/food-budget/settings";
import type { InventoryItem } from "@/types/inventory";
import type { Recipe } from "@/types/recipe";
import type { WeeklyAutoScope, WeeklyMealPlan } from "@/types/weekly-meal-plan";
import type { DiabetesMealSupportSettings } from "@/types/diabetes-meal-support";
import type { FoodBudgetSettings } from "@/types/food-budget";

export type ApplyWeeklyAutoPlanInput = {
  weekStart: string;
  recipes: Recipe[];
  inventory?: InventoryItem[];
  scope?: WeeklyAutoScope;
  diabetesSettings?: DiabetesMealSupportSettings;
  foodBudgetSettings?: FoodBudgetSettings;
};

/**
 * 自動編成して既存 MealPlan ストレージへ保存する。
 */
export function applyWeeklyAutoPlan(
  input: ApplyWeeklyAutoPlanInput,
): GenerateWeeklyPlanResult & { plan: WeeklyMealPlan } {
  const plan = getOrCreateMealPlan(input.weekStart);
  const recentRecipeIds = collectRecentRecipeIds(
    loadMealPlans(),
    input.weekStart,
  );
  const diabetesSettings =
    input.diabetesSettings ?? loadDiabetesMealSupportSettings();
  const foodBudgetSettings =
    input.foodBudgetSettings ?? loadFoodBudgetSettings();
  const generated = generateWeeklyMealPlan({
    weekStart: input.weekStart,
    days: plan.days,
    recipes: input.recipes,
    inventory: input.inventory ?? [],
    recentRecipeIds,
    scope: input.scope,
    diabetesSettings,
    foodBudgetSettings,
    weeklyFoodBudgetYen:
      plan.weeklyFoodBudgetYen !== undefined
        ? plan.weeklyFoodBudgetYen
        : foodBudgetSettings.weeklyFoodBudgetYen,
  });
  const saved = replaceWeekDays(input.weekStart, generated.days);
  return { ...generated, plan: saved };
}
