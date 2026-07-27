/**
 * 互換レイヤ: 価格分析は lib/price-learning へ移管。
 */
export {
  analyzeIngredientPrice,
  analyzeIngredientPrices,
  computeNetPriceYen,
} from "@/lib/price-learning";

export type PriceLearningStats = {
  priceRecordCount: number;
  recognizedProductCount: number;
  registeredStoreCount: number;
  /** 確認不要だった商品数 / 全商品数（定義明確） */
  autoMatchRate: number | null;
  receiptsThisMonth: number;
};
