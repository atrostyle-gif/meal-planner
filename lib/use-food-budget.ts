"use client";

import { useSyncExternalStore } from "react";
import {
  getFoodBudgetSettingsServerSnapshot,
  getFoodBudgetSettingsSnapshot,
  subscribeFoodBudgetSettings,
} from "@/lib/food-budget/settings";
import {
  getIngredientPricesServerSnapshot,
  getIngredientPricesSnapshot,
  subscribeIngredientPrices,
} from "@/lib/food-budget/prices";
import type { FoodBudgetSettings } from "@/types/food-budget";
import type { IngredientPriceRecord } from "@/types/ingredient-price";

export function useFoodBudgetSettings(): FoodBudgetSettings {
  return useSyncExternalStore(
    subscribeFoodBudgetSettings,
    getFoodBudgetSettingsSnapshot,
    getFoodBudgetSettingsServerSnapshot,
  );
}

export function useIngredientPrices(): IngredientPriceRecord[] {
  return useSyncExternalStore(
    subscribeIngredientPrices,
    getIngredientPricesSnapshot,
    getIngredientPricesServerSnapshot,
  );
}
