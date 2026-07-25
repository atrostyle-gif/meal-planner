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
  const stored = readStorage<FoodIngredientMaster[]>(STORAGE_KEYS.foodMasters);
  masterCache = Array.isArray(stored) ? stored : createSampleFoodMasters();
  masterCacheRaw = raw;
  return masterCache;
}

export function replaceFoodMasters(masters: FoodIngredientMaster[]): void {
  writeStorage(STORAGE_KEYS.foodMasters, masters);
  masterCache = masters;
  masterCacheRaw = window.localStorage.getItem(STORAGE_KEYS.foodMasters);
  masterListeners.forEach((l) => l());
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
      !(item.householdId === next.householdId && item.aliasName === next.aliasName),
  );
  const updated = [next, ...without];
  writeStorage(STORAGE_KEYS.foodAliasMappings, updated);
  aliasCache = updated;
  aliasCacheRaw = window.localStorage.getItem(STORAGE_KEYS.foodAliasMappings);
  aliasListeners.forEach((l) => l());
  return next;
}

export function buildAliasMap(
  householdId: string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of loadFoodAliasMappings()) {
    if (item.householdId !== householdId && item.householdId !== "local") {
      continue;
    }
    map.set(item.aliasName.trim().toLowerCase(), item.masterId);
  }
  return map;
}

export function subscribeFoodMasters(listener: Listener): () => void {
  masterListeners.add(listener);
  return () => masterListeners.delete(listener);
}
