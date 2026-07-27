/** 価格の登録元 */
export type PriceSource = "manual" | "receipt";

/** 食材の購入価格記録（ユーザー入力・レシート・ローカル履歴） */
export type IngredientPriceRecord = {
  id: string;
  ingredientName: string;
  normalizedIngredientName: string;
  /** 食品マスタID（任意） */
  foodCode?: string | null;
  storeId: string | null;
  storeBrandName?: string | null;
  storeBranchName?: string | null;
  storeName: string;
  /** 支払った金額（円） */
  purchasePriceYen: number;
  /** 値引前（分かる場合） */
  originalPriceYen?: number | null;
  /** パックの数量（例: 1） */
  packageQuantity: number;
  packageCount?: number | null;
  /** パックの単位（例: kg, g, 個） */
  packageUnit: string;
  /** g 換算（可能な場合）。不明なら null */
  gramsEquivalent: number | null;
  /** 個数換算（卵など）。不明なら null */
  unitCountEquivalent?: number | null;
  /** 100g あたり円。算出できない場合 null */
  pricePer100g: number | null;
  /** 1個あたり円 */
  pricePerUnit?: number | null;
  purchasedAt: string;
  isSalePrice: boolean;
  memo: string;
  source: PriceSource;
  receiptId: string | null;
  rawProductName: string | null;
  discountYen: number | null;
  confidence: number | null;
  createdAt?: string;
  updatedAt?: string;
};

/** 価格登録フォーム入力 */
export type IngredientPriceInput = {
  ingredientName: string;
  storeName: string;
  storeId?: string | null;
  storeBrandName?: string | null;
  storeBranchName?: string | null;
  foodCode?: string | null;
  purchasePriceYen: number;
  originalPriceYen?: number | null;
  packageQuantity: number;
  packageCount?: number | null;
  packageUnit: string;
  gramsEquivalent?: number | null;
  unitCountEquivalent?: number | null;
  purchasedAt?: string;
  isSalePrice?: boolean;
  memo?: string;
  source?: PriceSource;
  receiptId?: string | null;
  rawProductName?: string | null;
  discountYen?: number | null;
  confidence?: number | null;
};

/** 概算価格の根拠 */
export type PriceEstimateSource = "recent" | "median" | "none";

export type IngredientPriceEstimate = {
  ingredientName: string;
  normalizedIngredientName: string;
  /** 概算できない場合は null（0円扱いしない） */
  estimatedPurchasePriceYen: number | null;
  pricePer100g: number | null;
  packageQuantity: number | null;
  packageUnit: string | null;
  gramsEquivalent: number | null;
  source: PriceEstimateSource;
  storeName: string | null;
  storeId: string | null;
  purchasedAt: string | null;
  sampleCount: number;
  sparseData: boolean;
};

export type PriceTrend =
  | "rising"
  | "stable"
  | "falling"
  | "insufficient_data";

export type PriceAssessment =
  | "very_cheap"
  | "cheap"
  | "normal"
  | "expensive"
  | "very_expensive"
  | "insufficient_data";

export type PriceDataQuality =
  | "none"
  | "reference_only"
  | "provisional"
  | "sufficient";

export type PricePeriodStats = {
  median: number | null;
  lowest: number | null;
  highest: number | null;
  sampleCount: number;
};

/** 食材×店舗の価格分析 */
export type IngredientPriceAnalysis = {
  ingredientName: string;
  normalizedIngredientName: string;
  latestPricePer100g: number | null;
  medianPrice30Days: number | null;
  medianPrice90Days: number | null;
  lowestPrice90Days: number | null;
  highestPrice90Days: number | null;
  medianPrice365Days: number | null;
  overallMedianPer100g: number | null;
  storeSpecificMedian: number | null;
  priceTrend: PriceTrend;
  sampleCount: number;
  sparseData: boolean;
  dataQuality: PriceDataQuality;
  /** 普段より安い/高い（%）。データ不足時 null */
  vsMedianPercent: number | null;
  priceAssessment: PriceAssessment;
  priceIndex: number | null;
  byStore: StorePriceSlice[];
  lowestAcrossStores90Days: {
    storeName: string;
    pricePer100g: number;
  } | null;
  primaryStoreMedianPer100g: number | null;
  seasonalMedianPer100g: number | null;
  seasonalAssessment: PriceAssessment | null;
  periods: {
    days30: PricePeriodStats;
    days90: PricePeriodStats;
    days365: PricePeriodStats;
    all: PricePeriodStats;
  };
};

export type StorePriceSlice = {
  storeId: string | null;
  storeName: string;
  latestPricePer100g: number | null;
  medianPrice30Days: number | null;
  medianPrice90Days: number | null;
  sampleCount: number;
  sparseData: boolean;
  priceAssessment: PriceAssessment;
};

export type StorePriceAnalysis = {
  storeId: string | null;
  storeName: string;
  sampleCount: number;
  ingredientCount: number;
  ingredients: IngredientPriceAnalysis[];
};

export type BuyScoreResult = {
  ingredientName: string;
  /** 0〜100 */
  score: number;
  /** 0〜5 */
  stars: number;
  reasons: string[];
  analysis: IngredientPriceAnalysis;
  shouldBuyHint: "buy" | "maybe" | "skip" | "unknown";
};
