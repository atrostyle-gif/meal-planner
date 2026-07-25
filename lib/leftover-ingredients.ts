import { loadInventory } from "@/lib/inventory";
import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import type { InventoryAmount, InventoryItem } from "@/types/inventory";
import {
  isLeftoverPriority,
  isLeftoverSource,
  isLeftoverStatus,
  type LeftoverIngredient,
  type LeftoverIngredientInput,
  type LeftoverPriority,
} from "@/types/leftover-ingredient";

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cached: LeftoverIngredient[] = [];

/** 常備品っぽい名前は冷蔵庫からの移行対象外 */
const PANTRY_NAME_HINTS = [
  "塩",
  "砂糖",
  "醤油",
  "しょうゆ",
  "味噌",
  "みそ",
  "酢",
  "油",
  "サラダ油",
  "ごま油",
  "こしょう",
  "胡椒",
  "小麦粉",
  "片栗粉",
  "みりん",
  "酒",
  "だし",
  "コンソメ",
];

function amountToQuantityUnit(amount: InventoryAmount | null, unit: string): {
  quantity: number | null;
  unit: string | null;
} {
  if (!amount) {
    return { quantity: null, unit: unit.trim() || null };
  }
  if (amount.kind === "quantity") {
    return {
      quantity: amount.value,
      unit: amount.unitCode ?? (unit.trim() || null),
    };
  }
  if (amount.kind === "text") {
    const matched = amount.value.match(/^([\d.]+)\s*(.*)$/);
    if (matched) {
      const value = Number(matched[1]);
      return {
        quantity: Number.isFinite(value) ? value : null,
        unit: (matched[2] || unit).trim() || null,
      };
    }
    return { quantity: null, unit: amount.value || unit.trim() || null };
  }
  // preset → 数量なし、メモ相当は unit に残さない
  return { quantity: null, unit: unit.trim() || null };
}

function inventoryPriorityToLeftover(priority: boolean): LeftoverPriority {
  return priority ? "soon" : "normal";
}

function looksLikePantryName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return PANTRY_NAME_HINTS.some(
    (hint) => normalized === hint || normalized.includes(hint),
  );
}

function migrateItem(value: unknown): LeftoverIngredient | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.name !== "string") return null;
  const now = new Date().toISOString();
  return {
    id: item.id,
    householdId: typeof item.householdId === "string" ? item.householdId : "local",
    name: item.name,
    foodMasterId: typeof item.foodMasterId === "string" ? item.foodMasterId : null,
    quantity: typeof item.quantity === "number" ? item.quantity : null,
    unit: typeof item.unit === "string" ? item.unit : null,
    priority: isLeftoverPriority(item.priority) ? item.priority : "normal",
    notes: typeof item.notes === "string" ? item.notes : null,
    source: isLeftoverSource(item.source) ? item.source : "manual",
    status: isLeftoverStatus(item.status) ? item.status : "active",
    plannedForDates: Array.isArray(item.plannedForDates)
      ? item.plannedForDates.filter((d): d is string => typeof d === "string")
      : [],
    migratedFromInventoryId:
      typeof item.migratedFromInventoryId === "string"
        ? item.migratedFromInventoryId
        : null,
    includeInProposal: item.includeInProposal !== false,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

function persist(list: LeftoverIngredient[]): void {
  writeStorage(STORAGE_KEYS.leftoverIngredients, list);
  cached = list;
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.leftoverIngredients);
  listeners.forEach((listener) => listener());
}

export function loadLeftoverIngredients(): LeftoverIngredient[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.leftoverIngredients)) {
    persist([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.leftoverIngredients);
  if (raw === cachedRaw && cachedRaw !== undefined) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.leftoverIngredients);
  const list = Array.isArray(stored)
    ? stored.map(migrateItem).filter((item): item is LeftoverIngredient => item !== null)
    : [];
  cached = list;
  cachedRaw = raw;
  return list;
}

export function replaceLeftoverIngredients(list: LeftoverIngredient[]): void {
  if (typeof window === "undefined") return;
  persist(list);
}

export function getActiveLeftoversForProposal(
  householdId = "local",
): LeftoverIngredient[] {
  return loadLeftoverIngredients().filter(
    (item) =>
      (item.householdId === householdId || item.householdId === "local") &&
      item.includeInProposal &&
      (item.status === "active" || item.status === "planned") &&
      item.name.trim() !== "",
  );
}

