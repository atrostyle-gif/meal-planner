/**
 * 食品データベースの型。
 * 将来の「日本食品標準成分表（八訂）」差し替えに備え、
 * JSON 固有の実装に依存しない。
 */

export type FoodNutrientPer100g = {
  /** エネルギー kcal */
  energy: number | null;
  protein: number | null;
  fat: number | null;
  carbohydrate: number | null;
  dietaryFiber: number | null;
  sugars: number | null;
  /** ナトリウム mg */
  sodium: number | null;
  /** 食塩相当量 g */
  saltEquivalent: number | null;
};

export type FoodRecord = {
  foodCode: string;
  name: string;
  aliases: string[];
  category: string;
  per100g: FoodNutrientPer100g;
  /** 1個・1本などへの換算（未設定は null） */
  gramsPerUnit?: number | null;
  gramsPerTablespoon?: number | null;
  gramsPerTeaspoon?: number | null;
  /** データ出典（差し替え時の識別） */
  source?: string;
  sourceVersion?: string;
};

export type FoodMatchConfidence = "exact" | "alias" | "fuzzy" | "none";

export type FoodSearchResult = {
  food: FoodRecord | null;
  confidence: FoodMatchConfidence;
  matchedAlias: string | null;
};

/**
 * 食品DBプロバイダ。
 * JsonFoodDatabase / 将来の八訂アダプタなど差し替え可能。
 */
export type FoodDatabaseProvider = {
  readonly sourceId: string;
  readonly sourceVersion: string;
  list(): FoodRecord[];
  findByCode(foodCode: string): FoodRecord | null;
  searchByName(name: string): FoodSearchResult;
};
