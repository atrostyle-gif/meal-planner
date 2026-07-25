import type { FoodDatabaseProvider, FoodRecord } from "@/types/food-database";
import { canonicalizeFoodLabel } from "@/lib/nutrition/food-normalizer";
import { parseIngredientQuantity } from "@/lib/nutrition/ingredient-parser";
import { computeNutritionCoverage } from "@/lib/nutrition/nutrition-coverage";

export type NutritionInputIngredient = {
  name: string;
  quantity: number | null;
  unit: string;
  quantityText?: string | null;
};

/** 1人分あたりの栄養（計算不能項目は null） */
export type RecipeNutritionResult = {
  caloriesKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbohydratesG: number | null;
  dietaryFiberG: number | null;
  sugarsG: number | null;
  sodiumMg: number | null;
  saltEquivalentG: number | null;
  nutritionCoverage: number;
  calculationSource: "automatic";
  nutritionStatus: "calculated" | "estimated" | "unavailable";
  matchedCount: number;
  totalCount: number;
  unmatchedNames: string[];
  perIngredient: Array<{
    name: string;
    foodCode: string | null;
    grams: number | null;
    calculated: boolean;
  }>;
};

type NutrientBucket = {
  energy: number;
  protein: number;
  fat: number;
  carbohydrate: number;
  dietaryFiber: number;
  sugars: number;
  sodium: number;
  saltEquivalent: number;
  // 各項目が全材料で揃ったか
  complete: Record<keyof Omit<NutrientBucket, "complete">, boolean>;
};

function emptyBucket(): NutrientBucket {
  return {
    energy: 0,
    protein: 0,
    fat: 0,
    carbohydrate: 0,
    dietaryFiber: 0,
    sugars: 0,
    sodium: 0,
    saltEquivalent: 0,
    complete: {
      energy: true,
      protein: true,
      fat: true,
      carbohydrate: true,
      dietaryFiber: true,
      sugars: true,
      sodium: true,
      saltEquivalent: true,
    },
  };
}

function addPer100g(
  bucket: NutrientBucket,
  food: FoodRecord,
  grams: number,
): void {
  const f = grams / 100;
  const p = food.per100g;
  const keys = [
    "energy",
    "protein",
    "fat",
    "carbohydrate",
    "dietaryFiber",
    "sugars",
    "sodium",
    "saltEquivalent",
  ] as const;
  for (const key of keys) {
    const value = p[key];
    if (value == null) {
      bucket.complete[key] = false;
      continue;
    }
    bucket[key] += value * f;
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * 材料から栄養を計算する。
 * マッチしない／換算できない材料は推測せず coverage を下げる。
 */
export function calculateNutritionFromIngredients(
  ingredients: NutritionInputIngredient[],
  servings: number,
  database: FoodDatabaseProvider,
): RecipeNutritionResult {
  const usable = ingredients.filter((item) => item.name.trim() !== "");
  const bucket = emptyBucket();
  const unmatchedNames: string[] = [];
  const perIngredient: RecipeNutritionResult["perIngredient"] = [];
  let matchedCount = 0;

  for (const ingredient of usable) {
    const label = canonicalizeFoodLabel(ingredient.name);
    const search = database.searchByName(label);
    if (!search.food) {
      unmatchedNames.push(ingredient.name);
      perIngredient.push({
        name: ingredient.name,
        foodCode: null,
        grams: null,
        calculated: false,
      });
      // 計算できない材料がいる → 全項目の完全性を落とす
      for (const key of Object.keys(bucket.complete) as Array<
        keyof NutrientBucket["complete"]
      >) {
        bucket.complete[key] = false;
      }
      continue;
    }

    const parsed = parseIngredientQuantity({
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      quantityText: ingredient.quantityText,
      food: search.food,
    });

    if (parsed.grams == null) {
      unmatchedNames.push(`${ingredient.name}（数量換算不可）`);
      perIngredient.push({
        name: ingredient.name,
        foodCode: search.food.foodCode,
        grams: null,
        calculated: false,
      });
      for (const key of Object.keys(bucket.complete) as Array<
        keyof NutrientBucket["complete"]
      >) {
        bucket.complete[key] = false;
      }
      continue;
    }

    addPer100g(bucket, search.food, parsed.grams);
    matchedCount += 1;
    perIngredient.push({
      name: ingredient.name,
      foodCode: search.food.foodCode,
      grams: parsed.grams,
      calculated: true,
    });
  }

  const coverage = computeNutritionCoverage(matchedCount, usable.length);
  const denom = Math.max(1, servings);

  const toPerServing = (
    total: number,
    complete: boolean,
  ): number | null => {
    if (matchedCount === 0) return null;
    if (!complete) return null;
    return round1(total / denom);
  };

  let nutritionStatus: RecipeNutritionResult["nutritionStatus"] = "unavailable";
  if (matchedCount === usable.length && usable.length > 0) {
    nutritionStatus = "calculated";
  } else if (matchedCount > 0) {
    nutritionStatus = "estimated";
  }

  return {
    caloriesKcal: toPerServing(bucket.energy, bucket.complete.energy),
    proteinG: toPerServing(bucket.protein, bucket.complete.protein),
    fatG: toPerServing(bucket.fat, bucket.complete.fat),
    carbohydratesG: toPerServing(
      bucket.carbohydrate,
      bucket.complete.carbohydrate,
    ),
    dietaryFiberG: toPerServing(
      bucket.dietaryFiber,
      bucket.complete.dietaryFiber,
    ),
    sugarsG: toPerServing(bucket.sugars, bucket.complete.sugars),
    sodiumMg: toPerServing(bucket.sodium, bucket.complete.sodium),
    saltEquivalentG: toPerServing(
      bucket.saltEquivalent,
      bucket.complete.saltEquivalent,
    ),
    nutritionCoverage: coverage,
    calculationSource: "automatic",
    nutritionStatus,
    matchedCount,
    totalCount: usable.length,
    unmatchedNames,
    perIngredient,
  };
}
