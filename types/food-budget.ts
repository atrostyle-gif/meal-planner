import {
  DEFAULT_STORE_PROFILES,
  LOPIA_STORE_PROFILE,
  type StoreProfile,
} from "@/types/store-profile";

/** 予算の評価対象 */
export const BUDGET_MODES = [
  "purchase_cost",
  "consumed_cost",
  "both",
] as const;

export type BudgetMode = (typeof BUDGET_MODES)[number];

export const BUDGET_MODE_LABELS: Record<BudgetMode, string> = {
  purchase_cost: "購入額で見る",
  consumed_cost: "使用原価で見る",
  both: "両方見る",
};

/** 自動編成の評価重み（固定優先ではなく調整可能） */
export type MealPlanScoreWeights = {
  time: number;
  variety: number;
  fridge: number;
  health: number;
  budget: number;
  bulkUsage: number;
  perishable: number;
};

export const DEFAULT_MEAL_PLAN_SCORE_WEIGHTS: MealPlanScoreWeights = {
  time: 1,
  variety: 1,
  fridge: 1,
  health: 1,
  budget: 1,
  bulkUsage: 1,
  perishable: 1,
};

/** 週ごとの予算上書き（端末ローカル） */
export type WeekBudgetOverride = {
  weeklyFoodBudgetYen: number | null;
  budgetMode?: BudgetMode | null;
};

/** 家庭の食費・買い物先設定（ローカル） */
export type FoodBudgetSettings = {
  primaryStoreName: string;
  defaultStoreProfileId: string;
  storeProfiles: StoreProfile[];
  /** 世帯デフォルトの週間食費予算（円）※献立向け */
  weeklyFoodBudgetYen: number | null;
  /** 月間食費予算（円）※家計簿向け */
  monthlyFoodBudgetYen: number | null;
  /** 月の開始日（1〜28） */
  monthlyBudgetStartDay: number;
  includePreparedFood: boolean;
  includeEatingOut: boolean;
  includeHouseholdGoods: boolean;
  budgetMode: BudgetMode;
  scoreWeights: MealPlanScoreWeights;
  /** weekStart → 週次上書き */
  weekBudgetOverrides: Record<string, WeekBudgetOverride>;
  updatedAt: string;
};

export const DEFAULT_FOOD_BUDGET_SETTINGS: FoodBudgetSettings = {
  primaryStoreName: LOPIA_STORE_PROFILE.name,
  defaultStoreProfileId: LOPIA_STORE_PROFILE.id,
  storeProfiles: DEFAULT_STORE_PROFILES,
  weeklyFoodBudgetYen: 7000,
  monthlyFoodBudgetYen: 40000,
  monthlyBudgetStartDay: 1,
  includePreparedFood: true,
  includeEatingOut: false,
  includeHouseholdGoods: false,
  budgetMode: "both",
  scoreWeights: DEFAULT_MEAL_PLAN_SCORE_WEIGHTS,
  weekBudgetOverrides: {},
  updatedAt: "",
};

export function isBudgetMode(value: unknown): value is BudgetMode {
  return (
    typeof value === "string" &&
    (BUDGET_MODES as readonly string[]).includes(value)
  );
}

/** 食材1件の購入・使用・繰越見積 */
export type IngredientCostLine = {
  ingredientName: string;
  normalizedIngredientName: string;
  /** 献立で使う量（表示用） */
  consumedQuantity: number | null;
  consumedUnit: string;
  consumedGrams: number | null;
  /** 既存在庫差し引き後の購入量 */
  purchaseQuantity: number | null;
  purchaseUnit: string;
  purchaseGrams: number | null;
  /** 繰越量 */
  carryoverQuantity: number | null;
  carryoverUnit: string;
  carryoverGrams: number | null;
  estimatedPurchaseCostYen: number | null;
  estimatedConsumedCostYen: number | null;
  estimatedCarryoverValueYen: number | null;
  pricePer100g: number | null;
  priceStoreName: string | null;
  pricePurchasedAt: string | null;
  priceMissing: boolean;
  isPantry: boolean;
  /** 新規購入不要（在庫・常備で足りる） */
  purchaseSkipped: boolean;
  freezeCarryover: boolean;
};

/** 大容量パックの配分提案 */
export type BulkPackAllocationDay = {
  date: string;
  recipeName: string;
  quantityGrams: number;
  quantityLabel: string;
};

export type BulkPackSuggestion = {
  ingredientName: string;
  packLabel: string;
  packGrams: number;
  usedGrams: number;
  leftoverGrams: number;
  freezeLeftover: boolean;
  summary: string;
  leftoverSummary: string;
  days: BulkPackAllocationDay[];
};

/** 週次予算サマリー */
export type WeekBudgetSummary = {
  weeklyFoodBudgetYen: number | null;
  budgetMode: BudgetMode;
  estimatedPurchaseCostYen: number | null;
  estimatedConsumedCostYen: number | null;
  estimatedCarryoverValueYen: number | null;
  remainingBudgetYen: number | null;
  pricedLineCount: number;
  unpricedLineCount: number;
  lines: IngredientCostLine[];
  bulkSuggestions: BulkPackSuggestion[];
};
