"use client";

import { useState, type FormEvent } from "react";
import {
  DEFAULT_INGREDIENT_TYPE,
  INGREDIENT_TYPES,
  INGREDIENT_TYPE_LABELS,
  INGREDIENT_UNITS,
  type IngredientType,
} from "@/types/recipe";
import type { ShoppingListItemInput } from "@/types/shopping-list";

type ShoppingItemFormProps = {
  initial?: ShoppingListItemInput;
  submitLabel: string;
  onSubmit: (input: ShoppingListItemInput) => void;
  onCancel?: () => void;
};

export function ShoppingItemForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: ShoppingItemFormProps) {
  const [ingredientName, setIngredientName] = useState(initial?.ingredientName ?? "");
  const [quantityText, setQuantityText] = useState(
    initial?.quantity == null ? "" : String(initial.quantity),
  );
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [ingredientType, setIngredientType] = useState<IngredientType>(
    initial?.ingredientType ?? DEFAULT_INGREDIENT_TYPE,
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (ingredientName.trim() === "") {
      setError("名前を入力してください。");
      return;
    }

    let quantity: number | null = null;
    if (quantityText.trim() !== "") {
      const parsed = Number(quantityText);
      if (!Number.isFinite(parsed)) {
        setError("数量は数値で入力してください。");
        return;
      }
      quantity = parsed;
    }

    setError(null);
    onSubmit({
      ingredientName,
      quantity,
      unit,
      note,
      ingredientType,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        value={ingredientName}
        onChange={(event) => setIngredientName(event.target.value)}
        className="w-full rounded-xl border-0 bg-surface-container px-3 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
        placeholder="食材名・日用品名"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          value={quantityText}
          onChange={(event) => setQuantityText(event.target.value)}
          className="w-full rounded-xl border-0 bg-surface-container px-3 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          placeholder="数量"
        />
        <input
          type="text"
          list="shopping-unit-options"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          className="w-full rounded-xl border-0 bg-surface-container px-3 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          placeholder="単位"
        />
      </div>
      <datalist id="shopping-unit-options">
        {INGREDIENT_UNITS.map((entry) => (
          <option key={entry} value={entry} />
        ))}
      </datalist>
      <input
        type="text"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className="w-full rounded-xl border-0 bg-surface-container px-3 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
        placeholder="メモ（任意）"
      />
      <label className="block space-y-1">
        <span className="text-xs font-medium text-on-surface-variant">在庫区分</span>
        <select
          value={ingredientType}
          onChange={(event) =>
            setIngredientType(event.target.value as IngredientType)
          }
          className="w-full rounded-xl border-0 bg-surface-container px-3 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
        >
          {INGREDIENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {INGREDIENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <div className="flex gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl px-3 py-3 text-sm font-medium text-on-surface-variant"
          >
            キャンセル
          </button>
        ) : null}
        <button
          type="submit"
          className="flex-1 rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-on-primary"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
