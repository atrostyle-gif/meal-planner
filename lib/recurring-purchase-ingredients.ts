import { resolveFoodMaster } from "@/lib/food-master/resolve";
import { normalizeIngredientName } from "@/lib/food-master/normalize";
import { createSampleFoodMasters } from "@/lib/food-master/sample-data";
import { loadFoodMasters } from "@/lib/food-master/store";
import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  isDayOfWeek,
  isRecurringPurchaseFrequency,
  type RecurringPurchaseIngredient,
  type RecurringPurchaseIngredientInput,
} from "@/types/recurring-purchase-ingredient";

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cached: RecurringPurchaseIngredient[] = [];

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

function migrateItem(value: unknown): RecurringPurchaseIngredient | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.name !== "string") return null;
  const now = new Date().toISOString();
  const rawName =
    typeof item.rawName === "string" && item.rawName.trim() !== ""
      ? item.rawName
      : item.name;
  const resolved = resolveNames(rawName);

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
      typeof item.foodCode === "string" ? item.foodCode : resolved.foodCode,
    foodMasterId:
      typeof item.foodMasterId === "string"
        ? item.foodMasterId
        : resolved.foodMasterId,
    quantity: typeof item.quantity === "number" ? item.quantity : null,
    unit: typeof item.unit === "string" ? item.unit : null,
    storeId: typeof item.storeId === "string" ? item.storeId : null,
    storeName: typeof item.storeName === "string" ? item.storeName : null,
    arrivalDayOfWeek: isDayOfWeek(item.arrivalDayOfWeek)
      ? item.arrivalDayOfWeek
      : "friday",
    frequency: isRecurringPurchaseFrequency(item.frequency)
      ? item.frequency
      : "weekly",
    active: item.active !== false,
    preferInMealPlan: item.preferInMealPlan !== false,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

function persist(list: RecurringPurchaseIngredient[]): void {
  writeStorage(STORAGE_KEYS.recurringPurchaseIngredients, list);
  cached = list;
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.recurringPurchaseIngredients);
  listeners.forEach((listener) => listener());
}

export function loadRecurringPurchaseIngredients(): RecurringPurchaseIngredient[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.recurringPurchaseIngredients)) {
    persist([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.recurringPurchaseIngredients);
  if (raw === cachedRaw && cachedRaw !== undefined) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.recurringPurchaseIngredients);
  const list = Array.isArray(stored)
    ? stored
        .map(migrateItem)
        .filter((item): item is RecurringPurchaseIngredient => item !== null)
    : [];
  cached = list;
  cachedRaw = raw;
  return list;
}

export function replaceRecurringPurchaseIngredients(
  list: RecurringPurchaseIngredient[],
): void {
  if (typeof window === "undefined") return;
  persist(
    list
      .map(migrateItem)
      .filter((item): item is RecurringPurchaseIngredient => item !== null),
  );
}

export function saveRecurringPurchaseIngredient(
  input: RecurringPurchaseIngredientInput & {
    id?: string;
    householdId?: string;
  },
): RecurringPurchaseIngredient {
  const now = new Date().toISOString();
  const list = loadRecurringPurchaseIngredients();
  const id = input.id ?? crypto.randomUUID();
  const existing = list.find((item) => item.id === id);
  const resolved = resolveNames(input.rawName ?? input.name);
  const next: RecurringPurchaseIngredient = {
    id,
    householdId: input.householdId ?? existing?.householdId ?? "local",
    name: resolved.name,
    rawName: resolved.rawName,
    normalizedName: resolved.normalizedName,
    foodCode: input.foodCode ?? resolved.foodCode,
    foodMasterId: input.foodMasterId ?? resolved.foodMasterId,
    quantity: input.quantity ?? existing?.quantity ?? null,
    unit: input.unit?.trim() || existing?.unit || null,
    storeId: input.storeId ?? existing?.storeId ?? null,
    storeName: input.storeName?.trim() || existing?.storeName || null,
    arrivalDayOfWeek: input.arrivalDayOfWeek,
    frequency: input.frequency ?? existing?.frequency ?? "weekly",
    active: input.active ?? existing?.active ?? true,
    preferInMealPlan:
      input.preferInMealPlan ?? existing?.preferInMealPlan ?? true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  persist([next, ...list.filter((item) => item.id !== id)]);
  return next;
}

export function updateRecurringPurchaseIngredient(
  id: string,
  patch: Partial<RecurringPurchaseIngredient>,
): RecurringPurchaseIngredient | null {
  const list = loadRecurringPurchaseIngredients();
  const existing = list.find((item) => item.id === id);
  if (!existing) return null;
  let next: RecurringPurchaseIngredient = {
    ...existing,
    ...patch,
    id: existing.id,
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
  persist([next, ...list.filter((item) => item.id !== id)]);
  return next;
}

export function deleteRecurringPurchaseIngredient(id: string): void {
  persist(loadRecurringPurchaseIngredients().filter((item) => item.id !== id));
}

export function subscribeRecurringPurchaseIngredients(
  listener: Listener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRecurringPurchaseIngredientsSnapshot(): RecurringPurchaseIngredient[] {
  return loadRecurringPurchaseIngredients();
}

const EMPTY: RecurringPurchaseIngredient[] = [];
export function getRecurringPurchaseIngredientsServerSnapshot(): RecurringPurchaseIngredient[] {
  return EMPTY;
}
