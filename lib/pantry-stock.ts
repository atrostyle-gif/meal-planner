import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  DEFAULT_STOCK_STATUS,
  isIngredientType,
  isPantryIngredientType,
  isStockStatus,
  type IngredientType,
  type StockStatus,
} from "@/types/ingredient-meta";
import type { PantryStockItem } from "@/types/pantry-stock";

type Listener = () => void;

let cachedRaw: string | null | undefined = undefined;
let cachedItems: PantryStockItem[] = [];
const listeners = new Set<Listener>();

function isPantryStockItem(value: unknown): value is PantryStockItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.key === "string" &&
    typeof item.displayName === "string" &&
    isIngredientType(item.ingredientType) &&
    isPantryIngredientType(item.ingredientType) &&
    isStockStatus(item.stockStatus) &&
    typeof item.updatedAt === "string"
  );
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function writeItems(items: PantryStockItem[]): void {
  writeStorage(STORAGE_KEYS.pantryStock, items);
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.pantryStock);
  cachedItems = items;
}

function persist(items: PantryStockItem[]): void {
  writeItems(items);
  notify();
}

export function loadPantryStock(): PantryStockItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  if (!hasStorageKey(STORAGE_KEYS.pantryStock)) {
    writeItems([]);
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.pantryStock);
  if (raw === cachedRaw && cachedRaw !== undefined) {
    return cachedItems;
  }

  const stored = readStorage<unknown>(STORAGE_KEYS.pantryStock);
  if (!Array.isArray(stored) || !stored.every(isPantryStockItem)) {
    writeItems([]);
    return [];
  }

  cachedRaw = raw;
  cachedItems = stored;
  return stored;
}

export function subscribePantryStock(onStoreChange: Listener): () => void {
  listeners.add(onStoreChange);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEYS.pantryStock || event.key === null) {
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

export function getPantryStockSnapshot(): PantryStockItem[] {
  return loadPantryStock();
}

/** SSR 用の安定参照（毎回新しい配列を返すと無限ループになる） */
const EMPTY_PANTRY_STOCK_SNAPSHOT: PantryStockItem[] = [];

export function getPantryStockServerSnapshot(): PantryStockItem[] {
  return EMPTY_PANTRY_STOCK_SNAPSHOT;
}

export function getPantryStockByName(name: string): PantryStockItem | null {
  const key = normalizeIngredientName(name);
  return loadPantryStock().find((item) => item.key === key) ?? null;
}

export function getPantryStockStatus(name: string): StockStatus {
  return getPantryStockByName(name)?.stockStatus ?? DEFAULT_STOCK_STATUS;
}

export function upsertPantryStock(input: {
  displayName: string;
  ingredientType: IngredientType;
  stockStatus: StockStatus;
}): PantryStockItem | null {
  if (!isPantryIngredientType(input.ingredientType)) {
    return null;
  }

  const key = normalizeIngredientName(input.displayName);
  if (key === "") {
    return null;
  }

  const items = loadPantryStock();
  const index = items.findIndex((item) => item.key === key);
  const nextItem: PantryStockItem = {
    key,
    displayName: input.displayName.trim(),
    ingredientType: input.ingredientType,
    stockStatus: input.stockStatus,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    const next = [...items];
    next[index] = nextItem;
    persist(next);
  } else {
    persist([nextItem, ...items]);
  }

  return nextItem;
}

export function setPantryStockStatus(
  name: string,
  stockStatus: StockStatus,
  ingredientType: IngredientType = "pantrySeasoning",
): PantryStockItem | null {
  const existing = getPantryStockByName(name);
  return upsertPantryStock({
    displayName: existing?.displayName ?? name,
    ingredientType: existing?.ingredientType ?? (
      isPantryIngredientType(ingredientType) ? ingredientType : "pantrySeasoning"
    ),
    stockStatus,
  });
}

/** repository / 同期用 */
export function replacePantryStock(items: PantryStockItem[]): void {
  persist(items);
}
