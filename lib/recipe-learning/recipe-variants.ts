import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import type { RecipeVariant } from "@/types/recipe-learning";

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cached: RecipeVariant[] = [];

function migrate(value: unknown): RecipeVariant | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.parentRecipeId !== "string" ||
    typeof item.variantRecipeId !== "string"
  ) {
    return null;
  }
  return {
    id: item.id,
    parentRecipeId: item.parentRecipeId,
    variantRecipeId: item.variantRecipeId,
    title: typeof item.title === "string" ? item.title : "我が家版",
    summary: typeof item.summary === "string" ? item.summary : "",
    changes: Array.isArray(item.changes)
      ? item.changes.filter((c): c is string => typeof c === "string")
      : [],
    sourceHistoryIds: Array.isArray(item.sourceHistoryIds)
      ? item.sourceHistoryIds.filter((c): c is string => typeof c === "string")
      : [],
    sourceFeedbackIds: Array.isArray(item.sourceFeedbackIds)
      ? item.sourceFeedbackIds.filter((c): c is string => typeof c === "string")
      : [],
    householdId:
      typeof item.householdId === "string" ? item.householdId : "local",
    createdAt:
      typeof item.createdAt === "string"
        ? item.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof item.updatedAt === "string"
        ? item.updatedAt
        : new Date().toISOString(),
  };
}

function persist(list: RecipeVariant[]): void {
  writeStorage(STORAGE_KEYS.recipeVariants, list);
  cached = list;
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.recipeVariants);
  listeners.forEach((l) => l());
}

export function loadRecipeVariants(): RecipeVariant[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.recipeVariants)) {
    persist([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.recipeVariants);
  if (raw === cachedRaw && cachedRaw !== undefined) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.recipeVariants);
  const list = Array.isArray(stored)
    ? stored.map(migrate).filter((v): v is RecipeVariant => v !== null)
    : [];
  cached = list;
  cachedRaw = raw;
  return list;
}

export function replaceRecipeVariants(list: RecipeVariant[]): void {
  if (typeof window === "undefined") return;
  persist(list);
}

export function saveRecipeVariant(variant: RecipeVariant): RecipeVariant {
  const list = loadRecipeVariants();
  const index = list.findIndex((item) => item.id === variant.id);
  const next = [...list];
  if (index >= 0) next[index] = variant;
  else next.unshift(variant);
  persist(next);
  return variant;
}

export function getVariantsForParent(parentRecipeId: string): RecipeVariant[] {
  return loadRecipeVariants().filter((v) => v.parentRecipeId === parentRecipeId);
}

export function subscribeRecipeVariants(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
