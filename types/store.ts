/** 店舗種別 */
export const STORE_TYPES = [
  "supermarket",
  "discount_store",
  "drugstore",
  "butcher",
  "greengrocer",
  "convenience_store",
  "online",
  "other",
] as const;

export type StoreType = (typeof STORE_TYPES)[number];

export const STORE_TYPE_LABELS: Record<StoreType, string> = {
  supermarket: "スーパー",
  discount_store: "ディスカウント",
  drugstore: "ドラッグストア",
  butcher: "精肉店",
  greengrocer: "青果店",
  convenience_store: "コンビニ",
  online: "ネット",
  other: "その他",
};

/** 買い物先（複数店舗対応） */
export type Store = {
  id: string;
  name: string;
  normalizedName: string;
  aliases: string[];
  storeType: StoreType;
  isPrimary: boolean;
  prefersBulkPurchase: boolean;
  defaultPackSizeMultiplier: number;
  storeBrandName: string | null;
  storeBranchName: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type StoreInput = {
  name: string;
  aliases?: string[];
  storeType?: StoreType;
  isPrimary?: boolean;
  prefersBulkPurchase?: boolean;
  defaultPackSizeMultiplier?: number;
  storeBrandName?: string | null;
  storeBranchName?: string | null;
  notes?: string;
};

/** 週ごとの買い物先予定 */
export type WeekStorePlan = {
  weekStart: string;
  plannedStoreIds: string[];
  primaryPlannedStoreId: string | null;
  allowMultiStoreShopping: boolean;
  maxStoreVisits: number;
};

export const DEFAULT_WEEK_STORE_PLAN: Omit<WeekStorePlan, "weekStart"> = {
  plannedStoreIds: [],
  primaryPlannedStoreId: null,
  allowMultiStoreShopping: false,
  maxStoreVisits: 1,
};

export function isStoreType(value: unknown): value is StoreType {
  return (
    typeof value === "string" &&
    (STORE_TYPES as readonly string[]).includes(value)
  );
}
