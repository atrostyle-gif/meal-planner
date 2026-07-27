import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import { toGramsEquivalent } from "@/lib/food-budget/unit-convert";
import { calculateUnitPrice } from "@/lib/price-learning/unit-price";
import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import type {
  IngredientPriceEstimate,
  IngredientPriceInput,
  IngredientPriceRecord,
} from "@/types/ingredient-price";

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedRaw: string | null | undefined = undefined;
let cached: IngredientPriceRecord[] = [];

function migrateRecord(value: unknown): IngredientPriceRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.ingredientName !== "string" ||
    typeof item.purchasePriceYen !== "number" ||
    !Number.isFinite(item.purchasePriceYen)
  ) {
    return null;
  }
  const packageQuantity =
    typeof item.packageQuantity === "number" && Number.isFinite(item.packageQuantity)
      ? item.packageQuantity
      : 1;
  const packageUnit =
    typeof item.packageUnit === "string" ? item.packageUnit : "";
  const gramsEquivalent =
    typeof item.gramsEquivalent === "number" && Number.isFinite(item.gramsEquivalent)
      ? item.gramsEquivalent
      : toGramsEquivalent(packageQuantity, packageUnit);
  const unitCalc = calculateUnitPrice({
    purchasePriceYen: item.purchasePriceYen,
    discountYen: typeof item.discountYen === "number" ? item.discountYen : null,
    gramsEquivalent,
    packageQuantity,
    unitCountEquivalent:
      typeof item.unitCountEquivalent === "number"
        ? item.unitCountEquivalent
        : null,
  });
  const pricePer100g =
    typeof item.pricePer100g === "number" && Number.isFinite(item.pricePer100g)
      ? item.pricePer100g
      : unitCalc.pricePer100g;
  const now = new Date().toISOString();

  return {
    id: item.id,
    ingredientName: item.ingredientName,
    normalizedIngredientName:
      typeof item.normalizedIngredientName === "string"
        ? item.normalizedIngredientName
        : normalizeIngredientName(item.ingredientName),
    foodCode: typeof item.foodCode === "string" ? item.foodCode : null,
    storeId: typeof item.storeId === "string" ? item.storeId : null,
    storeBrandName:
      typeof item.storeBrandName === "string" ? item.storeBrandName : null,
    storeBranchName:
      typeof item.storeBranchName === "string" ? item.storeBranchName : null,
    storeName: typeof item.storeName === "string" ? item.storeName : "",
    purchasePriceYen: item.purchasePriceYen,
    originalPriceYen:
      typeof item.originalPriceYen === "number" ? item.originalPriceYen : null,
    packageQuantity,
    packageCount:
      typeof item.packageCount === "number" ? item.packageCount : null,
    packageUnit,
    gramsEquivalent,
    unitCountEquivalent:
      typeof item.unitCountEquivalent === "number"
        ? item.unitCountEquivalent
        : null,
    pricePer100g,
    pricePerUnit:
      typeof item.pricePerUnit === "number"
        ? item.pricePerUnit
        : unitCalc.pricePerUnit,
    purchasedAt:
      typeof item.purchasedAt === "string"
        ? item.purchasedAt
        : now,
    isSalePrice: item.isSalePrice === true,
    memo: typeof item.memo === "string" ? item.memo : "",
    source: item.source === "receipt" ? "receipt" : "manual",
    receiptId: typeof item.receiptId === "string" ? item.receiptId : null,
    rawProductName:
      typeof item.rawProductName === "string" ? item.rawProductName : null,
    discountYen: typeof item.discountYen === "number" ? item.discountYen : null,
    confidence: typeof item.confidence === "number" ? item.confidence : null,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

function write(records: IngredientPriceRecord[]): void {
  writeStorage(STORAGE_KEYS.ingredientPrices, records);
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.ingredientPrices);
  cached = records;
  listeners.forEach((listener) => listener());
}

export function loadIngredientPrices(): IngredientPriceRecord[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.ingredientPrices)) {
    write([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.ingredientPrices);
  if (raw === cachedRaw && cachedRaw !== undefined) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.ingredientPrices);
  if (!Array.isArray(stored)) {
    write([]);
    return [];
  }
  const records = stored
    .map(migrateRecord)
    .filter((entry): entry is IngredientPriceRecord => entry !== null)
    .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
  cachedRaw = raw;
  cached = records;
  return records;
}

