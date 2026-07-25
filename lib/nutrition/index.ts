export type { FoodDatabaseProvider, FoodRecord } from "@/types/food-database";
export {
  InMemoryFoodDatabase,
  createJsonFoodDatabase,
  loadDefaultFoodDatabase,
  loadDefaultFoodDatabaseSync,
  PlaceholderMextFoodDatabase,
  resetFoodDatabaseCacheForTests,
} from "@/lib/nutrition/food-database";
export {
  FOOD_NAME_ALIASES,
  normalizeFoodName,
  canonicalizeFoodLabel,
} from "@/lib/nutrition/food-normalizer";
export {
  parseIngredientQuantity,
  type ParsedIngredientQuantity,
} from "@/lib/nutrition/ingredient-parser";
export {
  calculateNutritionFromIngredients,
  type RecipeNutritionResult,
  type NutritionInputIngredient,
} from "@/lib/nutrition/nutrition-calculator";
export {
  computeNutritionCoverage,
  coverageLabel,
} from "@/lib/nutrition/nutrition-coverage";
export {
  calculateNutritionFromRecipeDraft,
  calculateNutritionFromRecipe,
  mergeManualAndAutomaticNutrition,
  applyAutomaticNutritionToRecipeInput,
  type MergedRecipeNutrition,
  type NutritionCalculationSource,
} from "@/lib/nutrition/recipe-nutrition";

// 既存API互換
export {
  calculateRecipeNutritionFromIngredients,
  resolveRecipeNutrition,
  getCachedRecipeNutrition,
  clearNutritionCache,
  sumDayNutrition,
} from "@/lib/nutrition/calculate";
