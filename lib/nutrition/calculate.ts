import { findFoodMaster } from "@/lib/food-master/match";
import { convertQuantityToGrams } from "@/lib/food-master/unit-convert";
import type { Ingredient } from "@/types/recipe";
import type { Recipe } from "@/types/recipe";
import {
  addNutritionAmount,
  emptyNutritionAmount,
  scaleNutritionAmount,
  type FoodIngredientMaster,
  type NutritionAmount,
  type NutritionCalculationResult,
  type NutritionValueSource,
} from "@/types/food-master";

function fromPer100g(
  per100: FoodIngredientMaster["nutritionPer100g"],
  grams: number,
  isVegetableLike: boolean,
): NutritionAmount {
  const f = grams / 100;
  return {
    calories: per100.calories * f,
    protein: per100.protein * f,
    fat: per100.fat * f,
    carbohydrates: per100.carbohydrates * f,
    fiber: per100.fiber * f,
    saltEquivalent: per100.saltEquivalent * f,
    calcium: per100.calcium * f,
    iron: per100.iron * f,
    vitaminA: (per100.vitaminA ?? 0) * f,
    vitaminB1: (per100.vitaminB1 ?? 0) * f,
    vitaminB2: (per100.vitaminB2 ?? 0) * f,
    vitaminC: (per100.vitaminC ?? 0) * f,
    vegetables: isVegetableLike ? grams : 0,
  };
}

const VEGETABLE_LIKE = new Set(["野菜", "きのこ", "海藻"]);

export type CalculateRecipeNutritionOptions = {
  masters: FoodIngredientMaster[];
  aliasMap?: Map<string, string>;
  /**
   * @deprecated 1人分計算には使わない（二重倍率防止）。
   * 日別全量は plannedServings と scaleNutritionForPlannedServings を使う。
   */
  servingsOverride?: number | null;
  /** その日の献立人数（全量栄養の算出用。1人分には影響しない） */
  plannedServings?: number | null;
};

/**
 * 材料からレシピ栄養を計算する。
 * 手動入力値がある場合は source=manual として別途呼び出し側で優先可能。
 */
export function calculateRecipeNutritionFromIngredients(
  ingredients: Ingredient[],
  servings: number,
  options: CalculateRecipeNutritionOptions,
): NutritionCalculationResult {
  let total = emptyNutritionAmount();
  let calculated = 0;
  const uncalculated: string[] = [];

  for (const ingredient of ingredients) {
    const match = findFoodMaster(
      ingredient.name,
      options.masters,
      options.aliasMap,
    );
    if (!match.master) {
      uncalculated.push(ingredient.name);
      continue;
    }

    const converted = convertQuantityToGrams(
      ingredient.quantity,
      ingredient.unit,
      match.master,
    );
    if (!converted.ok) {
      uncalculated.push(`${ingredient.name}（${converted.message}）`);
      continue;
    }

    const portion = fromPer100g(
      match.master.nutritionPer100g,
      converted.grams,
      VEGETABLE_LIKE.has(match.master.category),
    );
    total = addNutritionAmount(total, portion);
    calculated += 1;
  }

  const safeServings = Math.max(1, servings);
  // 1人分は常にレシピ基準人数で割る（献立人数で変えない）
  const totalIngredients = ingredients.filter((item) => item.name.trim() !== "").length;
  const confidence =
    totalIngredients === 0
      ? 0
      : Math.round((calculated / totalIngredients) * 100) / 100;

  return {
    total,
    perServing: scaleNutritionAmount(total, 1 / safeServings),
    calculatedIngredientCount: calculated,
    uncalculatedIngredientCount: uncalculated.length,
    uncalculatedIngredients: uncalculated,
    confidence,
    source: calculated > 0 ? "ingredient_calculated" : "uncalculated",
    calculatedAt: new Date().toISOString(),
  };
}

/** 手動入力のレシピ栄養を NutritionAmount に変換 */
export function nutritionFromManualRecipeFields(
  recipe: Pick<
    Recipe,
    "calories" | "protein" | "fat" | "carbohydrates" | "salt" | "vegetables"
  >,
): NutritionAmount | null {
  const hasAny =
    recipe.calories != null ||
    recipe.protein != null ||
    recipe.fat != null ||
    recipe.carbohydrates != null ||
    recipe.salt != null ||
    recipe.vegetables != null;
  if (!hasAny) {
    return null;
  }
  const base = emptyNutritionAmount();
  return {
    ...base,
    calories: recipe.calories ?? 0,
    protein: recipe.protein ?? 0,
    fat: recipe.fat ?? 0,
    carbohydrates: recipe.carbohydrates ?? 0,
    saltEquivalent: recipe.salt ?? 0,
    vegetables: recipe.vegetables ?? 0,
  };
}

export function resolveRecipeNutrition(
  recipe: Recipe,
  options: CalculateRecipeNutritionOptions,
): NutritionCalculationResult {
  const calculated = calculateRecipeNutritionFromIngredients(
    recipe.ingredients,
    recipe.servings,
    options,
  );

  const manual = nutritionFromManualRecipeFields(recipe);
  if (manual && calculated.calculatedIngredientCount === 0) {
    return {
      total: scaleNutritionAmount(manual, recipe.servings),
      perServing: manual,
      calculatedIngredientCount: 0,
      uncalculatedIngredientCount: recipe.ingredients.length,
      uncalculatedIngredients: recipe.ingredients.map((item) => item.name),
      confidence: 0.5,
      source: "manual",
      calculatedAt: new Date().toISOString(),
    };
  }

  if (manual && calculated.confidence < 0.4) {
    // 材料計算が弱い場合は手動を推定扱いで併用表示用に manual 優先
    return {
      ...calculated,
      total: scaleNutritionAmount(manual, recipe.servings),
      perServing: manual,
      source: "manual",
      confidence: Math.max(calculated.confidence, 0.5),
    };
  }

  if (calculated.calculatedIngredientCount === 0) {
    return {
      ...calculated,
      source: "uncalculated",
    };
  }

  return calculated;
}

export function nutritionSourceLabel(source: NutritionValueSource): string {
  switch (source) {
    case "ingredient_calculated":
      return "材料から自動計算";
    case "manual":
      return "手動入力";
    case "estimated":
      return "推定値";
    default:
      return "未計算";
  }
}

const cache = new Map<string, NutritionCalculationResult>();

export function getCachedRecipeNutrition(
  recipe: Recipe,
  options: CalculateRecipeNutritionOptions,
): NutritionCalculationResult {
  const key = `${recipe.id}:${recipe.updatedAt}`;
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }
  const result = resolveRecipeNutrition(recipe, options);
  cache.set(key, result);
  if (cache.size > 500) {
    const first = cache.keys().next().value;
    if (first) {
      cache.delete(first);
    }
  }
  return result;
}

export function clearNutritionCache(): void {
  cache.clear();
}

export function sumDayNutrition(
  results: NutritionCalculationResult[],
): NutritionAmount {
  return results.reduce(
    (sum, item) => addNutritionAmount(sum, item.perServing),
    emptyNutritionAmount(),
  );
}

/**
 * 1人分栄養 × 献立人数 = その日に作る全量の栄養。
 * perServing を再度人数で割らない（二重適用しない）。
 */
export function scaleNutritionForPlannedServings(
  perServing: NutritionAmount,
  plannedServings: number,
): NutritionAmount {
  const safe =
    Number.isFinite(plannedServings) && plannedServings > 0
      ? plannedServings
      : 1;
  return scaleNutritionAmount(perServing, safe);
}
