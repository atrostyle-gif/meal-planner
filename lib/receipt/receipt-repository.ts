import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import type { Receipt, ReceiptItem } from "@/types/receipt";

export type ReceiptRepository = {
  listReceipts(): Receipt[];
  listItems(): ReceiptItem[];
  findByFingerprint(fingerprint: string): Receipt | null;
  saveConfirmed(input: {
    receipt: Omit<Receipt, "id" | "createdAt" | "updatedAt"> & { id?: string };
    items: Omit<ReceiptItem, "id" | "receiptId">[];
  }): { receipt: Receipt; items: ReceiptItem[] };
  replaceAll(receipts: Receipt[], items: ReceiptItem[]): void;
  countThisMonth(): number;
};

type Listener = () => void;
const listeners = new Set<Listener>();

let receiptsRaw: string | null | undefined;
let receiptsCache: Receipt[] = [];
let itemsRaw: string | null | undefined;
let itemsCache: ReceiptItem[] = [];

function migrateReceipt(value: unknown): Receipt | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.receiptFingerprint !== "string") {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: item.id,
    storeId: typeof item.storeId === "string" ? item.storeId : null,
    storeName: typeof item.storeName === "string" ? item.storeName : "",
    purchasedAt: typeof item.purchasedAt === "string" ? item.purchasedAt : null,
    totalAmountYen:
      typeof item.totalAmountYen === "number" ? item.totalAmountYen : null,
    receiptFingerprint: item.receiptFingerprint,
    keepImage: item.keepImage === true,
    confidence: typeof item.confidence === "number" ? item.confidence : null,
    warnings: Array.isArray(item.warnings)
      ? item.warnings.filter((w): w is string => typeof w === "string")
      : [],
    rawText: typeof item.rawText === "string" ? item.rawText : null,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

function migrateItem(value: unknown): ReceiptItem | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.receiptId !== "string" ||
    typeof item.rawProductName !== "string"
  ) {
    return null;
  }
  return {
    id: item.id,
    receiptId: item.receiptId,
    rawProductName: item.rawProductName,
    normalizedIngredientName:
      typeof item.normalizedIngredientName === "string"
        ? item.normalizedIngredientName
        : "",
    ingredientName:
      typeof item.ingredientName === "string" ? item.ingredientName : "",
    quantity: typeof item.quantity === "number" ? item.quantity : null,
    unit: typeof item.unit === "string" ? item.unit : null,
    packageCount:
      typeof item.packageCount === "number" ? item.packageCount : null,
    packageQuantity:
      typeof item.packageQuantity === "number" ? item.packageQuantity : null,
    packageUnit: typeof item.packageUnit === "string" ? item.packageUnit : null,
    gramsEquivalent:
      typeof item.gramsEquivalent === "number" ? item.gramsEquivalent : null,
    unitPriceYen:
      typeof item.unitPriceYen === "number" ? item.unitPriceYen : null,
    totalPriceYen:
      typeof item.totalPriceYen === "number" ? item.totalPriceYen : null,
    discountYen: typeof item.discountYen === "number" ? item.discountYen : null,
    taxIncluded: typeof item.taxIncluded === "boolean" ? item.taxIncluded : null,
    confidence: typeof item.confidence === "number" ? item.confidence : null,
    priceRecordId:
      typeof item.priceRecordId === "string" ? item.priceRecordId : null,
  };
}

function writeReceipts(list: Receipt[]): void {
  writeStorage(STORAGE_KEYS.receipts, list);
  receiptsRaw = window.localStorage.getItem(STORAGE_KEYS.receipts);
  receiptsCache = list;
  listeners.forEach((l) => l());
}

function writeItems(list: ReceiptItem[]): void {
  writeStorage(STORAGE_KEYS.receiptItems, list);
  itemsRaw = window.localStorage.getItem(STORAGE_KEYS.receiptItems);
  itemsCache = list;
  listeners.forEach((l) => l());
}

function loadReceipts(): Receipt[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.receipts)) {
    writeReceipts([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.receipts);
  if (raw === receiptsRaw && receiptsRaw !== undefined) return receiptsCache;
  const stored = readStorage<unknown>(STORAGE_KEYS.receipts);
  const list = Array.isArray(stored)
    ? stored.map(migrateReceipt).filter((r): r is Receipt => r !== null)
    : [];
  receiptsRaw = raw;
  receiptsCache = list;
  return list;
}

function loadItems(): ReceiptItem[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.receiptItems)) {
    writeItems([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.receiptItems);
  if (raw === itemsRaw && itemsRaw !== undefined) return itemsCache;
  const stored = readStorage<unknown>(STORAGE_KEYS.receiptItems);
  const list = Array.isArray(stored)
    ? stored.map(migrateItem).filter((r): r is ReceiptItem => r !== null)
    : [];
  itemsRaw = raw;
  itemsCache = list;
  return list;
}

export class LocalReceiptRepository implements ReceiptRepository {
  listReceipts(): Receipt[] {
    return loadReceipts();
  }

  listItems(): ReceiptItem[] {
    return loadItems();
  }

  findByFingerprint(fingerprint: string): Receipt | null {
    return this.listReceipts().find((r) => r.receiptFingerprint === fingerprint) ?? null;
  }

  saveConfirmed(input: {
    receipt: Omit<Receipt, "id" | "createdAt" | "updatedAt"> & { id?: string };
    items: Omit<ReceiptItem, "id" | "receiptId">[];
  }): { receipt: Receipt; items: ReceiptItem[] } {
    const now = new Date().toISOString();
    const receipt: Receipt = {
      ...input.receipt,
      id: input.receipt.id ?? crypto.randomUUID(),
      keepImage: false,
      createdAt: now,
      updatedAt: now,
    };
    const items: ReceiptItem[] = input.items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      receiptId: receipt.id,
    }));
    writeReceipts([receipt, ...this.listReceipts()]);
    writeItems([...items, ...this.listItems()]);
    return { receipt, items };
  }

  replaceAll(receipts: Receipt[], items: ReceiptItem[]): void {
    writeReceipts(receipts);
    writeItems(items);
  }

  countThisMonth(): number {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return this.listReceipts().filter((r) => {
      const d = new Date(r.createdAt);
      return d.getFullYear() === y && d.getMonth() === m;
    }).length;
  }
}

let receiptRepo: ReceiptRepository | null = null;

export function getReceiptRepository(): ReceiptRepository {
  if (!receiptRepo) receiptRepo = new LocalReceiptRepository();
  return receiptRepo;
}

export function setReceiptRepositoryForTest(repo: ReceiptRepository | null): void {
  receiptRepo = repo;
}

export function subscribeReceipts(onChange: Listener): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
