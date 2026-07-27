import {
  isNutritionStatus,
  type NutritionStatus,
} from "@/types/diabetes-meal-support";
import type { Recipe } from "@/types/recipe";
import { normalizeNullableNumber } from "@/types/recipe-nutrition";

/** 健康評価・集計で使う1レシピあたり栄養（すべて nullable） */
export type RecipeMealNutrition = {
  nutritionStatus: NutritionStatus;
  caloriesKcal: number | null;
  carbohydratesG: number | null;
  sugarsG: number | null;
  dietaryFiberG: number | null;
  proteinG: number | null;
  fatG: number | null;
  saturatedFatG: number | null;
  sodiumMg: number | null;
  saltEquivalentG: number | null;
};

const NUTRITION_VALUE_KEYS = [
  "caloriesKcal",
  "carbohydratesG",
  "sugarsG",
  "dietaryFiberG",
  "proteinG",
  "fatG",
  "saturatedFatG",
  "sodiumMg",
  "saltEquivalentG",
] as const;

function pickNumber(
  primary: unknown,
  fallback: unknown,
): number | null {
  const first = normalizeNullableNumber(primary);
  if (first !== null) return first;
  return normalizeNullableNumber(fallback);
}

/**
 * 新フィールドを優先し、旧フィールドへフォールバックする。
 * 根拠のない 0 埋めはしない。計算不能は null。
 */
export function resolveRecipeMealNutrition(
  recipe: Recipe,
): RecipeMealNutrition {
  const caloriesKcal = pickNumber(recipe.caloriesKcal, recipe.calories);
  const carbohydratesG = pickNumber(
    recipe.carbohydratesG,
    recipe.carbohydrates,
  );
  const proteinG = pickNumber(recipe.proteinG, recipe.protein);
  const fatG = pickNumber(recipe.fatG, recipe.fat);
  const saltEquivalentG = pickNumber(recipe.saltEquivalentG, recipe.salt);
  const sugarsG = normalizeNullableNumber(recipe.sugarsG);
  const dietaryFiberG = normalizeNullableNumber(recipe.dietaryFiberG);
  const saturatedFatG = normalizeNullableNumber(recipe.saturatedFatG);
  const sodiumMg = normalizeNullableNumber(recipe.sodiumMg);

  const values = {
    caloriesKcal,
    carbohydratesG,
    sugarsG,
    dietaryFiberG,
    proteinG,
    fatG,
    saturatedFatG,
    sodiumMg,
    saltEquivalentG,
  };

  const knownCount = NUTRITION_VALUE_KEYS.filter(
    (key) => values[key] !== null,
  ).length;

  let nutritionStatus: NutritionStatus =
    isNutritionStatus(recipe.nutritionStatus)
      ? recipe.nutritionStatus
      : knownCount === 0
        ? "unavailable"
        : "estimated";

  if (knownCount === 0) {
    nutritionStatus = "unavailable";
  }

  return {
    nutritionStatus,
    ...values,
  };
}

export function recipeHasUsableNutrition(recipe: Recipe): boolean {
  const n = resolveRecipeMealNutrition(recipe);
  return (
    n.nutritionStatus !== "unavailable" &&
    (n.caloriesKcal != null ||
      n.carbohydratesG != null ||
      n.proteinG != null ||
      n.fatG != null)
  );
}

/** 非でんぷん野菜っぽいか（ヒューリスティック。医学的判定ではない） */
export function hasNonStarchyVegetables(recipe: Recipe): boolean {
  if (recipe.vegetables != null && recipe.vegetables > 0) return true;
  if (recipe.course === "副菜") return true;
  const blob = `${recipe.name} ${recipe.tags.join(" ")} ${recipe.ingredients.map((i) => i.name).join(" ")}`;
  return /キャベツ|レタス|きゅうり|トマト|なす|茄子|ピーマン|ほうれん草|小松菜|白菜|もやし|ブロッコリー|アスパラ|おくら|にら|ネギ|玉ねぎ|きのこ|しめじ|えのき|サラダ|野菜/.test(
    blob,
  );
}

export function isStapleHeavyDish(recipe: Recipe): boolean {
  if (
    recipe.category === "麺類" ||
    recipe.category === "丼物" ||
    recipe.course === "主食"
  ) {
    return true;
  }
  const blob = `${recipe.name} ${recipe.tags.join(" ")}`;
  return /麺|うどん|そば|ラーメン|パスタ|丼|パン|トースト|サンドイッチ|カレーライス/.test(
    blob,
  );
}

export function isSweetDessertOrSugaryDrink(recipe: Recipe): boolean {
  if (recipe.course === "デザート" || recipe.category === "デザート") {
    return true;
  }
  if (recipe.course === "飲み物") {
    const blob = `${recipe.name} ${recipe.tags.join(" ")}`;
    return /ジュース|コーラ|サイダー|甘い|砂糖|ラテ|甘いお茶|砂糖入り/.test(blob);
  }
  const blob = `${recipe.name} ${recipe.tags.join(" ")}`;
  return /ケーキ|プリン|アイス|スイーツ|甘い|ドーナツ|パフェ/.test(blob);
}

/** raw オブジェクトから拡張栄養フィールドを読む（マイグレーション用） */
export function migrateExtendedNutritionFields(
  raw: Record<string, unknown>,
): Pick<
  Recipe,
  | "nutritionStatus"
  | "caloriesKcal"
  | "carbohydratesG"
  | "sugarsG"
  | "dietaryFiberG"
  | "proteinG"
  | "fatG"
  | "saturatedFatG"
  | "sodiumMg"
  | "saltEquivalentG"
> {
  const caloriesKcal = pickNumber(raw.caloriesKcal, raw.calories);
  const carbohydratesG = pickNumber(raw.carbohydratesG, raw.carbohydrates);
  const proteinG = pickNumber(raw.proteinG, raw.protein);
  const fatG = pickNumber(raw.fatG, raw.fat);
  const saltEquivalentG = pickNumber(raw.saltEquivalentG, raw.salt);

  const fields = {
    caloriesKcal,
    carbohydratesG,
    sugarsG: normalizeNullableNumber(raw.sugarsG),
    dietaryFiberG: normalizeNullableNumber(raw.dietaryFiberG),
    proteinG,
    fatG,
    saturatedFatG: normalizeNullableNumber(raw.saturatedFatG),
    sodiumMg: normalizeNullableNumber(raw.sodiumMg),
    saltEquivalentG,
  };

  const known = Object.values(fields).some((v) => v !== null);
  const status = isNutritionStatus(raw.nutritionStatus)
    ? raw.nutritionStatus
    : known
      ? "estimated"
      : "unavailable";

  return {
    nutritionStatus: status,
    ...fields,
  };
}

export function migrateCalculationMeta(
  raw: Record<string, unknown>,
): {
  nutritionCoverage: number | null;
  calculationSource: Recipe["calculationSource"];
} {
  const coverage =
    typeof raw.nutritionCoverage === "number" &&
    Number.isFinite(raw.nutritionCoverage)
      ? Math.max(0, Math.min(100, Math.round(raw.nutritionCoverage)))
      : null;
  const source =
    raw.calculationSource === "manual" ||
    raw.calculationSource === "automatic" ||
    raw.calculationSource === "mixed" ||
    raw.calculationSource === "unknown"
      ? raw.calculationSource
      : null;
  return { nutritionCoverage: coverage, calculationSource: source };
}
