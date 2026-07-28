/**
 * 料理変更履歴（学習用）。レビュー本体とは別ストレージ。
 */
import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import type { MealChangeEvent } from "@/types/family-learning";

type Listener = () => void;
const listeners = new Set<Listener>();
let cached: MealChangeEvent[] | null = null;

function persist(list: MealChangeEvent[]): void {
  writeStorage(STORAGE_KEYS.mealChangeEvents, list.slice(0, 500));
  cached = list.slice(0, 500);
  listeners.forEach((l) => l());
}

function migrate(value: unknown): MealChangeEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.toRecipeId !== "string") {
    return null;
  }
  return {
    id: item.id,
    householdId:
      typeof item.householdId === "string" ? item.householdId : "local",
    date: typeof item.date === "string" ? item.date : "",
    course: typeof item.course === "string" ? item.course : "",
    fromRecipeId:
      typeof item.fromRecipeId === "string" ? item.fromRecipeId : null,
    toRecipeId: item.toRecipeId,
    at: typeof item.at === "string" ? item.at : new Date().toISOString(),
    source:
      item.source === "recommend" ||
      item.source === "regenerate" ||
      item.source === "manual"
        ? item.source
        : "manual",
  };
}

export function loadMealChangeEvents(): MealChangeEvent[] {
  if (typeof window === "undefined") return [];
  if (cached) return cached;
  if (!hasStorageKey(STORAGE_KEYS.mealChangeEvents)) {
    cached = [];
    return [];
  }
  const stored = readStorage<unknown>(STORAGE_KEYS.mealChangeEvents);
  cached = Array.isArray(stored)
    ? stored.map(migrate).filter((e): e is MealChangeEvent => e !== null)
    : [];
  return cached;
}

export function recordMealChangeEvent(
  input: Omit<MealChangeEvent, "id" | "at"> & { at?: string },
): void {
  if (typeof window === "undefined") return;
  if (input.fromRecipeId && input.fromRecipeId === input.toRecipeId) return;
  const list = loadMealChangeEvents();
  const next: MealChangeEvent = {
    id: crypto.randomUUID(),
    householdId: input.householdId,
    date: input.date,
    course: input.course,
    fromRecipeId: input.fromRecipeId,
    toRecipeId: input.toRecipeId,
    at: input.at ?? new Date().toISOString(),
    source: input.source,
  };
  persist([next, ...list]);
}

export function clearMealChangeEvents(): void {
  if (typeof window === "undefined") return;
  persist([]);
}

export function subscribeMealChangeEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
