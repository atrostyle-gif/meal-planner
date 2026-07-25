"use client";

import { useSyncExternalStore } from "react";
import {
  getPantryStockByName,
  getPantryStockServerSnapshot,
  getPantryStockSnapshot,
  getPantryStockStatus,
  subscribePantryStock,
} from "@/lib/pantry-stock";
import type { StockStatus } from "@/types/ingredient-meta";
import type { PantryStockItem } from "@/types/pantry-stock";

export function usePantryStock(): PantryStockItem[] {
  return useSyncExternalStore(
    subscribePantryStock,
    getPantryStockSnapshot,
    getPantryStockServerSnapshot,
  );
}

export function usePantryStockStatus(name: string): StockStatus {
  usePantryStock();
  return getPantryStockStatus(name);
}

export function usePantryStockItem(name: string): PantryStockItem | null {
  usePantryStock();
  return getPantryStockByName(name);
}
