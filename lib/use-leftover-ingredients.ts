"use client";

import { useSyncExternalStore } from "react";
import {
  getLeftoverIngredientsServerSnapshot,
  getLeftoverIngredientsSnapshot,
  subscribeLeftoverIngredients,
} from "@/lib/leftover-ingredients";
import type { LeftoverIngredient } from "@/types/leftover-ingredient";

/** localStorage 上の余り食材一覧を購読する */
export function useLeftoverIngredients(): LeftoverIngredient[] {
  return useSyncExternalStore(
    subscribeLeftoverIngredients,
    getLeftoverIngredientsSnapshot,
    getLeftoverIngredientsServerSnapshot,
  );
}
