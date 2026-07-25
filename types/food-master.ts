/**
 * 食材マスター・栄養素・計算結果の型
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

export type FoodIngredientMaster = {
  id: string;
  canonicalName: string;
  aliases: string[];
  category: FoodCategory;
  edibleUnit: string;
  gramsPerUnit: number | null;
  /** 大さじ1あたりのg（材料別） */
  gramsPerTablespoon?: number | null;
  /** 小さじ1あたりのg */
  gramsPerTeaspoon?: number | null;
  nutritionPer100g: NutritionPer100g;
  pantryType?: string | null;
  source?: string | null;
  sourceVersion?: string | null;
  createdAt: string;
  updatedAt: string;
};

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
