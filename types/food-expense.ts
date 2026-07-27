/** 食費カテゴリ（家計簿用） */
export const FOOD_EXPENSE_CATEGORIES = [
  "meat",
  "seafood",
  "vegetables",
  "fruits",
  "dairy_eggs",
  "grains_noodles",
  "prepared_food",
  "seasonings",
  "beverages",
  "snacks",
  "frozen_food",
  "household_mixed",
  "other",
  "unclassified",
] as const;

export type FoodExpenseCategory = (typeof FOOD_EXPENSE_CATEGORIES)[number];

export const FOOD_EXPENSE_CATEGORY_LABELS: Record<FoodExpenseCategory, string> = {
  meat: "肉",
  seafood: "魚介",
  vegetables: "野菜",
  fruits: "果物",
  dairy_eggs: "乳製品・卵",
  grains_noodles: "穀物・麺",
  prepared_food: "惣菜・加工",
  seasonings: "調味料",
  beverages: "飲料",
  snacks: "お菓子",
  frozen_food: "冷凍食品",
  household_mixed: "日用品混在",
  other: "その他食費",
  unclassified: "未分類",
};

export const PAYMENT_METHODS = [
  "cash",
  "credit_card",
  "electronic_money",
  "qr",
  "other",
  "unknown",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "現金",
  credit_card: "クレジットカード",
  electronic_money: "電子マネー",
  qr: "QR決済",
  other: "その他",
  unknown: "不明",
};

/** 明細の充実度 */
export const DETAIL_COMPLETENESS = [
  "amount_only",
  "partial_items",
  "full_items",
] as const;

export type DetailCompleteness = (typeof DETAIL_COMPLETENESS)[number];

export type FoodExpenseCategoryAmount = {
  category: FoodExpenseCategory;
  amountYen: number;
  /** 食費から除外（日用品など） */
  excluded: boolean;
};

/** 食費取引（家計簿の実支払） */
export type FoodExpenseTransaction = {
  id: string;
  householdId: string;
  receiptId: string | null;
  storeId: string | null;
  storeName: string;
  purchasedAt: string;
  subtotalYen: number | null;
  discountYen: number | null;
  taxYen: number | null;
  /** 実際の支払額（家計簿本体） */
  totalAmountYen: number;
  paymentMethod: PaymentMethod;
  categoryBreakdown: FoodExpenseCategoryAmount[];
  source: "receipt" | "manual";
  detailCompleteness: DetailCompleteness;
  memo: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FoodExpenseLineInput = {
  name: string;
  amountYen: number;
  quantity?: number | null;
  unit?: string | null;
  ingredientName?: string | null;
  category?: FoodExpenseCategory;
  foodExpenseExcluded?: boolean;
  /** 価格履歴へ登録するか */
  registerPrice?: boolean;
  /** 在庫へ追加するか（既定OFF） */
  addToInventory?: boolean;
};

export function isFoodExpenseCategory(
  value: unknown,
): value is FoodExpenseCategory {
  return (
    typeof value === "string" &&
    (FOOD_EXPENSE_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    typeof value === "string" &&
    (PAYMENT_METHODS as readonly string[]).includes(value)
  );
}

export function isDetailCompleteness(
  value: unknown,
): value is DetailCompleteness {
  return (
    typeof value === "string" &&
    (DETAIL_COMPLETENESS as readonly string[]).includes(value)
  );
}
