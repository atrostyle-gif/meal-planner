"use client";

import Link from "next/link";
import { formatInventoryAmount } from "@/lib/inventory-amount";
import { toggleInventoryPriority } from "@/lib/inventory";
import type { InventoryItem } from "@/types/inventory";

type InventoryCardProps = {
  item: InventoryItem;
};

export function InventoryCard({ item }: InventoryCardProps) {
  const amountLabel = formatInventoryAmount(item.amount, item.unit);

  return (
    <div
      className={`flex items-stretch gap-2 rounded-2xl p-4 shadow-sm ring-1 ${
        item.priority
          ? "bg-priority-container ring-priority"
          : "bg-surface-container-lowest ring-outline-variant"
      }`}
    >
      <Link href={`/fridge/${item.id}/edit`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-lg font-semibold text-on-surface">
            {item.name}
          </h2>
          {item.priority ? (
            <span className="text-base" aria-label="優先">
              ⭐
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-on-surface-variant">{amountLabel}</p>
      </Link>

      <button
        type="button"
        onClick={() => toggleInventoryPriority(item.id)}
        className="shrink-0 self-center rounded-xl px-3 py-2 text-xl leading-none text-on-surface-variant hover:bg-surface-container"
        aria-label={item.priority ? "優先を解除" : "優先する"}
        aria-pressed={item.priority}
        title={item.priority ? "優先を解除" : "優先して使う"}
      >
        {item.priority ? "⭐" : "☆"}
      </button>
    </div>
  );
}
