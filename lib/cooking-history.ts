import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  type CookingHistory,
  type SuitabilityLevel,
  SUITABILITY_LEVELS,
} from "@/types/weekly-lifestyle";

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cached: CookingHistory[] = [];

function isSuitability(value: unknown): value is SuitabilityLevel {
  return (
    typeof value === "string" &&
    (SUITABILITY_LEVELS as readonly string[]).includes(value)
  );
}

function migrate(value: unknown): CookingHistory | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.recipeId !== "string") {
    return null;
  }
  const cookedBy =
    typeof item.cookedByMemberId === "string"
      ? item.cookedByMemberId
      : typeof item.createdBy === "string"
        ? item.createdBy
        : null;
  const notes =
    typeof item.notes === "string"
      ? item.notes
      : typeof item.memo === "string"
        ? item.memo
        : null;
  const duration =
    typeof item.durationMinutes === "number"
      ? item.durationMinutes
      : typeof item.cookingTimeActual === "number"
        ? item.cookingTimeActual
        : null;
  return {
    id: item.id,
    householdId: typeof item.householdId === "string" ? item.householdId : "local",
    recipeId: item.recipeId,
    cookedByMemberId: cookedBy,
    cookedAt:
      typeof item.cookedAt === "string"
        ? item.cookedAt
        : new Date().toISOString(),
    difficultyFeedback: isSuitability(item.difficultyFeedback)
      ? item.difficultyFeedback
      : null,
    durationMinutes: duration,
    successRating:
      typeof item.successRating === "number" ? item.successRating : null,
    notes,
    servings: typeof item.servings === "number" ? item.servings : null,
    cookingTimeActual: duration,
    createdBy: cookedBy,
    memo: notes,
    wantAgain: typeof item.wantAgain === "boolean" ? item.wantAgain : null,
    improvementTags: Array.isArray(item.improvementTags)
      ? item.improvementTags.filter((t): t is string => typeof t === "string")
      : [],
  };
}

function persist(list: CookingHistory[]): void {
  writeStorage(STORAGE_KEYS.cookingHistory, list);
  cached = list;
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.cookingHistory);
  listeners.forEach((l) => l());
}

export function loadCookingHistory(): CookingHistory[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.cookingHistory)) {
    persist([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.cookingHistory);
  if (raw === cachedRaw && cachedRaw !== undefined) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.cookingHistory);
  const list = Array.isArray(stored)
    ? stored.map(migrate).filter((h): h is CookingHistory => h !== null)
    : [];
  cached = list;
  cachedRaw = raw;
  return list;
}

export function replaceCookingHistory(list: CookingHistory[]): void {
  if (typeof window === "undefined") return;
  persist(list);
}

export function addCookingHistory(
  entry: Omit<CookingHistory, "id" | "cookedAt"> & {
    id?: string;
    cookedAt?: string;
  },
): CookingHistory {
  const createdBy = entry.createdBy ?? entry.cookedByMemberId ?? null;
  const memo = entry.memo ?? entry.notes ?? null;
  const cookingTimeActual =
    entry.cookingTimeActual ?? entry.durationMinutes ?? null;
  const next: CookingHistory = {
    id: entry.id ?? crypto.randomUUID(),
    householdId: entry.householdId,
    recipeId: entry.recipeId,
    cookedByMemberId: createdBy,
    cookedAt: entry.cookedAt ?? new Date().toISOString(),
    difficultyFeedback: entry.difficultyFeedback,
    durationMinutes: cookingTimeActual,
    successRating: entry.successRating,
    notes: memo,
    servings: entry.servings ?? null,
    cookingTimeActual,
    createdBy,
    memo,
    wantAgain: entry.wantAgain ?? null,
    improvementTags: entry.improvementTags ?? [],
  };
  persist([next, ...loadCookingHistory()]);
  return next;
}

export function countCooksByMember(
  recipeId: string,
  memberId: string,
): number {
  return loadCookingHistory().filter(
    (h) => h.recipeId === recipeId && h.cookedByMemberId === memberId,
  ).length;
}

export function subscribeCookingHistory(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
