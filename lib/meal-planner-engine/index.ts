export type {
  MealPlannerAiContext,
  MealPlannerEngine,
  MealPlannerEngineInput,
  MealPlannerEngineResult,
  PlannedDayMeal,
  ScoredRecipeCandidate,
} from "@/lib/meal-planner-engine/types";

export { mealPlannerEngine } from "@/lib/meal-planner-engine/plan-week";
export { MEAL_NUTRITION_TARGETS, scoreRecipeCandidate } from "@/lib/meal-planner-engine/score";
export {
  applyProposalToDays,
  evaluateMealCombination,
  optimizeDayMeal,
  optimizeWeeklyMealPlan,
  type MealPlanProposal,
  type ProposedDayMeal,
} from "@/lib/meal-planner-engine/v3";
export {
  evaluateDayLifestyleFit,
  evaluateRecipeForCook,
  evaluateWeeklyIngredientReuse,
  lifestyleModeWeight,
  optimizeDayMealV4,
  optimizeWeeklyMealPlanV4,
  type OptimizeContextV4,
  type WeekIngredientUsage,
} from "@/lib/meal-planner-engine/v4";
export {
  evaluateLeftoverIngredientUsage,
  evaluateIngredientCoverage,
  evaluateRepeatedIngredientPenalty,
  evaluateAdditionalPurchaseNeeds,
} from "@/lib/leftover-match";
export {
  evaluateCandidateAgainstMealSet,
  evaluateMealSetCompatibility,
  detectCuisineFamily,
  detectFlavorProfiles,
} from "@/lib/meal-planner-engine/meal-set";
