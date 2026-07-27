import { calculateNutritionFromIngredients } from "@/lib/nutrition/nutrition-calculator";
import { loadDefaultFoodDatabaseSync } from "@/lib/nutrition/food-database";
import { parseIngredientQuantity } from "@/lib/nutrition/ingredient-parser";
import { canonicalizeFoodLabel } from "@/lib/nutrition/food-normalizer";
import type { FoodDatabaseProvider } from "@/types/food-database";
import type { IngredientInput } from "@/types/recipe";

export type AutoNutritionIngredient = {
  name: string;
  quantity: number | null;
  unit: string;
  quantityText?: string | null;
};

export type AutoNutritionPreview = {
  caloriesKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbohydratesG: number | null;
  saltEquivalentG: number | null;
  dietaryFiberG: number | null;
  vegetablesG: number | null;
  nutritionCoverage: number;
  nutritionStatus: "calculated" | "estimated" | "unavailable";
  difficulty: number;
  healthyScore: number;
  matchedCount: number;
  totalCount: number;
};

const VEGETABLE_CATEGORIES = new Set(["野菜", "きのこ", "いも", "海藻"]);

/**
 * 材料数・工程数・調理時間から難易度 1〜5 を推定する。
 */
export function estimateDifficultyScore(input: {
  ingredientCount: number;
  stepCount: number;
  cookingTimeMinutes: number | null;
}): number {
  const { ingredientCount, stepCount, cookingTimeMinutes } = input;
  let score = 1;

  if (ingredientCount >= 6) score += 1;
  if (ingredientCount >= 10) score += 1;
  if (stepCount >= 5) score += 1;
  if (stepCount >= 8) score += 1;

  if (cookingTimeMinutes != null) {
    if (cookingTimeMinutes >= 30) score += 1;
    if (cookingTimeMinutes >= 50) score += 1;
  } else if (stepCount >= 6) {
    score += 1;
  }

  return Math.min(5, Math.max(1, score));
}

/**
 * 栄養値から健康スコア 0〜5 を自動評価する（旧ヘルシー欄の代替）。
 */
export function estimateHealthScore(input: {
  caloriesKcal: number | null;
  proteinG: number | null;
  dietaryFiberG: number | null;
  saltEquivalentG: number | null;
  vegetablesG: number | null;
}): number {
  let score = 2;

  if (input.proteinG != null && input.proteinG >= 15) score += 1;
  if (input.dietaryFiberG != null && input.dietaryFiberG >= 3) score += 1;
  if (input.vegetablesG != null && input.vegetablesG >= 80) score += 1;
  if (input.saltEquivalentG != null && input.saltEquivalentG <= 2) score += 1;
  if (input.saltEquivalentG != null && input.saltEquivalentG > 3.5) score -= 1;
  if (input.caloriesKcal != null && input.caloriesKcal > 900) score -= 1;
  if (input.caloriesKcal != null && input.caloriesKcal < 150) score -= 1;

  return Math.min(5, Math.max(0, score));
}

/**
 * 野菜・きのこ等の材料グラム合計（1人分）を推定する。
 */
export function estimateVegetablesPerServing(
  ingredients: AutoNutritionIngredient[],
  servings: number,
  database: FoodDatabaseProvider = loadDefaultFoodDatabaseSync(),
): number | null {
  const usable = ingredients.filter((item) => item.name.trim() !== "");
  if (usable.length === 0) return null;

  let totalGrams = 0;
  let matched = 0;

  for (const ingredient of usable) {
    const label = canonicalizeFoodLabel(ingredient.name);
    const search = database.searchByName(label);
    if (!search.food || !VEGETABLE_CATEGORIES.has(search.food.category)) {
      continue;
    }
    const parsed = parseIngredientQuantity({
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      quantityText: ingredient.quantityText,
      food: search.food,
    });
    if (parsed.grams == null) continue;
    totalGrams += parsed.grams;
    matched += 1;
  }

  if (matched === 0) return null;
  return Math.round(totalGrams / Math.max(1, servings));
}

/** フォーム用: 材料から栄養・難易度・健康スコアをまとめて算出 */
export function buildAutoNutritionPreview(input: {
  ingredients: AutoNutritionIngredient[];
  servings: number;
  stepCount: number;
  cookingTimeMinutes: number | null;
  database?: FoodDatabaseProvider;
}): AutoNutritionPreview {
  const database = input.database ?? loadDefaultFoodDatabaseSync();
  const servings = Math.max(1, input.servings);
  const namedIngredients = input.ingredients.filter(
    (item) => item.name.trim() !== "",
  );

  const nutrition = calculateNutritionFromIngredients(
    namedIngredients.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      quantityText: item.quantityText,
    })),
    servings,
    database,
  );

  const vegetablesG = estimateVegetablesPerServing(
    namedIngredients,
    servings,
    database,
  );

  const difficulty = estimateDifficultyScore({
    ingredientCount: namedIngredients.length,
    stepCount: input.stepCount,
    cookingTimeMinutes: input.cookingTimeMinutes,
  });

  const healthyScore = estimateHealthScore({
    caloriesKcal: nutrition.caloriesKcal,
    proteinG: nutrition.proteinG,
    dietaryFiberG: nutrition.dietaryFiberG,
    saltEquivalentG: nutrition.saltEquivalentG,
    vegetablesG,
  });

  return {
    caloriesKcal: nutrition.caloriesKcal,
    proteinG: nutrition.proteinG,
    fatG: nutrition.fatG,
    carbohydratesG: nutrition.carbohydratesG,
    saltEquivalentG: nutrition.saltEquivalentG,
    dietaryFiberG: nutrition.dietaryFiberG,
    vegetablesG,
    nutritionCoverage: nutrition.nutritionCoverage,
    nutritionStatus: nutrition.nutritionStatus,
    difficulty,
    healthyScore,
    matchedCount: nutrition.matchedCount,
    totalCount: nutrition.totalCount,
  };
}

export function toAutoIngredients(
  ingredients: IngredientInput[],
): AutoNutritionIngredient[] {
  return ingredients.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    quantityText: null,
  }));
}
