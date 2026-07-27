"use client";

import { useState } from "react";
import { PantryStockButtons } from "@/components/shopping/PantryStockButtons";
import { ShoppingItemForm } from "@/components/shopping/ShoppingItemForm";
import {
  countShoppingSources,
  formatGroupQuantitySummary,
  formatQuantityLine,
  formatSourceLine,
  hasShoppingQuantityNotes,
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
import { formatGramsLabel } from "@/lib/food-budget/unit-convert";
import {
  analyzeIngredientPrice,
  shortAssessmentPhrase,
} from "@/lib/price-learning";
import { loadIngredientPrices } from "@/lib/food-budget/prices";
import type { IngredientCostLine } from "@/types/food-budget";
import type { ShoppingListItem, ShoppingListItemInput } from "@/types/shopping-list";

type ShoppingListItemRowProps = {
  item: ShoppingListItem;
  onToggle: () => void;
  onUpdate: (input: ShoppingListItemInput) => void;
  onRemove: () => void;
  onPantryStatusChange?: (status: StockStatus) => void;
  onRestorePantryEnough?: () => void;
  /** 購入・使用・繰越の見積（任意） */
  costLine?: IngredientCostLine | null;
};

function formatYen(value: number | null | undefined): string {
  if (value == null) return "価格未登録";
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

export function ShoppingListItemRow({
  item,
  onToggle,
  onUpdate,
  onRemove,
  onPantryStatusChange,
  onRestorePantryEnough,
  costLine = null,
}: ShoppingListItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const stockStatus = usePantryStockStatus(item.ingredientName);
  const isPantry = isPantryIngredientType(item.ingredientType);
  const sourceCount = countShoppingSources(item);
  const quantitySummary = formatGroupQuantitySummary(item);
  const hasNotes = hasShoppingQuantityNotes(item);
  const firstQuantity = item.quantities[0] ?? {
    quantity: null,
    unit: "",
    note: "",
  };
  const hasDetail =
    sourceCount > 0 ||
    item.manuallyAdded ||
    Boolean(item.leftoverNote) ||
    item.ingredientType !== "normal" ||
    item.quantities.length > 1 ||
    hasNotes ||
    Boolean(costLine) ||
    (isPantry && !item.checked && Boolean(onPantryStatusChange)) ||
    (isPantry && item.checked && Boolean(onRestorePantryEnough));

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
      <li className="overflow-hidden rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
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
      className={`overflow-hidden rounded-2xl p-3 ring-1 ${
        item.checked
          ? "bg-surface-container text-on-surface-variant ring-outline-variant"
          : "bg-surface-container-lowest ring-outline-variant"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={onToggle}
          className="h-6 w-6 shrink-0 accent-primary"
          aria-label={`${item.ingredientName}を購入済みにする`}
        />

        <button
          type="button"
          onClick={() => {
            if (hasDetail) {
              setExpanded((current) => !current);
            }
          }}
          className="min-w-0 flex-1 overflow-hidden text-left"
          aria-expanded={hasDetail ? expanded : undefined}
          disabled={!hasDetail}
        >
          <div className="flex min-w-0 items-baseline gap-2">
            <span
              className={`min-w-0 flex-1 truncate text-base font-semibold leading-tight ${
                item.checked ? "line-through opacity-70" : "text-on-surface"
              }`}
            >
              {item.ingredientName}
            </span>
            {quantitySummary ? (
              <span
                className={`max-w-[40%] shrink-0 truncate text-sm ${
                  item.checked
                    ? "line-through opacity-70"
                    : "text-on-surface-variant"
                }`}
              >
                {quantitySummary}
              </span>
            ) : null}
            {costLine && !costLine.priceMissing && costLine.estimatedPurchaseCostYen != null ? (
              <span className="max-w-[30%] shrink-0 truncate text-xs text-on-surface-variant">
                {formatYen(costLine.estimatedPurchaseCostYen)}
              </span>
            ) : null}
            {hasDetail ? (
              <span
                className="shrink-0 text-lg leading-none text-on-surface-variant"
                aria-hidden
              >
                {expanded ? "▾" : "›"}
              </span>
            ) : null}
          </div>
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

      {expanded && hasDetail ? (
        <div className="mt-3 min-w-0 space-y-3 overflow-hidden border-t border-outline-variant/50 pt-3 pl-9">
          {costLine ? (
            <div className="space-y-1 break-words text-sm text-on-surface">
              <p>
                購入{" "}
                {costLine.purchaseGrams
                  ? formatGramsLabel(costLine.purchaseGrams)
                  : "なし"}
                ／今週使用{" "}
                {costLine.consumedGrams != null
                  ? formatGramsLabel(costLine.consumedGrams)
                  : quantitySummary || "—"}
                {costLine.carryoverGrams
                  ? `／${costLine.freezeCarryover ? "冷凍" : "繰越"} ${formatGramsLabel(costLine.carryoverGrams)}`
                  : ""}
              </p>
              <p className="text-xs text-on-surface-variant">
                予想{" "}
                {costLine.priceMissing
                  ? "価格未登録"
                  : formatYen(costLine.estimatedPurchaseCostYen)}
                {costLine.pricePer100g != null
                  ? `・100gあたり ${formatYen(costLine.pricePer100g)}`
                  : ""}
              </p>
              {costLine.priceStoreName && costLine.pricePurchasedAt ? (
                <p className="text-xs text-on-surface-variant">
                  {costLine.priceStoreName}直近価格・
                  {new Date(costLine.pricePurchasedAt).toLocaleDateString("ja-JP")}
                </p>
              ) : null}
              {(() => {
                const analysis = analyzeIngredientPrice(
                  item.ingredientName,
                  loadIngredientPrices(),
                  costLine.priceStoreName,
                );
                if (analysis.sampleCount === 0) {
                  return (
                    <p className="text-xs text-on-surface-variant">価格未登録</p>
                  );
                }
                const phrase = shortAssessmentPhrase(analysis.priceAssessment);
                return (
                  <p className="text-xs text-on-surface-variant">
                    {phrase ? `${phrase}・` : ""}
                    {analysis.sparseData
                      ? "価格データがまだ少ないです"
                      : `90日中央値 ${
                          analysis.medianPrice90Days != null
                            ? `${Math.round(analysis.medianPrice90Days)}円／100g`
                            : "—"
                        }・登録${analysis.sampleCount}回`}
                    {analysis.lowestPrice90Days != null
                      ? `・最安 ${Math.round(analysis.lowestPrice90Days)}円／100g`
                      : ""}
                  </p>
                );
              })()}
            </div>
          ) : null}

          {item.quantities.length > 0 &&
          (item.quantities.length > 1 || hasNotes) ? (
            <ul className="space-y-0.5 break-words text-sm text-on-surface">
              {item.quantities.map((line, index) => (
                <li key={`${line.unit}-${line.note}-${index}`}>
                  ・{formatQuantityLine(line) || "（数量なし）"}
                </li>
              ))}
            </ul>
          ) : null}

          {item.manuallyAdded ? (
            <p className="text-xs text-on-surface-variant">手動追加</p>
          ) : null}
          {item.leftoverNote ? (
            <p className="break-words text-xs text-primary">{item.leftoverNote}</p>
          ) : null}

          {item.ingredientType !== "normal" ? (
            <p className="text-xs text-on-surface-variant">
              {INGREDIENT_TYPE_LABELS[item.ingredientType]}
              {isPantry ? `・${STOCK_STATUS_LABELS[stockStatus]}` : null}
            </p>
          ) : null}

          {sourceCount > 0 ? (
            <div className="min-w-0">
              <p className="text-xs text-on-surface-variant">
                {sourceCount}品で使用
              </p>
              <ul className="mt-1.5 space-y-1.5 break-words text-sm text-on-surface-variant">
                {item.sources.map((source, index) => (
                  <li key={`${source.mealItemId ?? "x"}-${source.date}-${index}`}>
                    ・{formatSourceLine(source)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {isPantry && !item.checked && onPantryStatusChange ? (
            <div>
              <p className="mb-1.5 text-xs text-on-surface-variant">在庫状態</p>
              <PantryStockButtons
                value={stockStatus}
                onChange={handlePantryChange}
                compact
              />
            </div>
          ) : null}

          {isPantry && item.checked && onRestorePantryEnough ? (
            <button
              type="button"
              onClick={onRestorePantryEnough}
              className="rounded-xl px-3 py-2 text-sm font-medium text-primary ring-1 ring-primary/30"
            >
              在庫状態を十分に戻す
            </button>
          ) : null}
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
