/** 店舗商品名 → 標準食材名の学習マッピング */
export const MATCH_SOURCES = [
  "user_confirmed",
  "exact_history",
  "store_alias",
  "food_alias",
  "normalized_match",
  "fuzzy",
  "ai",
  "unknown",
  /** 旧互換 */
  "alias",
] as const;

export type MatchSource = (typeof MATCH_SOURCES)[number];

export type StoreProductMapping = {
  id: string;
  storeId: string | null;
  storeName: string;
  rawProductName: string;
  normalizedRawProductName: string;
  normalizedIngredientName: string;
  foodCode: string | null;
  matchSource: MatchSource;
  confirmationCount: number;
  correctionCount: number;
  confidence: number;
  firstSeenAt: string;
  lastSeenAt: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export function isMatchSource(value: unknown): value is MatchSource {
  return (
    typeof value === "string" &&
    (MATCH_SOURCES as readonly string[]).includes(value)
  );
}

/** 旧 alias を新ソースへ正規化 */
export function normalizeMatchSource(source: MatchSource): MatchSource {
  if (source === "alias") return "store_alias";
  return source;
}
