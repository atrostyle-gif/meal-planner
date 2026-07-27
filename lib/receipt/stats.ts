import { loadIngredientPrices } from "@/lib/food-budget/prices";
import type { PriceLearningStats } from "@/lib/receipt/analytics";
import { getMappingRepository } from "@/lib/receipt/mapping-repository";
import { getReceiptRepository } from "@/lib/receipt/receipt-repository";
import { getStoreRepository } from "@/lib/stores/store-repository";

/**
 * 自動認識率 = 確認不要だった商品マッピング数 / 全マッピング数
 * （user_confirmed 以外で needsReview=false 相当: exact_history / food_alias / store_alias）
 */
export function getPriceLearningStats(): PriceLearningStats {
  const prices = loadIngredientPrices();
  const mappings = getMappingRepository().list();
  const receiptsThisMonth = getReceiptRepository().countThisMonth();
  const stores = getStoreRepository().list();

  const recognized = new Set(
    mappings
      .filter(
        (m) =>
          m.matchSource === "user_confirmed" ||
          m.confirmationCount > 0 ||
          m.matchSource === "exact_history" ||
          m.matchSource === "food_alias",
      )
      .map((m) => m.normalizedRawProductName),
  );

  const autoResolved = mappings.filter(
    (m) =>
      m.matchSource === "user_confirmed" ||
      m.matchSource === "exact_history" ||
      m.matchSource === "food_alias" ||
      m.matchSource === "store_alias",
  );
  const autoMatchRate =
    mappings.length === 0 ? null : autoResolved.length / mappings.length;

  return {
    priceRecordCount: prices.length,
    recognizedProductCount: recognized.size,
    registeredStoreCount: stores.length,
    autoMatchRate,
    receiptsThisMonth,
  };
}
