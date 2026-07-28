/**
 * 食材マスター（Food Master）・栄養素・計算結果の型。
 * 価格・栄養・旬・レシート・献立・買い物・在庫の共通辞書。
 */

export const FOOD_CATEGORIES = [
  "穀類",
  "肉類",
  "魚介類",
  "卵",
  "乳製品",
  "豆類",
  "野菜",
  "果物",
  "きのこ",
  "海藻",
  "調味料",
  "油脂",
  "加工食品",
  "その他",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const FOOD_STORAGE_TYPES = [
  "refrigerated",
  "frozen",
  "room_temperature",
] as const;

export type FoodStorageType = (typeof FOOD_STORAGE_TYPES)[number];

export const FOOD_STORAGE_TYPE_LABELS: Record<FoodStorageType, string> = {
  refrigerated: "冷蔵",
  frozen: "冷凍",
  room_temperature: "常温",
};

export const FOOD_FREEZABLE_LEVELS = [
  "possible",
  "recommended",
  "not_recommended",
] as const;

export type FoodFreezableLevel = (typeof FOOD_FREEZABLE_LEVELS)[number];

export const FOOD_FREEZABLE_LABELS: Record<FoodFreezableLevel, string> = {
  possible: "可能",
  recommended: "おすすめ",
  not_recommended: "不可",
};

export const GLYCEMIC_CATEGORIES = ["low", "medium", "high", "unknown"] as const;
export type GlycemicCategory = (typeof GLYCEMIC_CATEGORIES)[number];

/** 栄養参照（JSON食品DB等）。埋込値と併用可 */
export type NutritionReference = {
  provider: "embedded" | "foods_json" | "external";
  /** foods.json の foodCode など */
  foodCode: string | null;
  note?: string | null;
};

/** 100gあたりの栄養素 */
export type NutritionPer100g = {
  calories: number;
  protein: number;
  fat: number;
  carbohydrates: number;
  fiber: number;
  saltEquivalent: number;
  calcium: number;
  iron: number;
  vitaminA?: number | null;
  vitaminB1?: number | null;
  vitaminB2?: number | null;
  vitaminC?: number | null;
};

/** 栄養素の合算値（絶対量） */
export type NutritionAmount = {
  calories: number;
  protein: number;
  fat: number;
  carbohydrates: number;
  fiber: number;
  saltEquivalent: number;
  calcium: number;
  iron: number;
  vitaminA: number;
  vitaminB1: number;
  vitaminB2: number;
  vitaminC: number;
  /** 野菜量の概算 g（野菜・きのこ・海藻カテゴリ） */
  vegetables: number;
};

/**
 * 家庭内で使う標準食材（Food Master）。
 * foodCode は id と同義（レシート・価格の foodCode と接続）。
 */
export type FoodIngredientMaster = {
  id: string;
  /** id と同値。価格・レシート連携用 */
  foodCode: string;
  canonicalName: string;
  aliases: string[];
  category: FoodCategory;
  subcategory: string | null;
  /** 既定単位（edibleUnit と同義） */
  defaultUnit: string;
  /** 互換: defaultUnit */
  edibleUnit: string;
  gramsPerUnit: number | null;
  gramsPerTablespoon?: number | null;
  gramsPerTeaspoon?: number | null;
  /** g/ml 目安。不明は null（推測確定しない） */
  density: number | null;
  nutritionPer100g: NutritionPer100g;
  nutritionReference: NutritionReference | null;
  /** 旬の月 1〜12。空なら通年扱い */
  seasonMonths: number[];
  storageType: FoodStorageType | null;
  freezable: FoodFreezableLevel | null;
  /** 購入後の目安日数。不明は null */
  recommendedShelfLifeDays: number | null;
  glycemicCategory: GlycemicCategory;
  diabetesFriendly: boolean | null;
  commonPackageSizes: string[];
  commonStores: string[];
  typicalCookingMethods: string[];
  /** 代替食材の foodCode / id */
  substituteFoods: string[];
  /** 互換: 旧 pantryType */
  pantryType?: string | null;
  source?: string | null;
  sourceVersion?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 仕様名 FoodMaster（実体は FoodIngredientMaster） */
export type FoodMaster = FoodIngredientMaster;

/** 家庭固有の別名→マスター紐付け */
export type FoodAliasMapping = {
  id: string;
  householdId: string;
  aliasName: string;
  masterId: string;
  excludeFromNutrition?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NutritionValueSource =
  | "ingredient_calculated"
  | "manual"
  | "estimated"
  | "uncalculated";

export type NutritionCalculationResult = {
  total: NutritionAmount;
  perServing: NutritionAmount;
  calculatedIngredientCount: number;
  uncalculatedIngredientCount: number;
  uncalculatedIngredients: string[];
  confidence: number;
  source: NutritionValueSource;
  calculatedAt: string;
};

export type RecipeNutritionSummary = NutritionCalculationResult;

export function emptyNutritionAmount(): NutritionAmount {
  return {
    calories: 0,
    protein: 0,
    fat: 0,
    carbohydrates: 0,
    fiber: 0,
    saltEquivalent: 0,
    calcium: 0,
    iron: 0,
    vitaminA: 0,
    vitaminB1: 0,
    vitaminB2: 0,
    vitaminC: 0,
    vegetables: 0,
  };
}

export function addNutritionAmount(
  left: NutritionAmount,
  right: NutritionAmount,
): NutritionAmount {
  return {
    calories: left.calories + right.calories,
    protein: left.protein + right.protein,
    fat: left.fat + right.fat,
    carbohydrates: left.carbohydrates + right.carbohydrates,
    fiber: left.fiber + right.fiber,
    saltEquivalent: left.saltEquivalent + right.saltEquivalent,
    calcium: left.calcium + right.calcium,
    iron: left.iron + right.iron,
    vitaminA: left.vitaminA + right.vitaminA,
    vitaminB1: left.vitaminB1 + right.vitaminB1,
    vitaminB2: left.vitaminB2 + right.vitaminB2,
    vitaminC: left.vitaminC + right.vitaminC,
    vegetables: left.vegetables + right.vegetables,
  };
}

export function scaleNutritionAmount(
  amount: NutritionAmount,
  factor: number,
): NutritionAmount {
  return {
    calories: amount.calories * factor,
    protein: amount.protein * factor,
    fat: amount.fat * factor,
    carbohydrates: amount.carbohydrates * factor,
    fiber: amount.fiber * factor,
    saltEquivalent: amount.saltEquivalent * factor,
    calcium: amount.calcium * factor,
    iron: amount.iron * factor,
    vitaminA: amount.vitaminA * factor,
    vitaminB1: amount.vitaminB1 * factor,
    vitaminB2: amount.vitaminB2 * factor,
    vitaminC: amount.vitaminC * factor,
    vegetables: amount.vegetables * factor,
  };
}

export function isFoodStorageType(value: unknown): value is FoodStorageType {
  return (
    typeof value === "string" &&
    (FOOD_STORAGE_TYPES as readonly string[]).includes(value)
  );
}

export function isFoodFreezableLevel(
  value: unknown,
): value is FoodFreezableLevel {
  return (
    typeof value === "string" &&
    (FOOD_FREEZABLE_LEVELS as readonly string[]).includes(value)
  );
}

export function isGlycemicCategory(value: unknown): value is GlycemicCategory {
  return (
    typeof value === "string" &&
    (GLYCEMIC_CATEGORIES as readonly string[]).includes(value)
  );
}
