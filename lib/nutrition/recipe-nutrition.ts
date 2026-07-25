import type { FoodDatabaseProvider } from "@/types/food-database";
import type { Recipe, RecipeInput } from "@/types/recipe";
import type { RecipeDraft } from "@/types/recipe-import";
import {
  calculateNutritionFromIngredients,
  type RecipeNutritionResult,
} from "@/lib/nutrition/nutrition-calculator";
import { loadDefaultFoodDatabaseSync } from "@/lib/nutrition/food-database";

export type NutritionCalculationSource =
  | "manual"
  | "automatic"
  | "mixed"
  | "unknown";

export type MergedRecipeNutrition = {
  nutritionStatus: "calculated" | "estimated" | "unavailable";
  calculationSource: NutritionCalculationSource;
  nutritionCoverage: number | null;
  caloriesKcal: number | null;
  carbohydratesG: number | null;
  sugarsG: number | null;
  dietaryFiberG: number | null;
  proteinG: number | null;
  fatG: number | null;
  saturatedFatG: number | null;
  sodiumMg: number | null;
  saltEquivalentG: number | null;
  // 旧フィールド同期用
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbohydrates: number | null;
  salt: number | null;
  automatic: RecipeNutritionResult | null;
};

function hasManualValue(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value);
}

function pickManualOrAuto(
  manual: number | null | undefined,
  automatic: number | null | undefined,
): number | null {
  if (hasManualValue(manual)) return manual as number;
  if (hasManualValue(automatic)) return automatic as number;
  return null;
}

/**
 * RecipeDraft の材料から栄養を自動計算する。
 */
export function calculateNutritionFromRecipeDraft(
  draft: RecipeDraft,
  database: FoodDatabaseProvider = loadDefaultFoodDatabaseSync(),
): RecipeNutritionResult {
  const servings = draft.servings && draft.servings >= 1 ? draft.servings : 1;
  return calculateNutritionFromIngredients(
    draft.ingredients.map((item) => ({
      name: item.name,
      quantity: item.quantity ?? null,
      unit: item.unit ?? "",
      quantityText: item.quantityText ?? null,
    })),
    servings,
    database,
  );
}

/**
 * 保存済み Recipe の材料から栄養を自動計算する。
 */
export function calculateNutritionFromRecipe(
  recipe: Pick<Recipe, "ingredients" | "servings">,
  database: FoodDatabaseProvider = loadDefaultFoodDatabaseSync(),
): RecipeNutritionResult {
  return calculateNutritionFromIngredients(
    recipe.ingredients.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
    })),
    Math.max(1, recipe.servings),
    database,
  );
}

/**
 * 手入力を優先し、不足分のみ自動計算で補完する。
 */
export function mergeManualAndAutomaticNutrition(input: {
  manual: Partial<{
    calories: number | null;
    protein: number | null;
    fat: number | null;
    carbohydrates: number | null;
    salt: number | null;
    caloriesKcal: number | null;
    carbohydratesG: number | null;
    sugarsG: number | null;
    dietaryFiberG: number | null;
    proteinG: number | null;
    fatG: number | null;
    saturatedFatG: number | null;
    sodiumMg: number | null;
    saltEquivalentG: number | null;
  }>;
  automatic: RecipeNutritionResult | null;
}): MergedRecipeNutrition {
  const auto = input.automatic;
  const manual = input.manual;

  const manualPresent =
    hasManualValue(manual.calories) ||
    hasManualValue(manual.caloriesKcal) ||
    hasManualValue(manual.protein) ||
    hasManualValue(manual.proteinG) ||
    hasManualValue(manual.fat) ||
    hasManualValue(manual.fatG) ||
    hasManualValue(manual.carbohydrates) ||
    hasManualValue(manual.carbohydratesG) ||
    hasManualValue(manual.salt) ||
    hasManualValue(manual.saltEquivalentG) ||
    hasManualValue(manual.sugarsG) ||
    hasManualValue(manual.dietaryFiberG) ||
    hasManualValue(manual.sodiumMg) ||
    hasManualValue(manual.saturatedFatG);

  const autoPresent = auto != null && auto.matchedCount > 0;

  let calculationSource: NutritionCalculationSource = "unknown";
  if (manualPresent && autoPresent) calculationSource = "mixed";
  else if (manualPresent) calculationSource = "manual";
  else if (autoPresent) calculationSource = "automatic";

  const caloriesKcal = pickManualOrAuto(
    manual.caloriesKcal ?? manual.calories,
    auto?.caloriesKcal,
  );
  const proteinG = pickManualOrAuto(
    manual.proteinG ?? manual.protein,
    auto?.proteinG,
  );
  const fatG = pickManualOrAuto(manual.fatG ?? manual.fat, auto?.fatG);
  const carbohydratesG = pickManualOrAuto(
    manual.carbohydratesG ?? manual.carbohydrates,
    auto?.carbohydratesG,
  );
  const saltEquivalentG = pickManualOrAuto(
    manual.saltEquivalentG ?? manual.salt,
    auto?.saltEquivalentG,
  );
  const sugarsG = pickManualOrAuto(manual.sugarsG, auto?.sugarsG);
  const dietaryFiberG = pickManualOrAuto(
    manual.dietaryFiberG,
    auto?.dietaryFiberG,
  );
  const sodiumMg = pickManualOrAuto(manual.sodiumMg, auto?.sodiumMg);
  const saturatedFatG = pickManualOrAuto(manual.saturatedFatG, null);

  let nutritionStatus: MergedRecipeNutrition["nutritionStatus"] = "unavailable";
  if (calculationSource === "manual") nutritionStatus = "estimated";
  else if (auto?.nutritionStatus) nutritionStatus = auto.nutritionStatus;
  else if (manualPresent) nutritionStatus = "estimated";

  return {
    nutritionStatus,
    calculationSource,
    nutritionCoverage: auto?.nutritionCoverage ?? (manualPresent ? 100 : 0),
    caloriesKcal,
    carbohydratesG,
    sugarsG,
    dietaryFiberG,
    proteinG,
    fatG,
    saturatedFatG,
    sodiumMg,
    saltEquivalentG,
    calories: caloriesKcal,
    protein: proteinG,
    fat: fatG,
    carbohydrates: carbohydratesG,
    salt: saltEquivalentG,
    automatic: auto,
  };
}

/** RecipeInput に自動計算結果をマージして返す */
export function applyAutomaticNutritionToRecipeInput(
  input: RecipeInput,
  database: FoodDatabaseProvider = loadDefaultFoodDatabaseSync(),
): RecipeInput {
  const automatic = calculateNutritionFromIngredients(
    input.ingredients.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
    })),
    Math.max(1, input.servings),
    database,
  );
  const merged = mergeManualAndAutomaticNutrition({
    manual: input,
    automatic,
  });

  return {
    ...input,
    calories: merged.calories,
    protein: merged.protein,
    fat: merged.fat,
    carbohydrates: merged.carbohydrates,
    salt: merged.salt,
    nutritionStatus: merged.nutritionStatus,
    caloriesKcal: merged.caloriesKcal,
    carbohydratesG: merged.carbohydratesG,
    sugarsG: merged.sugarsG,
    dietaryFiberG: merged.dietaryFiberG,
    proteinG: merged.proteinG,
    fatG: merged.fatG,
    saturatedFatG: merged.saturatedFatG,
    sodiumMg: merged.sodiumMg,
    saltEquivalentG: merged.saltEquivalentG,
    nutritionCoverage: merged.nutritionCoverage,
    calculationSource: merged.calculationSource,
  };
}
