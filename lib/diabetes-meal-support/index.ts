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
export {
  scoreHealthMealSupport,
  scoreDiabetesMealSupport,
} from "@/lib/diabetes-meal-support/score";
export {
  DIABETES_SUPPORT_DISCLAIMER,
  CARB_NOT_GLUCOSE_DISCLAIMER,
  HEALTH_WEIGHT_SUPPORT_INTRO,
  buildDiabetesMealSupportReport,
} from "@/lib/diabetes-meal-support/report";
export {
  buildDiabetesImprovementSuggestions,
  assertSuggestionsAreProposalsOnly,
} from "@/lib/diabetes-meal-support/suggestions";
export {
  calculateBmi,
  calculateReferenceWeight,
  calculateReferenceCalories,
  calculateReferenceCarbRange,
  distributeCarbsAcrossMeals,
  createReferenceGoalExplanation,
  buildReferenceGoalResult,
} from "@/lib/diabetes-meal-support/reference-goal";
export {
  resolveEffectiveCarbTargets,
  goalSourceLabel,
} from "@/lib/diabetes-meal-support/resolve-targets";
