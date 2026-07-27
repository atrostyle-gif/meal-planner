/**
 * 価格評価・買い時スコアの閾値（設定ファイル分離）。
 * データ不足時は断定しない。
 */

export const PRICE_ASSESSMENT_THRESHOLDS = {
  /** 15%以上安い → very_cheap */
  veryCheapPercent: -15,
  /** 5〜15%安い → cheap */
  cheapPercent: -5,
  /** ±5% → normal */
  normalBandPercent: 5,
  /** 5〜15%高い → expensive */
  expensivePercent: 15,
  /** 15%以上高い → very_expensive（expensivePercent 超） */
} as const;

export const PRICE_TREND_THRESHOLDS = {
  /** 中央値比でこの差以上なら上昇/下降 */
  changeRatio: 0.03,
} as const;

export const PRICE_SAMPLE_THRESHOLDS = {
  /** 1件: 参考のみ */
  referenceOnlyMax: 1,
  /** 2〜3件: 仮評価 */
  provisionalMax: 3,
  /** これ以上で通常評価 */
  sufficientMin: 4,
} as const;

export const BUY_SCORE_WEIGHTS = {
  vsMedian: 35,
  vsLowest: 15,
  sampleConfidence: 15,
  mealPlanNeed: 20,
  inventoryPenalty: 25,
  perishableBonus: 5,
  bulkUsability: 10,
  plannedStoreBonus: 10,
} as const;

/** 店舗割当: 価格差がこの以内なら1店舗へまとめる（%） */
export const STORE_ASSIGN_THRESHOLDS = {
  smallPriceDiffPercent: 8,
} as const;

/** 重複判定: 商品一致率 */
export const DUPLICATE_THRESHOLDS = {
  probableItemOverlap: 0.7,
  probableTotalDiffYen: 50,
} as const;
