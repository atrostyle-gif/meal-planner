import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  isDailyConditionOption,
  type DailyCondition,
  type DailyConditionOption,
} from "@/types/daily-condition";

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cached: DailyCondition[] = [];

function migrate(value: unknown): DailyCondition | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.date !== "string") return null;
  return {
    date: item.date,
    selectedConditions: Array.isArray(item.selectedConditions)
      ? item.selectedConditions.filter(isDailyConditionOption)
      : ["通常"],
    notes: typeof item.notes === "string" ? item.notes : null,
    updatedAt:
      typeof item.updatedAt === "string"
        ? item.updatedAt
        : new Date().toISOString(),
  };
}

function persist(list: DailyCondition[]): void {
  writeStorage(STORAGE_KEYS.dailyConditions, list);
  cached = list;
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.dailyConditions);
  listeners.forEach((l) => l());
}

export function loadDailyConditions(): DailyCondition[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.dailyConditions)) {
    persist([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.dailyConditions);
  if (raw === cachedRaw && cachedRaw !== undefined) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.dailyConditions);
  const list = Array.isArray(stored)
    ? stored.map(migrate).filter((d): d is DailyCondition => d !== null)
    : [];
  cached = list;
  cachedRaw = raw;
  return list;
}

export function replaceDailyConditions(list: DailyCondition[]): void {
  if (typeof window !== "undefined") {
    persist(list);
  }
}

export function upsertDailyCondition(
  date: string,
  selectedConditions: DailyConditionOption[],
  notes?: string | null,
): DailyCondition {
  const list = loadDailyConditions().filter((item) => item.date !== date);
  const next: DailyCondition = {
    date,
    selectedConditions:
      selectedConditions.length > 0 ? selectedConditions : ["通常"],
    notes: notes ?? null,
    updatedAt: new Date().toISOString(),
  };
  persist([next, ...list]);
  return next;
}

export function getConditionsForDate(date: string): DailyConditionOption[] {
  return (
    loadDailyConditions().find((item) => item.date === date)?.selectedConditions ??
    ["通常"]
  );
}

export function subscribeDailyConditions(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
