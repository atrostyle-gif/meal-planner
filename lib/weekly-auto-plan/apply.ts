import { collectRecentRecipeIds, getOrCreateMealPlan, replaceWeekDays } from "@/lib/meal-plans";
import { loadMealPlans } from "@/lib/meal-plans";
import {
  generateWeeklyMealPlan,
  type GenerateWeeklyPlanResult,
} from "@/lib/weekly-auto-plan/generate";
import { loadDiabetesMealSupportSettings } from "@/lib/diabetes-meal-support/settings";
import type { InventoryItem } from "@/types/inventory";
import type { Recipe } from "@/types/recipe";
import type { WeeklyAutoScope, WeeklyMealPlan } from "@/types/weekly-meal-plan";
import type { DiabetesMealSupportSettings } from "@/types/diabetes-meal-support";

export type ApplyWeeklyAutoPlanInput = {
  weekStart: string;
  recipes: Recipe[];
  inventory?: InventoryItem[];
  scope?: WeeklyAutoScope;
  diabetesSettings?: DiabetesMealSupportSettings;
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
  const generated = generateWeeklyMealPlan({
    weekStart: input.weekStart,
    days: plan.days,
    recipes: input.recipes,
    inventory: input.inventory ?? [],
    recentRecipeIds,
    scope: input.scope,
    diabetesSettings,
  });
  const saved = replaceWeekDays(input.weekStart, generated.days);
  return { ...generated, plan: saved };
}