export function saveLeftoverIngredient(
  input: LeftoverIngredientInput & {
    id?: string;
    householdId?: string;
    source?: LeftoverIngredient["source"];
    status?: LeftoverIngredient["status"];
    plannedForDates?: string[];
    migratedFromInventoryId?: string | null;
  },
): LeftoverIngredient {
  const now = new Date().toISOString();
  const list = loadLeftoverIngredients();
  const id = input.id ?? crypto.randomUUID();
  const existing = list.find((item) => item.id === id);
  const next: LeftoverIngredient = {
    id,
    householdId: input.householdId ?? existing?.householdId ?? "local",
    name: input.name.trim(),
    foodMasterId: input.foodMasterId ?? existing?.foodMasterId ?? null,
    quantity: input.quantity,
    unit: input.unit?.trim() || null,
    priority: input.priority,
    notes: input.notes?.trim() || null,
    source: input.source ?? existing?.source ?? "manual",
    status: input.status ?? existing?.status ?? "active",
    plannedForDates: input.plannedForDates ?? existing?.plannedForDates ?? [],
    migratedFromInventoryId:
      input.migratedFromInventoryId ?? existing?.migratedFromInventoryId ?? null,
    includeInProposal: input.includeInProposal ?? existing?.includeInProposal ?? true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  persist([next, ...list.filter((item) => item.id !== id)]);
  return next;
}

export function updateLeftoverIngredient(
  id: string,
  patch: Partial<LeftoverIngredient>,
): LeftoverIngredient | null {
  const list = loadLeftoverIngredients();
  const existing = list.find((item) => item.id === id);
  if (!existing) return null;
  const next: LeftoverIngredient = {
    ...existing,
    ...patch,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };
  persist([next, ...list.filter((item) => item.id !== id)]);
  return next;
}

export function deleteLeftoverIngredient(id: string): void {
  persist(loadLeftoverIngredients().filter((item) => item.id !== id));
}

export function markLeftoversPlanned(
  leftoverIds: string[],
  dates: string[],
): number {
  const idSet = new Set(leftoverIds);
  let count = 0;
  const list = loadLeftoverIngredients().map((item) => {
    if (!idSet.has(item.id)) return item;
    count += 1;
    const plannedForDates = [...new Set([...item.plannedForDates, ...dates])];
    return {
      ...item,
      status: item.status === "used" || item.status === "dismissed" ? item.status : ("planned" as const),
      plannedForDates,
      updatedAt: new Date().toISOString(),
    };
  });
  persist(list);
  return count;
}

export function markLeftoversUsed(leftoverIds: string[]): number {
  const idSet = new Set(leftoverIds);
  let count = 0;
  const list = loadLeftoverIngredients().map((item) => {
    if (!idSet.has(item.id)) return item;
    count += 1;
    return {
      ...item,
      status: "used" as const,
      includeInProposal: false,
      updatedAt: new Date().toISOString(),
    };
  });
  persist(list);
  return count;
}

/**
 * 既存冷蔵庫在庫 → 余り食材へ冪等移行。
 * 常備品っぽい名前は移行しない。元の inventory は削除しない。
 */
export function migrateInventoryToLeftovers(householdId = "local"): {
  migrated: number;
  skipped: number;
} {
  const inventory = loadInventory();
  const existing = loadLeftoverIngredients();
  const already = new Set(
    existing
      .map((item) => item.migratedFromInventoryId)
      .filter((id): id is string => typeof id === "string"),
  );
  let migrated = 0;
  let skipped = 0;
  const additions: LeftoverIngredient[] = [];

  for (const item of inventory) {
    if (already.has(item.id)) {
      skipped += 1;
      continue;
    }
    if (looksLikePantryName(item.name)) {
      skipped += 1;
      continue;
    }
    const { quantity, unit } = amountToQuantityUnit(item.amount, item.unit);
    const now = new Date().toISOString();
    additions.push({
      id: crypto.randomUUID(),
      householdId,
      name: item.name,
      foodMasterId: null,
      quantity,
      unit,
      priority: inventoryPriorityToLeftover(item.priority),
      notes:
        item.amount?.kind === "preset"
          ? `残量目安: ${item.amount.preset}`
          : null,
      source: "migrated_fridge",
      status: "active",
      plannedForDates: [],
      migratedFromInventoryId: item.id,
      includeInProposal: true,
      createdAt: item.createdAt || now,
      updatedAt: now,
    });
    migrated += 1;
  }

  if (additions.length > 0) {
    persist([...additions, ...existing]);
  }
  return { migrated, skipped };
}

/** InventoryItem 形式へ変換（v3 スコア互換用） */
export function leftoversToInventoryCompat(
  leftovers: LeftoverIngredient[],
): InventoryItem[] {
  return leftovers.map((item) => ({
    id: item.id,
    name: item.name,
    amount:
      item.quantity != null
        ? { kind: "quantity" as const, value: item.quantity }
        : null,
    unit: item.unit ?? "",
    priority: item.priority === "must_use" || item.priority === "soon",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

export function subscribeLeftoverIngredients(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLeftoverIngredientsSnapshot(): LeftoverIngredient[] {
  return loadLeftoverIngredients();
}

const EMPTY: LeftoverIngredient[] = [];
export function getLeftoverIngredientsServerSnapshot(): LeftoverIngredient[] {
  return EMPTY;
}
