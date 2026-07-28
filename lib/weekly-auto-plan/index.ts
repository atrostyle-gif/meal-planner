export {
  generateWeeklyMealPlan,
  applyGeneratedDaysToPlan,
  type GenerateWeeklyPlanInput,
  type GenerateWeeklyPlanResult,
} from "@/lib/weekly-auto-plan/generate";
export { applyWeeklyAutoPlan } from "@/lib/weekly-auto-plan/apply";
export {
  createDefaultWeeklyPlanAiProvider,
  MockWeeklyPlanAiProvider,
  NoOpWeeklyPlanAiProvider,
  OpenAiWeeklyPlanAiProvider,
  type WeeklyPlanAiProvider,
  type WeeklyPlanAiSuggestion,
} from "@/lib/weekly-auto-plan/ai-provider";
export {
  getMainIngredientKey,
  getMainIngredientNames,
  getGenreKey,
  isFishRecipe,
  isMeatRecipe,
} from "@/lib/weekly-auto-plan/recipe-features";
export {
  recommendRecipesForSlot,
  type RecommendCandidate,
  type RecommendTabId,
} from "@/lib/weekly-auto-plan/recommend";
export { evaluateDayCombo } from "@/lib/weekly-auto-plan/combo";
export { scoreMealPlanTags } from "@/lib/weekly-auto-plan/plan-tags-score";
export {
  buildMealSelectionReason,
  aggregateDaySelectionReasons,
  formatReasonsForUi,
} from "@/lib/weekly-auto-plan/explain";
