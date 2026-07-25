import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  isEffortLevel,
  type DailyCookingOverride,
  type EffortLevel,
} from "@/types/weekly-lifestyle";

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cached: DailyCookingOverride[] = [];

function migrate(value: unknown): DailyCookingOverride | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.date !== "string") return null;
  return {
    id: item.id,
    householdId: typeof item.householdId === "string" ? item.householdId : "local",
    date: item.date,
    cookMemberId: typeof item.cookMemberId === "string" ? item.cookMemberId : null,
    isEatingOut: item.isEatingOut === true,
    skipMealPlanning: item.skipMealPlanning === true,
    cookingTimeLimitMinutes:
      typeof item.cookingTimeLimitMinutes === "number"
        ? item.cookingTimeLimitMinutes
        : null,
    effortLevel: isEffortLevel(item.effortLevel) ? (item.effortLevel as EffortLevel) : null,
    shoppingAvailable:
      typeof item.shoppingAvailable === "boolean" ? item.shoppingAvailable : null,
    allowNewRecipes:
      typeof item.allowNewRecipes === "boolean" ? item.allowNewRecipes : null,
    participantMemberIds: Array.isArray(item.participantMemberIds)
      ? item.participantMemberIds.filter((id): id is string => typeof id === "string")
      : [],
    notes: typeof item.notes === "string" ? item.notes : null,
    updatedAt:
      typeof item.updatedAt === "string"
        ? item.updatedAt
        : new Date().toISOString(),
  };
}

function persist(list: DailyCookingOverride[]): void {
  writeStorage(STORAGE_KEYS.dailyCookingOverrides, list);
  cached = list;
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.dailyCookingOverrides);
  listeners.forEach((l) => l());
}

export function loadDailyCookingOverrides(): DailyCookingOverride[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.dailyCookingOverrides)) {
    persist([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.dailyCookingOverrides);
  if (raw === cachedRaw && cachedRaw !== undefined) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.dailyCookingOverrides);
  const list = Array.isArray(stored)
    ? stored.map(migrate).filter((d): d is DailyCookingOverride => d !== null)
    : [];
  cached = list;
  cachedRaw = raw;
  return list;
}

export function replaceDailyCookingOverrides(list: DailyCookingOverride[]): void {
  if (typeof window === "undefined") return;
  persist(list);
}

export function upsertDailyCookingOverride(
  override: Omit<DailyCookingOverride, "updatedAt"> & { updatedAt?: string },
): DailyCookingOverride {
  const next: DailyCookingOverride = {
    ...override,
    updatedAt: new Date().toISOString(),
  };
  const list = loadDailyCookingOverrides().filter(
    (item) =>
      !(item.householdId === next.householdId && item.date === next.date) &&
      item.id !== next.id,
  );
  persist([next, ...list]);
  return next;
}

export function getOverrideForDate(
  householdId: string,
  date: string,
): DailyCookingOverride | null {
  return (
    loadDailyCookingOverrides().find(
      (item) =>
        item.date === date &&
        (item.householdId === householdId || item.householdId === "local"),
    ) ?? null
  );
}

export function subscribeDailyCookingOverrides(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
