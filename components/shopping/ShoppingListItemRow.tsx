"use client";

import { useState } from "react";
import { PantryStockButtons } from "@/components/shopping/PantryStockButtons";
import { ShoppingItemForm } from "@/components/shopping/ShoppingItemForm";
import {
  countShoppingSources,
  formatGroupQuantitySummary,
  formatQuantityLine,
  formatSourceLine,
} from "@/lib/shopping/format-shopping-item";
import { setPantryStockStatus } from "@/lib/pantry-stock";
import { usePantryStockStatus } from "@/lib/use-pantry-stock";
import {
  INGREDIENT_TYPE_LABELS,
  STOCK_STATUS_LABELS,
  isPantryIngredientType,
  type IngredientType,
  type StockStatus,
} from "@/types/ingredient-meta";
import type { ShoppingListItem, ShoppingListItemInput } from "@/types/shopping-list";

type ShoppingListItemRowProps = {
  item: ShoppingListItem;
  onToggle: () => void;
  onUpdate: (input: ShoppingListItemInput) => void;
  onRemove: () => void;
  onPantryStatusChange?: (status: StockStatus) => void;
  onRestorePantryEnough?: () => void;
};

export function ShoppingListItemRow({
  item,
  onToggle,
  onUpdate,
  onRemove,
  onPantryStatusChange,
  onRestorePantryEnough,
}: ShoppingListItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const stockStatus = usePantryStockStatus(item.ingredientName);
  const isPantry = isPantryIngredientType(item.ingredientType);
  const sourceCount = countShoppingSources(item);
  const quantitySummary = formatGroupQuantitySummary(item);
  const firstQuantity = item.quantities[0] ?? {
    quantity: null,
    unit: "",
    note: "",
  };

  function handleRemove(): void {
    const confirmed = window.confirm(
      `「${item.ingredientName}」をリストから削除しますか？`,
    );
    if (confirmed) {
      onRemove();
    }
  }

  function handlePantryChange(status: StockStatus): void {
    if (onPantryStatusChange) {
      onPantryStatusChange(status);
      return;
    }
    setPantryStockStatus(
      item.ingredientName,
      status,
      item.ingredientType as IngredientType,
    );
  }

  if (editing) {
    return (
      <li className="rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <ShoppingItemForm
          initial={{
            ingredientName: item.ingredientName,
            quantity: firstQuantity.quantity,
            unit: firstQuantity.unit,
            note: firstQuantity.note,
            ingredientType: item.ingredientType,
          }}
          submitLabel="保存"
          onCancel={() => setEditing(false)}
          onSubmit={(input) => {
            onUpdate(input);
            setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li
      className={`rounded-2xl p-3 ring-1 ${
        item.checked
          ? "bg-surface-container text-on-surface-variant ring-outline-variant"
          : "bg-surface-container-lowest ring-outline-variant"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={onToggle}
          className="mt-1.5 h-6 w-6 shrink-0 accent-primary"
          aria-label={`${item.ingredientName}を購入済みにする`}
        />

        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={expanded}
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span
              className={`text-xl font-semibold leading-tight ${
                item.checked ? "line-through opacity-70" : "text-on-surface"
              }`}
            >
              {item.ingredientName}
            </span>
            {quantitySummary && item.quantities.length === 1 ? (
              <span
                className={`text-base font-normal ${
                  item.checked ? "line-through opacity-70" : "text-on-surface"
                }`}
              >
                {quantitySummary}
              </span>
            ) : null}
          </div>

          {item.quantities.length > 1 ? (
            <ul className="mt-1 space-y-0.5 text-sm text-on-surface">
              {item.quantities.map((line, index) => (
                <li key={`${line.unit}-${line.note}-${index}`}>
                  ・{formatQuantityLine(line) || "（数量なし）"}
                </li>
              ))}
            </ul>
          ) : null}

          {sourceCount > 0 ? (
            <p className="mt-1 text-xs text-on-surface-variant">
              {sourceCount}品で使用
              <span className="ml-2">{expanded ? "▲" : "▼"}</span>
            </p>
          ) : null}

          {item.manuallyAdded ? (
            <p className="mt-1 text-xs text-on-surface-variant">手動追加</p>
          ) : null}
          {item.leftoverNote ? (
            <p className="mt-1 text-xs text-primary">{item.leftoverNote}</p>
          ) : null}

          {item.ingredientType !== "normal" ? (
            <p className="mt-1 text-xs text-on-surface-variant">
              {INGREDIENT_TYPE_LABELS[item.ingredientType]}
              {isPantry ? `・${STOCK_STATUS_LABELS[stockStatus]}` : null}
            </p>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          className="shrink-0 rounded-lg px-2 py-1 text-sm text-on-surface-variant"
          aria-label="メニュー"
        >
          ⋯
        </button>
      </div>

      {expanded && sourceCount > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-outline-variant/50 pt-3 pl-9 text-sm text-on-surface-variant">
          {item.sources.map((source, index) => (
            <li key={`${source.mealItemId ?? "x"}-${source.date}-${index}`}>
              ・{formatSourceLine(source)}
            </li>
          ))}
        </ul>
      ) : null}

      {isPantry && !item.checked && onPantryStatusChange ? (
        <div className="mt-3 pl-9">
          <p className="mb-1.5 text-xs text-on-surface-variant">在庫状態</p>
          <PantryStockButtons
            value={stockStatus}
            onChange={handlePantryChange}
            compact
          />
        </div>
      ) : null}

      {isPantry && item.checked && onRestorePantryEnough ? (
        <div className="mt-3 pl-9">
          <button
            type="button"
            onClick={onRestorePantryEnough}
            className="rounded-xl px-3 py-2 text-sm font-medium text-primary ring-1 ring-primary/30"
          >
            在庫状態を十分に戻す
          </button>
        </div>
      ) : null}

      {menuOpen ? (
        <div className="mt-3 flex gap-2 border-t border-outline-variant/50 pt-3 pl-9">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setEditing(true);
            }}
            className="rounded-xl px-3 py-2 text-sm font-medium text-primary"
          >
            編集
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              handleRemove();
            }}
            className="rounded-xl px-3 py-2 text-sm font-medium text-error"
          >
            削除
          </button>
        </div>
      ) : null}
    </li>
  );
}
