"use client";

import { useMemo, useState, type FormEvent } from "react";
import { PantryStockButtons } from "@/components/shopping/PantryStockButtons";
import { findIngredientTypeByName } from "@/lib/ingredient-type-lookup";
import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import { upsertPantryStock } from "@/lib/pantry-stock";
import { usePantryStock } from "@/lib/use-pantry-stock";
import { useRecipes } from "@/lib/use-recipes";
import {
  DEFAULT_STOCK_STATUS,
  INGREDIENT_TYPE_LABELS,
  STOCK_STATUS_LABELS,
  isPantryIngredientType,
  type IngredientType,
  type StockStatus,
} from "@/types/ingredient-meta";

type SuggestedPantry = {
  name: string;
  ingredientType: Extract<IngredientType, "pantrySeasoning" | "pantryFood">;
};

export function PantryStockSection() {
  const pantryItems = usePantryStock();
  const recipes = useRecipes();
  const [name, setName] = useState("");
  const [ingredientType, setIngredientType] = useState<
    "pantrySeasoning" | "pantryFood"
  >("pantrySeasoning");
  const [stockStatus, setStockStatus] = useState<StockStatus>(DEFAULT_STOCK_STATUS);
  const [message, setMessage] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const map = new Map<string, SuggestedPantry>();
    for (const recipe of recipes) {
      for (const ingredient of recipe.ingredients) {
        const type = ingredient.ingredientType;
        if (!isPantryIngredientType(type)) {
          continue;
        }
        const key = normalizeIngredientName(ingredient.name);
        if (key === "" || map.has(key)) {
          continue;
        }
        map.set(key, {
          name: ingredient.name.trim(),
          ingredientType: type,
        });
      }
    }
    return [...map.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "ja"),
    );
  }, [recipes]);

  const registeredKeys = new Set(pantryItems.map((item) => item.key));
  const unregistered = suggestions.filter(
    (item) => !registeredKeys.has(normalizeIngredientName(item.name)),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (name.trim() === "") {
      setMessage("名前を入力してください");
      return;
    }
    const saved = upsertPantryStock({
      displayName: name,
      ingredientType,
      stockStatus,
    });
    if (!saved) {
      setMessage("保存に失敗しました");
      return;
    }
    setName("");
    setStockStatus(DEFAULT_STOCK_STATUS);
    setMessage("常備品を保存しました");
  }

  function handleQuickAdd(item: SuggestedPantry): void {
    upsertPantryStock({
      displayName: item.name,
      ingredientType: item.ingredientType,
      stockStatus: DEFAULT_STOCK_STATUS,
    });
    setMessage(`「${item.name}」を未確認で登録しました`);
  }

  return (
    <section className="space-y-4 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
      <div>
        <h2 className="text-lg font-semibold text-on-surface">常備品の在庫</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          調味料・常備食品の残り具合を管理します（正確な残量計算はしません）
        </p>
      </div>

      {pantryItems.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          まだ常備品の状態がありません
        </p>
      ) : (
        <ul className="space-y-3">
          {pantryItems.map((item) => (
            <li
              key={item.key}
              className="space-y-2 rounded-xl bg-surface-container px-3 py-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-base font-semibold">{item.displayName}</p>
                <p className="text-xs text-on-surface-variant">
                  {INGREDIENT_TYPE_LABELS[item.ingredientType]}・
                  {STOCK_STATUS_LABELS[item.stockStatus]}
                </p>
              </div>
              <PantryStockButtons
                value={item.stockStatus}
                onChange={(status) => {
                  upsertPantryStock({
                    displayName: item.displayName,
                    ingredientType: item.ingredientType,
                    stockStatus: status,
                  });
                }}
                compact
              />
            </li>
          ))}
        </ul>
      )}

      {unregistered.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-on-surface-variant">
            レシピにある未登録の常備品
          </p>
          <div className="flex flex-wrap gap-2">
            {unregistered.slice(0, 12).map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => handleQuickAdd(item)}
                className="rounded-lg bg-secondary-container px-2.5 py-1.5 text-xs font-medium text-on-secondary-container"
              >
                ＋ {item.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-2 border-t border-outline-variant/50 pt-3">
        <p className="text-xs font-medium text-on-surface-variant">常備品を追加</p>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            const known = findIngredientTypeByName(name, recipes);
            if (known === "pantryFood" || known === "pantrySeasoning") {
              setIngredientType(known);
            }
          }}
          className="w-full rounded-xl border-0 bg-surface-container px-3 py-2.5 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          placeholder="例: しょうゆ"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={ingredientType}
            onChange={(event) =>
              setIngredientType(
                event.target.value as "pantrySeasoning" | "pantryFood",
              )
            }
            className="w-full rounded-xl border-0 bg-surface-container px-3 py-2.5 text-sm outline-none ring-1 ring-outline-variant"
          >
            <option value="pantrySeasoning">常備調味料</option>
            <option value="pantryFood">常備食品</option>
          </select>
          <select
            value={stockStatus}
            onChange={(event) =>
              setStockStatus(event.target.value as StockStatus)
            }
            className="w-full rounded-xl border-0 bg-surface-container px-3 py-2.5 text-sm outline-none ring-1 ring-outline-variant"
          >
            {(["enough", "low", "empty", "unknown"] as const).map((status) => (
              <option key={status} value={status}>
                {STOCK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-on-primary"
        >
          保存する
        </button>
      </form>

      {message ? (
        <p className="text-xs text-on-surface-variant" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
