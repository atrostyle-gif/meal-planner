import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import type {
  AmountPreset,
  InventoryAmount,
  InventoryInput,
  InventoryItem,
} from "@/types/inventory";

type Listener = () => void;

let cachedRaw: string | null | undefined = undefined;
let cachedItems: InventoryItem[] = [];
const listeners = new Set<Listener>();

function isAmountPreset(value: unknown): value is AmountPreset {
  return value === "little" || value === "half" || value === "lot";
}

function isInventoryAmount(value: unknown): value is InventoryAmount {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Record<string, unknown>;

  if (item.kind === "preset") {
    return isAmountPreset(item.preset);
  }

  if (item.kind === "text") {
    return typeof item.value === "string";
  }

  if (item.kind === "quantity") {
    return (
      typeof item.value === "number" &&
      Number.isFinite(item.value) &&
      (item.unitCode === undefined || typeof item.unitCode === "string")
    );
  }

  return false;
}

function isInventoryItem(value: unknown): value is InventoryItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    (item.amount === null || isInventoryAmount(item.amount)) &&
    typeof item.unit === "string" &&
    typeof item.priority === "boolean" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function parseInventory(value: unknown): InventoryItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  if (!value.every(isInventoryItem)) {
    return null;
  }

  return value;
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function writeItems(items: InventoryItem[]): void {
  writeStorage(STORAGE_KEYS.inventory, items);
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.inventory);
  cachedItems = items;
}

function persist(items: InventoryItem[]): void {
  writeItems(items);
  notify();
}

/** 優先食材を先に、同順位は更新が新しい順 */
export function sortInventoryItems(items: InventoryItem[]): InventoryItem[] {
  return [...items].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority ? -1 : 1;
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function loadInventory(): InventoryItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  if (!hasStorageKey(STORAGE_KEYS.inventory)) {
    writeItems([]);
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.inventory);
  if (raw === cachedRaw && cachedRaw !== undefined) {
    return cachedItems;
  }

  const stored = readStorage<unknown>(STORAGE_KEYS.inventory);
  const items = parseInventory(stored);

  if (items === null) {
    writeItems([]);
    return [];
  }

  cachedRaw = raw;
  cachedItems = items;
  return items;
}

export function subscribeInventory(onStoreChange: Listener): () => void {
  listeners.add(onStoreChange);

  const onStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEYS.inventory || event.key === null) {
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

export function getInventorySnapshot(): InventoryItem[] {
  return loadInventory();
}

/** SSR 用の安定参照（毎回新しい配列を返すと無限ループになる） */
const EMPTY_INVENTORY_SNAPSHOT: InventoryItem[] = [];

export function getInventoryServerSnapshot(): InventoryItem[] {
  return EMPTY_INVENTORY_SNAPSHOT;
}

export function getInventoryItemById(id: string): InventoryItem | null {
  return loadInventory().find((item) => item.id === id) ?? null;
}

function normalizeAmount(amount: InventoryAmount | null): InventoryAmount | null {
  if (amount === null) {
    return null;
  }

  if (amount.kind === "text") {
    const value = amount.value.trim();
    return value === "" ? null : { kind: "text", value };
  }

  if (amount.kind === "quantity") {
    return {
      kind: "quantity",
      value: amount.value,
      unitCode: amount.unitCode,
    };
  }

  return { kind: "preset", preset: amount.preset };
}

export function createInventoryItem(input: InventoryInput): InventoryItem {
  const now = new Date().toISOString();
  const item: InventoryItem = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    amount: normalizeAmount(input.amount),
    unit: input.unit.trim(),
    priority: input.priority,
    createdAt: now,
    updatedAt: now,
  };

  persist([item, ...loadInventory()]);
  return item;
}

export function updateInventoryItem(
  id: string,
  input: InventoryInput,
): InventoryItem | null {
  const items = loadInventory();
  const index = items.findIndex((item) => item.id === id);

  if (index === -1) {
    return null;
  }

  const updated: InventoryItem = {
    ...items[index],
    name: input.name.trim(),
    amount: normalizeAmount(input.amount),
    unit: input.unit.trim(),
    priority: input.priority,
    updatedAt: new Date().toISOString(),
  };

  const next = [...items];
  next[index] = updated;
  persist(next);
  return updated;
}

export function deleteInventoryItem(id: string): boolean {
  const items = loadInventory();
  const next = items.filter((item) => item.id !== id);

  if (next.length === items.length) {
    return false;
  }

  persist(next);
  return true;
}

export function toggleInventoryPriority(id: string): InventoryItem | null {
  const items = loadInventory();
  const index = items.findIndex((item) => item.id === id);

  if (index === -1) {
    return null;
  }

  const updated: InventoryItem = {
    ...items[index],
    priority: !items[index].priority,
    updatedAt: new Date().toISOString(),
  };

  const next = [...items];
  next[index] = updated;
  persist(next);
  return updated;
}

/** repository / 同期用 */
export function replaceInventory(items: InventoryItem[]): void {
  persist(items);
}
