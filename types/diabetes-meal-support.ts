/**
 * 糖尿病配慮の食事支援設定。
 * 医療診断・治療ではなく、ユーザー入力の目標に基づく献立支援用。
 * 未設定の項目に医学的な既定値は適用しない。
 */

export type DiabetesMealSupportSettings = {
  /** 配慮モードの有効/無効 */
  diabetesMealSupportEnabled: boolean;
  /** 1食あたり糖質目標（下限 g）。未設定は null */
  targetCarbsPerMealMin: number | null;
  /** 1食あたり糖質目標（上限 g）。未設定は null */
  targetCarbsPerMealMax: number | null;
  /** 1日あたり糖質目標（g）。未設定は null */
  targetCarbsPerDay: number | null;
  /** 食物繊維を優先する */
  prioritizeFiber: boolean;
  /** 非でんぷん野菜を優先する */
  prioritizeNonStarchyVegetables: boolean;
  /** 塩分を抑えめに評価する（固定の医学的閾値は使わない） */
  limitSodium: boolean;
  /** 飽和脂肪を抑えめに評価する（固定の医学的閾値は使わない） */
  limitSaturatedFat: boolean;
  /** 希望する主食量（g）。未設定は null。自動変更には使わず提案の参考 */
  preferredStaplePortionGrams: number | null;
  updatedAt: string;
};

export const DEFAULT_DIABETES_MEAL_SUPPORT_SETTINGS: Omit<
  DiabetesMealSupportSettings,
  "updatedAt"
> = {
  diabetesMealSupportEnabled: false,
  targetCarbsPerMealMin: null,
  targetCarbsPerMealMax: null,
  targetCarbsPerDay: null,
  prioritizeFiber: false,
  prioritizeNonStarchyVegetables: false,
  limitSodium: false,
  limitSaturatedFat: false,
  preferredStaplePortionGrams: null,
};

/** レシピ栄養の根拠ステータス */
export type NutritionStatus = "calculated" | "estimated" | "unavailable";

export function isNutritionStatus(value: unknown): value is NutritionStatus {
  return (
    value === "calculated" || value === "estimated" || value === "unavailable"
  );
}

/** 糖質の目標照合結果（血糖値の予測ではない） */
export type CarbTargetStatus =
  | "in_range"
  | "over"
  | "under"
  | "unknown"
  | "no_target";

export type MealNutritionTotals = {
  caloriesKcal: number | null;
  carbohydratesG: number | null;
  sugarsG: number | null;
  dietaryFiberG: number | null;
  proteinG: number | null;
  fatG: number | null;
  saturatedFatG: number | null;
  sodiumMg: number | null;
  saltEquivalentG: number | null;
  /** 0〜100。不足がある場合は完全値として扱わない */
  nutritionCoverage: number;
  recipeCount: number;
  recipesWithNutrition: number;
};

export type DailyNutritionTotals = MealNutritionTotals & {
  date: string;
  carbStatus: CarbTargetStatus;
};

export type WeeklyNutritionTotals = MealNutritionTotals & {
  weekStart: string;
  daily: DailyNutritionTotals[];
};

export type DiabetesImprovementSuggestion = {
  id: string;
  date: string;
  title: string;
  detail: string;
  /** 提案のみ。自動適用しない */
  autoApply: false;
};

export type MealCarbCheck = {
  date: string;
  carbohydratesG: number | null;
  status: CarbTargetStatus;
  hasVegetables: boolean;
  dietaryFiberG: number | null;
  nutritionCoverage: number;
};

export type DiabetesMealSupportReport = {
  enabled: boolean;
  disclaimer: string;
  carbDisclaimer: string;
  mealChecks: MealCarbCheck[];
  dailyTotals: DailyNutritionTotals[];
  weeklyTotals: WeeklyNutritionTotals;
  suggestions: DiabetesImprovementSuggestion[];
};
