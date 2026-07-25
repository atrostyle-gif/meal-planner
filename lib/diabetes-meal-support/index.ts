export {
  loadDiabetesMealSupportSettings,
  saveDiabetesMealSupportSettings,
  subscribeDiabetesMealSupportSettings,
} from "@/lib/diabetes-meal-support/settings";
export {
  resolveRecipeMealNutrition,
  recipeHasUsableNutrition,
  hasNonStarchyVegetables,
  migrateExtendedNutritionFields,
} from "@/lib/diabetes-meal-support/recipe-nutrition";
export {
  sumMealNutrition,
  mealNutritionTotalsForSlot,
  mealNutritionTotalsForDay,
  dailyNutritionTotals,
  weeklyNutritionTotals,
  evaluateCarbTargetStatus,
} from "@/lib/diabetes-meal-support/aggregate";
export { scoreDiabetesMealSupport } from "@/lib/diabetes-meal-support/score";
export {
  buildDiabetesImprovementSuggestions,
  assertSuggestionsAreProposalsOnly,
} from "@/lib/diabetes-meal-support/suggestions";
export {
  buildDiabetesMealSupportReport,
  DIABETES_SUPPORT_DISCLAIMER,
  CARB_NOT_GLUCOSE_DISCLAIMER,
} from "@/lib/diabetes-meal-support/report";
