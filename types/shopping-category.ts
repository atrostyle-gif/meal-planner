/** 買い物リストの食材カテゴリ */
export const SHOPPING_CATEGORIES = [
  "野菜",
  "肉",
  "魚",
  "卵／乳製品",
  "調味料",
  "乾物",
  "その他",
] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export function isShoppingCategory(value: unknown): value is ShoppingCategory {
  return (
    typeof value === "string" &&
    (SHOPPING_CATEGORIES as readonly string[]).includes(value)
  );
}
