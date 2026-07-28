import { migrateFoodMasters } from "@/lib/food-master/migrate";
import { normalizeIngredientName } from "@/lib/food-master/normalize";
import { createSampleFoodMasters } from "@/lib/food-master/sample-data";
import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import type { FoodAliasMapping, FoodIngredientMaster } from "@/types/food-master";

type Listener = () => void;
const masterListeners = new Set<Listener>();
const aliasListeners = new Set<Listener>();

let masterCacheRaw: string | null | undefined;
let masterCache: FoodIngredientMaster[] = [];
let aliasCacheRaw: string | null | undefined;
let aliasCache: FoodAliasMapping[] = [];

function looksLikeLegacyMaster(stored: unknown[]): boolean {
  const first = stored[0];
  if (typeof first !== "object" || first === null) return true;
  const row = first as Record<string, unknown>;
  return (
    typeof row.foodCode !== "string" ||
    !Array.isArray(row.seasonMonths) ||
    !("storageType" in row) ||
    !("substituteFoods" in row)
  );
}

function migrateAndCache(stored: unknown): {
  masters: FoodIngredientMaster[];
  rewritten: boolean;
} {
  if (!Array.isArray(stored)) {
    return { masters: createSampleFoodMasters(), rewritten: true };
  }
  const migrated = migrateFoodMasters(stored);
  if (migrated.length === 0) {
    return { masters: createSampleFoodMasters(), rewritten: true };
  }
  return {
    masters: migrated,
    rewritten: looksLikeLegacyMaster(stored),
  };
}

export function loadFoodMasters(): FoodIngredientMaster[] {
  if (typeof window === "undefined") return createSampleFoodMasters();
  if (!hasStorageKey(STORAGE_KEYS.foodMasters)) {
    const samples = createSampleFoodMasters();
    writeStorage(STORAGE_KEYS.foodMasters, samples);
    masterCache = samples;
    masterCacheRaw = window.localStorage.getItem(STORAGE_KEYS.foodMasters);
    return samples;
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.foodMasters);
  if (raw === masterCacheRaw && masterCacheRaw !== undefined) return masterCache;
  const stored = readStorage<unknown[]>(STORAGE_KEYS.foodMasters);
  const { masters, rewritten } = migrateAndCache(stored);
  masterCache = masters;
  if (rewritten) {
    writeStorage(STORAGE_KEYS.foodMasters, masterCache);
  }
  masterCacheRaw = window.localStorage.getItem(STORAGE_KEYS.foodMasters);
  return masterCache;
}

export function replaceFoodMasters(masters: FoodIngredientMaster[]): void {
  const migrated = migrateFoodMasters(masters);
  writeStorage(STORAGE_KEYS.foodMasters, migrated);
  masterCache = migrated;
  masterCacheRaw = window.localStorage.getItem(STORAGE_KEYS.foodMasters);
  masterListeners.forEach((l) => l());
}

export function upsertFoodMaster(
  input: FoodIngredientMaster,
): FoodIngredientMaster {
  const list = loadFoodMasters();
  const now = new Date().toISOString();
  const next: FoodIngredientMaster = {
    ...input,
    foodCode: input.foodCode || input.id,
    defaultUnit: input.defaultUnit || input.edibleUnit,
    edibleUnit: input.edibleUnit || input.defaultUnit,
    updatedAt: now,
    createdAt: input.createdAt || now,
  };
  const migrated = migrateFoodMasters([next])[0];
  if (!migrated) {
    throw new Error("食材マスターの保存に失敗しました");
  }
  const without = list.filter(
    (item) => item.id !== migrated.id && item.foodCode !== migrated.foodCode,
  );
  replaceFoodMasters([migrated, ...without]);
  return migrated;
}

export function resetFoodMastersToSample(): number {
  const samples = createSampleFoodMasters();
  replaceFoodMasters(samples);
  return samples.length;
}

export function loadFoodAliasMappings(): FoodAliasMapping[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.foodAliasMappings)) {
    writeStorage(STORAGE_KEYS.foodAliasMappings, []);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.foodAliasMappings);
  if (raw === aliasCacheRaw && aliasCacheRaw !== undefined) return aliasCache;
  const stored = readStorage<FoodAliasMapping[]>(STORAGE_KEYS.foodAliasMappings);
  aliasCache = Array.isArray(stored) ? stored : [];
  aliasCacheRaw = raw;
  return aliasCache;
}

export function replaceFoodAliasMappings(mappings: FoodAliasMapping[]): void {
  if (typeof window === "undefined") return;
  writeStorage(STORAGE_KEYS.foodAliasMappings, mappings);
  aliasCache = mappings;
  aliasCacheRaw = window.localStorage.getItem(STORAGE_KEYS.foodAliasMappings);
  aliasListeners.forEach((listener) => listener());
}

export function saveFoodAliasMapping(
  mapping: Omit<FoodAliasMapping, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  },
): FoodAliasMapping {
  const now = new Date().toISOString();
  const list = loadFoodAliasMappings();
  const next: FoodAliasMapping = {
    id: mapping.id ?? crypto.randomUUID(),
    householdId: mapping.householdId,
    aliasName: mapping.aliasName,
    masterId: mapping.masterId,
    excludeFromNutrition: mapping.excludeFromNutrition,
    createdAt: now,
    updatedAt: now,
  };
  const without = list.filter(
    (item) =>
      item.id !== next.id &&
      !(
        item.householdId === next.householdId &&
        item.aliasName === next.aliasName
      ),
  );
  const updated = [next, ...without];
  writeStorage(STORAGE_KEYS.foodAliasMappings, updated);
  aliasCache = updated;
  aliasCacheRaw = window.localStorage.getItem(STORAGE_KEYS.foodAliasMappings);
  aliasListeners.forEach((l) => l());
  return next;
}

export function buildAliasMap(householdId: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of loadFoodAliasMappings()) {
    if (item.householdId !== householdId && item.householdId !== "local") {
      continue;
    }
    const raw = item.aliasName.trim().toLowerCase();
    const normalized = normalizeIngredientName(item.aliasName);
    map.set(raw, item.masterId);
    map.set(normalized, item.masterId);
  }
  return map;
}

export function subscribeFoodMasters(listener: Listener): () => void {
  masterListeners.add(listener);
  return () => masterListeners.delete(listener);
}

export function subscribeFoodAliasMappings(listener: Listener): () => void {
  aliasListeners.add(listener);
  return () => aliasListeners.delete(listener);
}
