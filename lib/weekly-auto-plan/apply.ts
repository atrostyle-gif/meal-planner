import { collectFamilyLearningHints } from "@/lib/family-profile-helpers";
import { loadFamilyMemberProfiles } from "@/lib/family-member-profiles";
import { collectRecentRecipeIds, getOrCreateMealPlan, replaceWeekDays } from "@/lib/meal-plans";
import { loadMealPlans } from "@/lib/meal-plans";
import {
  generateWeeklyMealPlan,
  type GenerateWeeklyPlanResult,
} from "@/lib/weekly-auto-plan/generate";
import { loadDiabetesMealSupportSettings } from "@/lib/diabetes-meal-support/settings";
import { loadFoodBudgetSettings } from "@/lib/food-budget/settings";
import { getActiveLeftoversForProposal } from "@/lib/leftover-ingredients";
import type { InventoryItem } from "@/types/inventory";
import type { LeftoverIngredient } from "@/types/leftover-ingredient";
import type { MealPlanTagId } from "@/types/meal-plan-tags";
import type { Recipe } from "@/types/recipe";
import type { WeeklyAutoScope, WeeklyMealPlan } from "@/types/weekly-meal-plan";
import type { DiabetesMealSupportSettings } from "@/types/diabetes-meal-support";
import type { FoodBudgetSettings } from "@/types/food-budget";

export type ApplyWeeklyAutoPlanInput = {
  weekStart: string;
  recipes: Recipe[];
  inventory?: InventoryItem[];
  leftovers?: LeftoverIngredient[];
  householdId?: string;
  scope?: WeeklyAutoScope;
  diabetesSettings?: DiabetesMealSupportSettings;
  foodBudgetSettings?: FoodBudgetSettings;
  planTags?: readonly MealPlanTagId[];
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
  const leftovers =
    input.leftovers ??
    getActiveLeftoversForProposal(
      input.householdId ?? "local",
      input.weekStart,
    );
  const familyHints = collectFamilyLearningHints(loadFamilyMemberProfiles());
  const generated = generateWeeklyMealPlan({
    weekStart: input.weekStart,
    days: plan.days,
    recipes: input.recipes,
    inventory: input.inventory ?? [],
    leftovers,
    recentRecipeIds,
    scope: input.scope,
    diabetesSettings,
    foodBudgetSettings,
    weeklyFoodBudgetYen:
      plan.weeklyFoodBudgetYen !== undefined
        ? plan.weeklyFoodBudgetYen
        : foodBudgetSettings.weeklyFoodBudgetYen,
    planTags: input.planTags,
    familyHints,
  });
  const saved = replaceWeekDays(input.weekStart, generated.days);
  return { ...generated, plan: saved };
}
