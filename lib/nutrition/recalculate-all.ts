import {
  applyAutomaticNutritionToRecipeInput,
} from "@/lib/nutrition/recipe-nutrition";
import { clearNutritionCache } from "@/lib/nutrition/calculate";
import { loadRecipes, replaceRecipes } from "@/lib/recipes";
import type { Recipe, RecipeInput } from "@/types/recipe";

export type RecalculateNutritionResult = {
  total: number;
  calculated: number;
  partial: number;
  uncalculated: number;
};

function toRecipeInput(recipe: Recipe): RecipeInput {
  return {
    name: recipe.name,
    ingredients: recipe.ingredients.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      note: item.note,
      ingredientType: item.ingredientType,
    })),
    steps: recipe.steps.map((step) => ({ text: step.text })),
    memo: recipe.memo ?? "",
    category: recipe.category,
    course: recipe.course,
    tags: recipe.tags,
    servings: recipe.servings,
    cookingTimeMinutes: recipe.cookingTimeMinutes,
    calories: recipe.calories,
    protein: recipe.protein,
    fat: recipe.fat,
    carbohydrates: recipe.carbohydrates,
    salt: recipe.salt,
    vegetables: recipe.vegetables,
    nutritionStatus: recipe.nutritionStatus,
    caloriesKcal: recipe.caloriesKcal,
    carbohydratesG: recipe.carbohydratesG,
    sugarsG: recipe.sugarsG,
    dietaryFiberG: recipe.dietaryFiberG,
    proteinG: recipe.proteinG,
    fatG: recipe.fatG,
    saturatedFatG: recipe.saturatedFatG,
    sodiumMg: recipe.sodiumMg,
    saltEquivalentG: recipe.saltEquivalentG,
    nutritionCoverage: recipe.nutritionCoverage,
    calculationSource: recipe.calculationSource,
    proteinType: recipe.proteinType,
    season: recipe.season,
    difficulty: recipe.difficulty,
    favoriteScore: recipe.favoriteScore,
    healthyScore: recipe.healthyScore,
    cookingProfile: recipe.cookingProfile,
    importMethod: recipe.importMethod,
    source: recipe.source,
    mealAffinity: recipe.mealAffinity,
    extractionWarnings: recipe.extractionWarnings,
  };
}

/**
 * 全レシピの材料ベース栄養を再計算し、手入力を優先して補完する。
 */
export function recalculateAllRecipeNutrition(): RecalculateNutritionResult {
  clearNutritionCache();
  const recipes = loadRecipes();
  let calculated = 0;
  let partial = 0;
  let uncalculated = 0;

  const next: Recipe[] = recipes.map((recipe) => {
    const mergedInput = applyAutomaticNutritionToRecipeInput(toRecipeInput(recipe));
    const coverage = mergedInput.nutritionCoverage ?? 0;

    if (coverage <= 0 && mergedInput.calculationSource === "unknown") {
      uncalculated += 1;
      return recipe;
    }
    if (coverage >= 60) {
      calculated += 1;
    } else {
      partial += 1;
    }

    return {
      ...recipe,
      calories: mergedInput.calories,
      protein: mergedInput.protein,
      fat: mergedInput.fat,
      carbohydrates: mergedInput.carbohydrates,
      salt: mergedInput.salt,
      nutritionStatus: mergedInput.nutritionStatus,
      caloriesKcal: mergedInput.caloriesKcal,
      carbohydratesG: mergedInput.carbohydratesG,
      sugarsG: mergedInput.sugarsG,
      dietaryFiberG: mergedInput.dietaryFiberG,
      proteinG: mergedInput.proteinG,
      fatG: mergedInput.fatG,
      saturatedFatG: mergedInput.saturatedFatG,
      sodiumMg: mergedInput.sodiumMg,
      saltEquivalentG: mergedInput.saltEquivalentG,
      nutritionCoverage: mergedInput.nutritionCoverage,
      calculationSource: mergedInput.calculationSource,
      updatedAt: new Date().toISOString(),
    };
  });

  replaceRecipes(next);
  return {
    total: recipes.length,
    calculated,
    partial,
    uncalculated,
  };
}
