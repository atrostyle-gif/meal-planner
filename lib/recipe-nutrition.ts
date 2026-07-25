import { migrateExtendedNutritionFields } from "@/lib/diabetes-meal-support/recipe-nutrition";
import {
  clampDifficulty,
  clampScore0to5,
  isProteinType,
  isRecipeSeason,
  normalizeNullableNumber,
  type ProteinType,
  type RecipeSeason,
} from "@/types/recipe-nutrition";
import type { Recipe, RecipeCategory } from "@/types/recipe";

type NutritionFields = Pick<
  Recipe,
  | "calories"
  | "protein"
  | "fat"
  | "carbohydrates"
  | "salt"
  | "vegetables"
  | "proteinType"
  | "season"
  | "difficulty"
  | "favoriteScore"
  | "healthyScore"
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
  | "nutritionCoverage"
  | "calculationSource"
>;

/** タグ・名前・カテゴリからたんぱく源を推定 */
export function inferProteinType(
  name: string,
  tags: string[],
  category: RecipeCategory,
): ProteinType | null {
  const blob = `${name} ${tags.join(" ")} ${category}`;
  if (/牛|ビーフ|ステーキ/.test(blob)) {
    return "牛";
  }
  if (/豚|ポーク|生姜焼き|トンカツ|とんかつ/.test(blob)) {
    return "豚";
  }
  if (/鶏|チキン|親子|唐揚/.test(blob)) {
    return "鶏";
  }
  if (/魚|鮭|サバ|さば|ブリ|あじ|アジ|いわし|イワシ|まぐろ|マグロ|刺身|魚料理/.test(blob)) {
    return "魚";
  }
  if (/卵|玉子|たまご|オムレツ|親子/.test(blob)) {
    return "卵";
  }
  if (/豆腐|納豆|豆乳|大豆|厚揚げ|がんも/.test(blob)) {
    return "大豆";
  }
  return null;
}

/** タグから季節を推定 */
export function inferSeason(tags: string[], name: string): RecipeSeason | null {
  const blob = `${name} ${tags.join(" ")}`;
  if (/春/.test(blob)) {
    return "春";
  }
  if (/夏|冷やし|そうめん/.test(blob)) {
    return "夏";
  }
  if (/秋/.test(blob)) {
    return "秋";
  }
  if (/冬|鍋|おでん|シチュー/.test(blob)) {
    return "冬";
  }
  if (/通年/.test(blob)) {
    return "通年";
  }
  return null;
}

/** 揚げ物っぽいか */
export function isFriedDish(recipe: Pick<Recipe, "name" | "tags" | "category">): boolean {
  const blob = `${recipe.name} ${recipe.tags.join(" ")}`;
  return /揚げ|唐揚|フライ|天ぷら|とんかつ|トンカツ|カツ|コロッケ|竜田/.test(blob);
}

/** 麺類か */
export function isNoodleDish(recipe: Pick<Recipe, "name" | "tags" | "category">): boolean {
  if (recipe.category === "麺類") {
    return true;
  }
  const blob = `${recipe.name} ${recipe.tags.join(" ")}`;
  return /麺|うどん|そば|ラーメン|パスタ|焼きそば|そうめん|スパゲティ/.test(blob);
}

/** カレー・シチューか */
export function isCurryOrStew(recipe: Pick<Recipe, "name" | "tags" | "category">): boolean {
  if (recipe.category === "カレー") {
    return true;
  }
  const blob = `${recipe.name} ${recipe.tags.join(" ")}`;
  return /カレー|シチュー|ハッシュド/.test(blob);
}

/** 丼か */
export function isDonburiDish(recipe: Pick<Recipe, "name" | "tags" | "category">): boolean {
  if (recipe.category === "丼物") {
    return true;
  }
  return /丼/.test(recipe.name);
}

/**
 * 保存済み値を優先し、不足分は推定で補完する。
 * 既存データを壊さない（明示値は上書きしない）。
 */
export function resolveNutritionFields(
  raw: Record<string, unknown>,
  context: {
    name: string;
    tags: string[];
    category: RecipeCategory;
  },
): NutritionFields {
  const storedProtein = isProteinType(raw.proteinType) ? raw.proteinType : null;
  const storedSeason = isRecipeSeason(raw.season) ? raw.season : null;
  const extended = migrateExtendedNutritionFields(raw);
  const coverage =
    typeof raw.nutritionCoverage === "number" &&
    Number.isFinite(raw.nutritionCoverage)
      ? Math.max(0, Math.min(100, Math.round(raw.nutritionCoverage)))
      : null;
  const calculationSource =
    raw.calculationSource === "manual" ||
    raw.calculationSource === "automatic" ||
    raw.calculationSource === "mixed" ||
    raw.calculationSource === "unknown"
      ? raw.calculationSource
      : null;

  return {
    calories: normalizeNullableNumber(raw.calories),
    protein: normalizeNullableNumber(raw.protein),
    fat: normalizeNullableNumber(raw.fat),
    carbohydrates: normalizeNullableNumber(raw.carbohydrates),
    salt: normalizeNullableNumber(raw.salt),
    vegetables: normalizeNullableNumber(raw.vegetables),
    proteinType:
      storedProtein ??
      inferProteinType(context.name, context.tags, context.category),
    season: storedSeason ?? inferSeason(context.tags, context.name),
    difficulty: clampDifficulty(raw.difficulty),
    favoriteScore: clampScore0to5(raw.favoriteScore),
    healthyScore: clampScore0to5(raw.healthyScore),
    ...extended,
    nutritionCoverage: coverage,
    calculationSource,
  };
}

/** 日付から現在の季節を返す */
export function getSeasonForDate(date: Date): RecipeSeason {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) {
    return "春";
  }
  if (month >= 6 && month <= 8) {
    return "夏";
  }
  if (month >= 9 && month <= 11) {
    return "秋";
  }
  return "冬";
}

/** おすすめ度スコアを ★1〜5 に変換 */
export function scoreToStars(score: number): number {
  if (score >= 90) {
    return 5;
  }
  if (score >= 65) {
    return 4;
  }
  if (score >= 40) {
    return 3;
  }
  if (score >= 20) {
    return 2;
  }
  return 1;
}

export function formatStars(stars: number): string {
  const clamped = Math.min(5, Math.max(1, Math.round(stars)));
  return "★".repeat(clamped) + "☆".repeat(5 - clamped);
}