export function addIngredientPrice(
  input: IngredientPriceInput,
): IngredientPriceRecord {
  const gramsEquivalent =
    input.gramsEquivalent ??
    toGramsEquivalent(input.packageQuantity, input.packageUnit);
  const unitCalc = calculateUnitPrice({
    purchasePriceYen: input.purchasePriceYen,
    discountYen: input.discountYen,
    gramsEquivalent,
    packageQuantity: input.packageQuantity,
    unitCountEquivalent: input.unitCountEquivalent,
  });
  const now = new Date().toISOString();
  const record: IngredientPriceRecord = {
    id: crypto.randomUUID(),
    ingredientName: input.ingredientName.trim(),
    normalizedIngredientName: normalizeIngredientName(input.ingredientName),
    foodCode: input.foodCode ?? null,
    storeId: input.storeId ?? null,
    storeBrandName: input.storeBrandName ?? null,
    storeBranchName: input.storeBranchName ?? null,
    storeName: input.storeName.trim(),
    purchasePriceYen: input.purchasePriceYen,
    originalPriceYen: input.originalPriceYen ?? null,
    packageQuantity: input.packageQuantity,
    packageCount: input.packageCount ?? null,
    packageUnit: input.packageUnit.trim(),
    gramsEquivalent,
    unitCountEquivalent: input.unitCountEquivalent ?? null,
    pricePer100g: unitCalc.pricePer100g,
    pricePerUnit: unitCalc.pricePerUnit,
    purchasedAt: input.purchasedAt ?? now,
    isSalePrice: input.isSalePrice === true,
    memo: input.memo?.trim() ?? "",
    source: input.source ?? "manual",
    receiptId: input.receiptId ?? null,
    rawProductName: input.rawProductName ?? null,
    discountYen: input.discountYen ?? null,
    confidence: input.confidence ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const next = [record, ...loadIngredientPrices()];
  write(next);
  return record;
}

export function removeIngredientPrice(id: string): void {
  write(loadIngredientPrices().filter((item) => item.id !== id));
}

export function subscribeIngredientPrices(onStoreChange: Listener): () => void {
  listeners.add(onStoreChange);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEYS.ingredientPrices || event.key === null) {
      cachedRaw = undefined;
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getIngredientPricesSnapshot(): IngredientPriceRecord[] {
  return loadIngredientPrices();
}

const EMPTY: IngredientPriceRecord[] = [];
export function getIngredientPricesServerSnapshot(): IngredientPriceRecord[] {
  return EMPTY;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * 直近価格を優先し、履歴が複数ある場合は中央値も参照して安定した概算を返す。
 * 履歴なしは null（0円扱いしない）。
 */
export function estimateIngredientPrice(
  ingredientName: string,
  records: IngredientPriceRecord[] = loadIngredientPrices(),
  preferStoreName?: string | null,
): IngredientPriceEstimate {
  const key = normalizeIngredientName(ingredientName);
  const matched = records.filter(
    (item) => item.normalizedIngredientName === key,
  );
  const storeFiltered =
    preferStoreName && preferStoreName.trim() !== ""
      ? matched.filter((item) => item.storeName === preferStoreName.trim())
      : matched;
  const pool = storeFiltered.length > 0 ? storeFiltered : matched;

  if (pool.length === 0) {
    return {
      ingredientName,
      normalizedIngredientName: key,
      estimatedPurchasePriceYen: null,
      pricePer100g: null,
      packageQuantity: null,
      packageUnit: null,
      gramsEquivalent: null,
      source: "none",
      storeName: null,
      storeId: null,
      purchasedAt: null,
      sampleCount: 0,
      sparseData: true,
    };
  }

  const recent = [...pool].sort((a, b) =>
    b.purchasedAt.localeCompare(a.purchasedAt),
  )[0];

  if (pool.length === 1) {
    return {
      ingredientName: recent.ingredientName,
      normalizedIngredientName: key,
      estimatedPurchasePriceYen: recent.purchasePriceYen,
      pricePer100g: recent.pricePer100g,
      packageQuantity: recent.packageQuantity,
      packageUnit: recent.packageUnit,
      gramsEquivalent: recent.gramsEquivalent,
      source: "recent",
      storeName: recent.storeName,
      storeId: recent.storeId,
      purchasedAt: recent.purchasedAt,
      sampleCount: 1,
      sparseData: true,
    };
  }

  const packPrices = pool.map((item) => item.purchasePriceYen);
  const med = median(packPrices);
  const per100 = median(
    pool
      .map((item) => item.pricePer100g)
      .filter((v): v is number => v !== null && Number.isFinite(v)),
  );

  return {
    ingredientName: recent.ingredientName,
    normalizedIngredientName: key,
    estimatedPurchasePriceYen: med,
    pricePer100g: per100 ?? recent.pricePer100g,
    packageQuantity: recent.packageQuantity,
    packageUnit: recent.packageUnit,
    gramsEquivalent: recent.gramsEquivalent,
    source: "median",
    storeName: recent.storeName,
    storeId: recent.storeId,
    purchasedAt: recent.purchasedAt,
    sampleCount: pool.length,
    sparseData: pool.length < 3,
  };
}

export function replaceIngredientPrices(records: IngredientPriceRecord[]): void {
  write(records);
}
