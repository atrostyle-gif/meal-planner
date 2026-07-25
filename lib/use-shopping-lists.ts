"use client";

import { useSyncExternalStore } from "react";
import {
  getShoppingListByWeek,
  getShoppingListsServerSnapshot,
  getShoppingListsSnapshot,
  subscribeShoppingLists,
} from "@/lib/shopping-lists";
import type { ShoppingList } from "@/types/shopping-list";

export function useShoppingLists(): ShoppingList[] {
  return useSyncExternalStore(
    subscribeShoppingLists,
    getShoppingListsSnapshot,
    getShoppingListsServerSnapshot,
  );
}

export function useShoppingList(weekStart: string): ShoppingList | null {
  useShoppingLists();
  return getShoppingListByWeek(weekStart);
}
