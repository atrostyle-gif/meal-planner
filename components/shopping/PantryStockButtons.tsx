"use client";

import {
  STOCK_STATUSES,
  STOCK_STATUS_LABELS,
  type StockStatus,
} from "@/types/ingredient-meta";

type PantryStockButtonsProps = {
  value: StockStatus;
  onChange: (status: StockStatus) => void;
  compact?: boolean;
};

export function PantryStockButtons({
  value,
  onChange,
  compact = false,
}: PantryStockButtonsProps) {
  return (
    <div
      className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}
      role="group"
      aria-label="在庫状態"
    >
      {STOCK_STATUSES.map((status) => {
        const selected = value === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 transition ${
              selected
                ? "bg-primary text-on-primary ring-primary"
                : "bg-surface-container text-on-surface-variant ring-outline-variant"
            }`}
          >
            {STOCK_STATUS_LABELS[status]}
          </button>
        );
      })}
    </div>
  );
}
