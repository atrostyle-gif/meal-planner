import { resolveFoodMaster } from "@/lib/food-master/resolve";
import { normalizeIngredientName } from "@/lib/food-master/normalize";
import { createSampleFoodMasters } from "@/lib/food-master/sample-data";
import { loadFoodMasters } from "@/lib/food-master/store";
import { loadInventory } from "@/lib/inventory";
import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import type { InventoryAmount, InventoryItem } from "@/types/inventory";
import {
  isLeftoverSource,
  isLeftoverStatus,
  type LeftoverIngredient,
  type LeftoverIngredientInput,
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

function mastersForResolve() {
  if (typeof window === "undefined") return createSampleFoodMasters();
  return loadFoodMasters();
}

function resolveNames(rawName: string): {
  name: string;
  rawName: string;
  normalizedName: string;
  foodMasterId: string | null;
  foodCode: string | null;
} {
  const trimmed = rawName.trim();
  const hit = resolveFoodMaster(trimmed, { masters: mastersForResolve() });
  const name =
    hit.master && !hit.needsReview ? hit.canonicalName : trimmed;
  return {
    name,
    rawName: trimmed,
    normalizedName: normalizeIngredientName(name),
    foodMasterId: hit.master?.id ?? null,
    foodCode: hit.foodCode,
  };
}

function parseQuantityText(quantityText: string | null | undefined): {
  quantity: number | null;
  unit: string | null;
} {
  if (!quantityText || quantityText.trim() === "") {
    return { quantity: null, unit: null };
  }
  const matched = quantityText.trim().match(/^([\d.]+)\s*(.*)$/);
  if (!matched) {
    return { quantity: null, unit: quantityText.trim() };
  }
  const value = Number(matched[1]);
  return {
    quantity: Number.isFinite(value) ? value : null,
    unit: matched[2]?.trim() || null,
  };
}

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
    return parseQuantityText(amount.value);
  }
  return { quantity: null, unit: unit.trim() || null };
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
  const rawName =
    typeof item.rawName === "string" && item.rawName.trim() !== ""
      ? item.rawName
      : item.name;
  const resolved = resolveNames(rawName);
  const quantityText =
    typeof item.quantityText === "string" ? item.quantityText : null;
  const parsedFromText = parseQuantityText(quantityText);
  const source =
    item.source === "manual_meal_plan"
      ? ("manual_meal_plan" as const)
      : isLeftoverSource(item.source)
        ? item.source
        : ("manual" as const);

  return {
    id: item.id,
    householdId: typeof item.householdId === "string" ? item.householdId : "local",
    name: resolved.name,
    rawName: resolved.rawName,
    normalizedName:
      typeof item.normalizedName === "string" && item.normalizedName !== ""
        ? item.normalizedName
        : resolved.normalizedName,
    foodCode:
      typeof item.foodCode === "string"
        ? item.foodCode
        : resolved.foodCode,
    foodMasterId:
      typeof item.foodMasterId === "string"
        ? item.foodMasterId
        : resolved.foodMasterId,
    quantityText,
    quantity:
      typeof item.quantity === "number"
        ? item.quantity
        : parsedFromText.quantity,
    unit:
      typeof item.unit === "string"
        ? item.unit
        : parsedFromText.unit,
    // 優先度廃止: 同期互換のため soon 固定
    priority: "soon",
    notes: typeof item.notes === "string" ? item.notes : null,
    source,
    status: isLeftoverStatus(item.status) ? item.status : "active",
    weekStart: typeof item.weekStart === "string" ? item.weekStart : null,
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
  persist(list.map((item) => migrateItem(item)).filter((item): item is LeftoverIngredient => item !== null));
}

/** 指定週の提案対象余り食材（週未設定レガシーは含めない） */
export function getActiveLeftoversForProposal(
  householdId = "local",
  weekStart?: string | null,
): LeftoverIngredient[] {
  return loadLeftoverIngredients().filter((item) => {
    if (item.householdId !== householdId && item.householdId !== "local") {
      return false;
    }
    if (!item.includeInProposal) return false;
    if (item.status !== "active" && item.status !== "planned") return false;
    if (item.name.trim() === "") return false;
    if (weekStart) {
      return item.weekStart === weekStart;
    }
    // weekStart 未指定時は週付きのもののみ（持ち越し防止）
    return item.weekStart != null && item.weekStart !== "";
  });
}

