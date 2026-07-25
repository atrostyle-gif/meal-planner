"use client";

import { useSyncExternalStore } from "react";
import {
  getInventoryServerSnapshot,
  getInventorySnapshot,
  sortInventoryItems,
  subscribeInventory,
} from "@/lib/inventory";
import type { InventoryItem } from "@/types/inventory";

/** localStorage 上の在庫一覧を購読する（優先順で返す） */
export function useInventory(): InventoryItem[] {
  const items = useSyncExternalStore(
    subscribeInventory,
    getInventorySnapshot,
    getInventoryServerSnapshot,
  );
  return sortInventoryItems(items);
}

/** 指定 ID の在庫を取得する */
export function useInventoryItem(id: string): InventoryItem | null {
  const items = useInventory();
  return items.find((item) => item.id === id) ?? null;
}
