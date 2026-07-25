import {
  dailyNutritionTotals,
  evaluateCarbTargetStatus,
  mealNutritionTotalsForDay,
  weeklyNutritionTotals,
} from "@/lib/diabetes-meal-support/aggregate";
import {
  dayHasVegetables,
  buildDiabetesImprovementSuggestions,
} from "@/lib/diabetes-meal-support/suggestions";
import type {
  DiabetesMealSupportReport,
  DiabetesMealSupportSettings,
} from "@/types/diabetes-meal-support";
import type { MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";

export const DIABETES_SUPPORT_DISCLAIMER =
  "この機能は食事管理を補助するもので、医療上の判断や治療の代わりにはなりません。服薬・インスリン・低血糖リスクがある場合は、医師または管理栄養士の指示を優先してください。";

export const CARB_NOT_GLUCOSE_DISCLAIMER =
  "表示しているのは料理の推定「糖質」です。「血糖値」の予測や断定ではありません。食後血糖の個人差は大きいため、数値から血糖値を推測しないでください。";

export function buildDiabetesMealSupportReport(
  plan: MealPlan,
  recipes: Recipe[],
  settings: DiabetesMealSupportSettings,
): DiabetesMealSupportReport {
  const weekly = weeklyNutritionTotals(plan, recipes, settings);
  const mealChecks = plan.days.map((day) => {
    const totals = mealNutritionTotalsForDay(day, recipes);
    return {
      date: day.date,
      carbohydratesG: totals.carbohydratesG,
      status: evaluateCarbTargetStatus(
        totals.carbohydratesG,
        settings,
        "meal",
      ),
      hasVegetables: dayHasVegetables(day, recipes),
      dietaryFiberG: totals.dietaryFiberG,
      nutritionCoverage: totals.nutritionCoverage,
    };
  });

  return {
    enabled: settings.diabetesMealSupportEnabled,
    disclaimer: DIABETES_SUPPORT_DISCLAIMER,
    carbDisclaimer: CARB_NOT_GLUCOSE_DISCLAIMER,
    mealChecks,
    dailyTotals: plan.days.map((day) =>
      dailyNutritionTotals(day, recipes, settings),
    ),
    weeklyTotals: weekly,
    suggestions: buildDiabetesImprovementSuggestions(plan, recipes, settings),
  };
}
