"use client";

import { useSyncExternalStore } from "react";
import {
  getHouseholdPreferencesServerSnapshot,
  getHouseholdPreferencesSnapshot,
  saveHouseholdPreferences,
  subscribeHouseholdPreferences,
} from "@/lib/meal-preferences";
import type { HouseholdPreferences } from "@/types/meal-preferences";

export function useHouseholdPreferences(): {
  preferences: HouseholdPreferences;
  save: (
    patch: Partial<Omit<HouseholdPreferences, "updatedAt">>,
  ) => HouseholdPreferences;
} {
  const preferences = useSyncExternalStore(
    subscribeHouseholdPreferences,
    getHouseholdPreferencesSnapshot,
    getHouseholdPreferencesServerSnapshot,
  );

  return {
    preferences,
    save: saveHouseholdPreferences,
  };
}
