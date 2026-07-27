import type { IngredientPriceRecord } from "@/types/ingredient-price";

/** テスト用価格レコード（不足フィールドを補完） */
export function makePriceRecord(
  partial: Partial<IngredientPriceRecord> &
    Pick<
      IngredientPriceRecord,
      "id" | "ingredientName" | "purchasePriceYen" | "purchasedAt"
    >,
): IngredientPriceRecord {
  const now = new Date().toISOString();
  const name = partial.ingredientName;
  return {
    normalizedIngredientName: partial.normalizedIngredientName ?? name,
    foodCode: null,
    storeId: null,
    storeBrandName: null,
    storeBranchName: null,
    storeName: "ロピア",
    originalPriceYen: null,
    packageQuantity: 1,
    packageCount: 1,
    packageUnit: "kg",
    gramsEquivalent: 1000,
    unitCountEquivalent: null,
    pricePer100g: null,
    pricePerUnit: null,
    isSalePrice: false,
    memo: "",
    source: "receipt",
    receiptId: null,
    rawProductName: null,
    discountYen: null,
    confidence: 0.9,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}
