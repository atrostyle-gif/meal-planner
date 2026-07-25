import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  DEFAULT_DIABETES_MEAL_SUPPORT_SETTINGS,
  type DiabetesMealSupportSettings,
} from "@/types/diabetes-meal-support";

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedRaw: string | null | undefined = undefined;
let cached: DiabetesMealSupportSettings | null = null;

function nullablePositiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  return value;
}

function migrate(
  value: unknown,
): DiabetesMealSupportSettings {
  const now = new Date().toISOString();
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_DIABETES_MEAL_SUPPORT_SETTINGS, updatedAt: now };
  }
  const item = value as Record<string, unknown>;
  return {
    diabetesMealSupportEnabled: item.diabetesMealSupportEnabled === true,
    targetCarbsPerMealMin: nullablePositiveNumber(item.targetCarbsPerMealMin),
    targetCarbsPerMealMax: nullablePositiveNumber(item.targetCarbsPerMealMax),
    targetCarbsPerDay: nullablePositiveNumber(item.targetCarbsPerDay),
    prioritizeFiber: item.prioritizeFiber === true,
    prioritizeNonStarchyVegetables: item.prioritizeNonStarchyVegetables === true,
    limitSodium: item.limitSodium === true,
    limitSaturatedFat: item.limitSaturatedFat === true,
    preferredStaplePortionGrams: nullablePositiveNumber(
      item.preferredStaplePortionGrams,
    ),
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

function write(settings: DiabetesMealSupportSettings): void {
  writeStorage(STORAGE_KEYS.diabetesMealSupport, settings);
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.diabetesMealSupport);
  cached = settings;
  listeners.forEach((listener) => listener());
}

export function loadDiabetesMealSupportSettings(): DiabetesMealSupportSettings {
  if (typeof window === "undefined") {
    return {
      ...DEFAULT_DIABETES_MEAL_SUPPORT_SETTINGS,
      updatedAt: new Date().toISOString(),
    };
  }
  if (!hasStorageKey(STORAGE_KEYS.diabetesMealSupport)) {
    const initial = {
      ...DEFAULT_DIABETES_MEAL_SUPPORT_SETTINGS,
      updatedAt: new Date().toISOString(),
    };
    write(initial);
    return initial;
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.diabetesMealSupport);
  if (raw === cachedRaw && cached) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.diabetesMealSupport);
  const settings = migrate(stored);
  write(settings);
  return settings;
}

export function saveDiabetesMealSupportSettings(
  patch: Partial<Omit<DiabetesMealSupportSettings, "updatedAt">>,
): DiabetesMealSupportSettings {
  const current = loadDiabetesMealSupportSettings();
  const next: DiabetesMealSupportSettings = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  // 目標値は空欄＝null（医学的既定値で埋めない）
  if ("targetCarbsPerMealMin" in patch) {
    next.targetCarbsPerMealMin = nullablePositiveNumber(
      patch.targetCarbsPerMealMin,
    );
  }
  if ("targetCarbsPerMealMax" in patch) {
    next.targetCarbsPerMealMax = nullablePositiveNumber(
      patch.targetCarbsPerMealMax,
    );
  }
  if ("targetCarbsPerDay" in patch) {
    next.targetCarbsPerDay = nullablePositiveNumber(patch.targetCarbsPerDay);
  }
  if ("preferredStaplePortionGrams" in patch) {
    next.preferredStaplePortionGrams = nullablePositiveNumber(
      patch.preferredStaplePortionGrams,
    );
  }
  write(next);
  return next;
}

export function subscribeDiabetesMealSupportSettings(
  onStoreChange: Listener,
): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function getDiabetesMealSupportSettingsSnapshot(): DiabetesMealSupportSettings {
  return loadDiabetesMealSupportSettings();
}
