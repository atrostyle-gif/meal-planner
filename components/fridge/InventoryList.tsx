"use client";

import Link from "next/link";
import { InventoryCard } from "@/components/fridge/InventoryCard";
import { PantryStockSection } from "@/components/fridge/PantryStockSection";
import { useInventory } from "@/lib/use-inventory";
import { useIsClient } from "@/lib/use-is-client";

export function InventoryList() {
  const items = useInventory();
  const isClient = useIsClient();

  if (!isClient) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">冷蔵庫</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            残り食材を登録して献立に活かしましょう
          </p>
        </div>
        <Link
          href="/fridge/new"
          className="shrink-0 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm"
        >
          追加
        </Link>
      </header>

      <PantryStockSection />

      {items.length === 0 ? (
        <div className="rounded-2xl bg-surface-container px-5 py-10 text-center">
          <p className="font-medium text-on-surface">食材がまだありません</p>
          <p className="mt-2 text-sm text-on-surface-variant">
            「追加」から冷蔵庫の残りを登録してください。
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <InventoryCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