/** 前回入力の候補（明示選択用。自動適用しない） */
export function getPreviousLeftoverNameSuggestions(
  currentWeekStart: string,
  limit = 8,
): string[] {
  const list = loadLeftoverIngredients()
    .filter(
      (item) =>
        item.weekStart != null &&
        item.weekStart !== currentWeekStart &&
        item.name.trim() !== "",
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of list) {
    const key = item.normalizedName || normalizeIngredientName(item.name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(item.name);
    if (names.length >= limit) break;
  }
  return names;
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
  const resolved = resolveNames(input.rawName ?? input.name);
  const quantityText =
    input.quantityText?.trim() ||
    (input.quantity != null
      ? `${input.quantity}${input.unit?.trim() ?? ""}`
      : null);
  const parsed = parseQuantityText(quantityText);
  const next: LeftoverIngredient = {
    id,
    householdId: input.householdId ?? existing?.householdId ?? "local",
    name: resolved.name,
    rawName: resolved.rawName,
    normalizedName: resolved.normalizedName,
    foodCode: input.foodCode ?? resolved.foodCode,
    foodMasterId: input.foodMasterId ?? resolved.foodMasterId,
    quantityText,
    quantity: input.quantity ?? parsed.quantity,
    unit: input.unit?.trim() || parsed.unit,
    priority: "soon",
    notes: input.notes?.trim() || null,
    source: input.source ?? existing?.source ?? "manual_meal_plan",
    status: input.status ?? existing?.status ?? "active",
    weekStart:
      input.weekStart !== undefined
        ? input.weekStart
        : (existing?.weekStart ?? null),
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
  let next: LeftoverIngredient = {
    ...existing,
    ...patch,
    id: existing.id,
    priority: "soon",
    updatedAt: new Date().toISOString(),
  };
  if (patch.name != null || patch.rawName != null) {
    const resolved = resolveNames(patch.rawName ?? patch.name ?? existing.rawName);
    next = {
      ...next,
      name: resolved.name,
      rawName: resolved.rawName,
      normalizedName: resolved.normalizedName,
      foodMasterId: resolved.foodMasterId ?? next.foodMasterId,
      foodCode: resolved.foodCode ?? next.foodCode,
    };
  }
  if (patch.quantityText !== undefined) {
    const parsed = parseQuantityText(patch.quantityText);
    next = {
      ...next,
      quantityText: patch.quantityText,
      quantity: parsed.quantity ?? next.quantity,
      unit: parsed.unit ?? next.unit,
    };
  }
  persist([next, ...list.filter((item) => item.id !== id)]);
  return next;
}

export function deleteLeftoverIngredient(id: string): void {
  persist(loadLeftoverIngredients().filter((item) => item.id !== id));
}

export function clearLeftoversForWeek(weekStart: string): number {
  const before = loadLeftoverIngredients();
  const next = before.filter((item) => item.weekStart !== weekStart);
  const removed = before.length - next.length;
  if (removed > 0) persist(next);
  return removed;
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
      status:
        item.status === "used" || item.status === "dismissed"
          ? item.status
          : ("planned" as const),
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
 * 既存冷蔵庫在庫 → 余り食材へ冪等移行（詳細設定用）。
 * 通常の献立入力 UI では呼ばない。
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
    const resolved = resolveNames(item.name);
    const now = new Date().toISOString();
    additions.push({
      id: crypto.randomUUID(),
      householdId,
      name: resolved.name,
      rawName: resolved.rawName,
      normalizedName: resolved.normalizedName,
      foodCode: resolved.foodCode,
      foodMasterId: resolved.foodMasterId,
      quantityText:
        quantity != null ? `${quantity}${unit ?? ""}` : null,
      quantity,
      unit,
      priority: "soon",
      notes:
        item.amount?.kind === "preset"
          ? `残量目安: ${item.amount.preset}`
          : null,
      source: "migrated_fridge",
      status: "active",
      weekStart: null,
      plannedForDates: [],
      migratedFromInventoryId: item.id,
      includeInProposal: false,
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

/** InventoryItem 形式へ変換（互換用） */
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
    priority: true,
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
