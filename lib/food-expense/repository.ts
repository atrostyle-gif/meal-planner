import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  isDetailCompleteness,
  isFoodExpenseCategory,
  isPaymentMethod,
  type FoodExpenseCategoryAmount,
  type FoodExpenseTransaction,
} from "@/types/food-expense";

export type FoodExpenseRepository = {
  list(): FoodExpenseTransaction[];
  getById(id: string): FoodExpenseTransaction | null;
  findByReceiptId(receiptId: string): FoodExpenseTransaction | null;
  upsert(tx: FoodExpenseTransaction): FoodExpenseTransaction;
  remove(id: string): void;
  removeByReceiptId(receiptId: string): void;
  replaceAll(items: FoodExpenseTransaction[]): void;
};

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cached: FoodExpenseTransaction[] = [];

function migrateBreakdown(value: unknown): FoodExpenseCategoryAmount[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const row = item as Record<string, unknown>;
      if (!isFoodExpenseCategory(row.category)) return null;
      if (typeof row.amountYen !== "number" || !Number.isFinite(row.amountYen)) {
        return null;
      }
      return {
        category: row.category,
        amountYen: row.amountYen,
        excluded: row.excluded === true,
      };
    })
    .filter((item): item is FoodExpenseCategoryAmount => item !== null);
}

function migrate(value: unknown): FoodExpenseTransaction | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.totalAmountYen !== "number" ||
    !Number.isFinite(item.totalAmountYen)
  ) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: item.id,
    householdId:
      typeof item.householdId === "string" ? item.householdId : "local",
    receiptId: typeof item.receiptId === "string" ? item.receiptId : null,
    storeId: typeof item.storeId === "string" ? item.storeId : null,
    storeName: typeof item.storeName === "string" ? item.storeName : "",
    purchasedAt:
      typeof item.purchasedAt === "string" ? item.purchasedAt : now,
    subtotalYen:
      typeof item.subtotalYen === "number" ? item.subtotalYen : null,
    discountYen:
      typeof item.discountYen === "number" ? item.discountYen : null,
    taxYen: typeof item.taxYen === "number" ? item.taxYen : null,
    totalAmountYen: item.totalAmountYen,
    paymentMethod: isPaymentMethod(item.paymentMethod)
      ? item.paymentMethod
      : "unknown",
    categoryBreakdown: migrateBreakdown(item.categoryBreakdown),
    source: item.source === "manual" ? "manual" : "receipt",
    detailCompleteness: isDetailCompleteness(item.detailCompleteness)
      ? item.detailCompleteness
      : item.source === "manual"
        ? "amount_only"
        : "full_items",
    memo: typeof item.memo === "string" ? item.memo : "",
    createdBy: typeof item.createdBy === "string" ? item.createdBy : null,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

function write(items: FoodExpenseTransaction[]): void {
  writeStorage(STORAGE_KEYS.foodExpenseTransactions, items);
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.foodExpenseTransactions);
  cached = items;
  listeners.forEach((listener) => listener());
}

function load(): FoodExpenseTransaction[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.foodExpenseTransactions)) {
    write([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.foodExpenseTransactions);
  if (raw === cachedRaw && cachedRaw !== undefined) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.foodExpenseTransactions);
  const list = Array.isArray(stored)
    ? stored
        .map(migrate)
        .filter((item): item is FoodExpenseTransaction => item !== null)
        .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt))
    : [];
  cachedRaw = raw;
  cached = list;
  return list;
}

export class LocalFoodExpenseRepository implements FoodExpenseRepository {
  list(): FoodExpenseTransaction[] {
    return load();
  }

  getById(id: string): FoodExpenseTransaction | null {
    return this.list().find((item) => item.id === id) ?? null;
  }

  findByReceiptId(receiptId: string): FoodExpenseTransaction | null {
    return this.list().find((item) => item.receiptId === receiptId) ?? null;
  }

  upsert(tx: FoodExpenseTransaction): FoodExpenseTransaction {
    const now = new Date().toISOString();
    const nextTx = { ...tx, updatedAt: now };
    const all = this.list();
    const index = all.findIndex((item) => item.id === tx.id);
    if (index >= 0) {
      const next = [...all];
      next[index] = nextTx;
      write(next);
    } else {
      write([nextTx, ...all]);
    }
    return nextTx;
  }

  remove(id: string): void {
    write(this.list().filter((item) => item.id !== id));
  }

  removeByReceiptId(receiptId: string): void {
    write(this.list().filter((item) => item.receiptId !== receiptId));
  }

  replaceAll(items: FoodExpenseTransaction[]): void {
    write(items);
  }
}

let repo: FoodExpenseRepository | null = null;

export function getFoodExpenseRepository(): FoodExpenseRepository {
  if (!repo) repo = new LocalFoodExpenseRepository();
  return repo;
}

export function setFoodExpenseRepositoryForTest(
  value: FoodExpenseRepository | null,
): void {
  repo = value;
}

export function subscribeFoodExpenses(onChange: Listener): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent): void => {
    if (
      event.key === STORAGE_KEYS.foodExpenseTransactions ||
      event.key === null
    ) {
      cachedRaw = undefined;
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getFoodExpensesSnapshot(): FoodExpenseTransaction[] {
  return getFoodExpenseRepository().list();
}

const EMPTY: FoodExpenseTransaction[] = [];
export function getFoodExpensesServerSnapshot(): FoodExpenseTransaction[] {
  return EMPTY;
}
