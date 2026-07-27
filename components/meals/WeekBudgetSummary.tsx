"use client";

import { useMemo, useState } from "react";
import {
  resolveWeekFoodBudget,
  saveWeekBudgetOverride,
} from "@/lib/food-budget/settings";
import { calculateWeekBudgetSummary } from "@/lib/food-budget/week-cost";
import { formatGramsLabel, formatQuantityWithUnit } from "@/lib/food-budget/unit-convert";
import { updateMealPlanBudget } from "@/lib/meal-plans";
import { useFoodBudgetSettings, useIngredientPrices } from "@/lib/use-food-budget";
import type { InventoryItem } from "@/types/inventory";
import type { MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import {
  BUDGET_MODE_LABELS,
  BUDGET_MODES,
  type BudgetMode,
} from "@/types/food-budget";

type WeekBudgetSummaryProps = {
  mealPlan: MealPlan;
  recipes: Recipe[];
  inventory: InventoryItem[];
};

function formatYen(value: number | null): string {
  if (value === null) return "価格未登録";
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

export function WeekBudgetSummaryPanel({
  mealPlan,
  recipes,
  inventory,
}: WeekBudgetSummaryProps) {
  const settings = useFoodBudgetSettings();
  const prices = useIngredientPrices();
  const [open, setOpen] = useState(false);
  const resolvedBudget = resolveWeekFoodBudget(
    mealPlan.weekStart,
    mealPlan.weeklyFoodBudgetYen,
    settings,
  );
  const [budgetInput, setBudgetInput] = useState(
    resolvedBudget?.toString() ?? "",
  );

  const summary = useMemo(
    () =>
      calculateWeekBudgetSummary({
        mealPlan,
        recipes,
        inventory,
        priceRecords: prices,
        settings,
        weeklyFoodBudgetYenOverride: resolveWeekFoodBudget(
          mealPlan.weekStart,
          mealPlan.weeklyFoodBudgetYen,
          settings,
        ),
      }),
    [mealPlan, recipes, inventory, prices, settings],
  );

  const mode =
    settings.weekBudgetOverrides[mealPlan.weekStart]?.budgetMode ??
    mealPlan.budgetMode ??
    settings.budgetMode;

  function saveWeekBudget(): void {
    const yen =
      budgetInput.trim() === "" ? null : Number(budgetInput);
    if (yen !== null && (!Number.isFinite(yen) || yen < 0)) {
      return;
    }
    saveWeekBudgetOverride(mealPlan.weekStart, {
      weeklyFoodBudgetYen: yen,
    });
    updateMealPlanBudget(mealPlan.weekStart, {
      weeklyFoodBudgetYen: yen,
    });
  }

  return (
    <section className="space-y-2 rounded-2xl bg-surface-container-lowest p-3 ring-1 ring-outline-variant">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-xs text-on-surface-variant">💰 今週の予算</p>
          <p className="text-lg font-bold">
            残り{" "}
            {summary.remainingBudgetYen == null
              ? "—"
              : formatYen(summary.remainingBudgetYen)}
          </p>
          <p className="text-xs text-on-surface-variant">
            予定 {formatYen(summary.estimatedPurchaseCostYen)}
            {" / "}
            枠 {formatYen(summary.weeklyFoodBudgetYen)}
          </p>
        </div>
        <span className="text-xs font-medium text-primary">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {summary.unpricedLineCount > 0 && open ? (
        <p className="text-xs text-on-surface-variant">
          価格未登録 {summary.unpricedLineCount}件
        </p>
      ) : null}

      {open ? (
        <div className="space-y-4 border-t border-outline-variant/50 pt-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(mode === "consumed_cost" || mode === "both") && (
              <div>
                <p className="text-on-surface-variant">今週使用分</p>
                <p className="font-semibold">
                  {formatYen(summary.estimatedConsumedCostYen)}
                </p>
              </div>
            )}
            <div>
              <p className="text-on-surface-variant">来週へ残る分</p>
              <p className="font-semibold">
                {formatYen(summary.estimatedCarryoverValueYen)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block space-y-1 text-sm">
              <span className="text-on-surface-variant">この週の予算</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={budgetInput}
                  onChange={(event) => setBudgetInput(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl bg-surface-container px-3 py-2"
                />
                <button
                  type="button"
                  onClick={saveWeekBudget}
                  className="shrink-0 rounded-xl bg-secondary-container px-3 py-2 text-sm font-semibold text-on-secondary-container"
                >
                  更新
                </button>
              </div>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-on-surface-variant">表示モード</span>
              <select
                value={mode}
                onChange={(event) => {
                  const next = event.target.value as BudgetMode;
                  saveWeekBudgetOverride(mealPlan.weekStart, {
                    weeklyFoodBudgetYen: resolvedBudget,
                    budgetMode: next,
                  });
                  updateMealPlanBudget(mealPlan.weekStart, {
                    budgetMode: next,
                  });
                }}
                className="w-full rounded-xl bg-surface-container px-3 py-2"
              >
                {BUDGET_MODES.map((item) => (
                  <option key={item} value={item}>
                    {BUDGET_MODE_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {summary.bulkSuggestions.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">大容量パックの配分</h3>
              <ul className="space-y-2">
                {summary.bulkSuggestions.map((item) => (
                  <li
                    key={item.ingredientName}
                    className="rounded-xl bg-surface-container px-3 py-2"
                  >
                    <details>
                      <summary className="cursor-pointer text-sm">
                        <span className="font-medium">{item.summary}</span>
                        <span className="ml-2 text-on-surface-variant">
                          {item.leftoverSummary}
                        </span>
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs text-on-surface-variant">
                        {item.days.map((day, index) => (
                          <li key={`${day.date}-${day.recipeName}-${index}`}>
                            {day.date.slice(5).replace("-", "/")} {day.recipeName}{" "}
                            {day.quantityLabel}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">食材ごとの内訳</h3>
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {summary.lines
                .filter((line) => !line.purchaseSkipped || (line.consumedGrams ?? 0) > 0)
                .slice(0, 40)
                .map((line) => (
                  <li
                    key={line.normalizedIngredientName}
                    className="rounded-xl bg-surface-container px-3 py-2 text-sm"
                  >
                    <p className="font-medium">{line.ingredientName}</p>
                    <p className="text-xs text-on-surface-variant">
                      購入{" "}
                      {line.purchaseGrams
                        ? formatGramsLabel(line.purchaseGrams)
                        : "なし"}
                      ／使用{" "}
                      {line.consumedGrams != null
                        ? formatGramsLabel(line.consumedGrams)
                        : formatQuantityWithUnit(
                            line.consumedQuantity,
                            line.consumedUnit,
                          )}
                      {line.carryoverGrams
                        ? `／繰越 ${formatGramsLabel(line.carryoverGrams)}`
                        : ""}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {line.priceMissing
                        ? "価格未登録"
                        : `購入 ${formatYen(line.estimatedPurchaseCostYen)} / 使用 ${formatYen(line.estimatedConsumedCostYen)}`}
                    </p>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
