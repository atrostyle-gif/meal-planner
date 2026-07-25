import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import type { Json } from "@/lib/supabase/database.types";

export type HouseholdNutritionPreferences = {
  defaultAutoFillMode: string;
  showNutritionDisclaimer: boolean;
  settings: Json;
  updatedAt: string;
};

const DEFAULT_PREFERENCES: HouseholdNutritionPreferences = {
  defaultAutoFillMode: "バランス重視",
  showNutritionDisclaimer: true,
  settings: {},
  updatedAt: "",
};

export function loadHouseholdNutritionPreferences(): HouseholdNutritionPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  if (!hasStorageKey(STORAGE_KEYS.householdNutritionPreferences)) {
    const initial = { ...DEFAULT_PREFERENCES, updatedAt: new Date().toISOString() };
    writeStorage(STORAGE_KEYS.householdNutritionPreferences, initial);
    return initial;
  }
  const stored = readStorage<Partial<HouseholdNutritionPreferences>>(
    STORAGE_KEYS.householdNutritionPreferences,
  );
  return {
    defaultAutoFillMode: typeof stored?.defaultAutoFillMode === "string" ? stored.defaultAutoFillMode : DEFAULT_PREFERENCES.defaultAutoFillMode,
    showNutritionDisclaimer: stored?.showNutritionDisclaimer !== false,
    settings: stored?.settings ?? {},
    updatedAt: typeof stored?.updatedAt === "string" ? stored.updatedAt : new Date().toISOString(),
  };
}

export function replaceHouseholdNutritionPreferences(
  preferences: HouseholdNutritionPreferences,
): void {
  if (typeof window !== "undefined") {
    writeStorage(STORAGE_KEYS.householdNutritionPreferences, preferences);
  }
}
