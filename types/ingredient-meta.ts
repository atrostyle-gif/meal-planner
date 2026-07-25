/** 食材の在庫区分 */
export const INGREDIENT_TYPES = [
  "normal",
  "pantrySeasoning",
  "pantryFood",
  "householdItem",
] as const;

export type IngredientType = (typeof INGREDIENT_TYPES)[number];

export const DEFAULT_INGREDIENT_TYPE: IngredientType = "normal";

export const INGREDIENT_TYPE_LABELS: Record<IngredientType, string> = {
  normal: "通常食材",
  pantrySeasoning: "常備調味料",
  pantryFood: "常備食品",
  householdItem: "日用品",
};

/** 常備品の在庫状態 */
export const STOCK_STATUSES = [
  "enough",
  "low",
  "empty",
  "unknown",
] as const;

export type StockStatus = (typeof STOCK_STATUSES)[number];

export const DEFAULT_STOCK_STATUS: StockStatus = "unknown";

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  enough: "十分",
  low: "少ない",
  empty: "なし",
  unknown: "未確認",
};

export function isIngredientType(value: unknown): value is IngredientType {
  return (
    typeof value === "string" &&
    (INGREDIENT_TYPES as readonly string[]).includes(value)
  );
}

export function isStockStatus(value: unknown): value is StockStatus {
  return (
    typeof value === "string" &&
    (STOCK_STATUSES as readonly string[]).includes(value)
  );
}

export function isPantryIngredientType(
  type: IngredientType,
): type is Extract<IngredientType, "pantrySeasoning" | "pantryFood"> {
  return type === "pantrySeasoning" || type === "pantryFood";
}
