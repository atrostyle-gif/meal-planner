"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { CompactMenu } from "@/components/meals/CompactMenu";
import { ShoppingItemForm } from "@/components/shopping/ShoppingItemForm";
import { ShoppingListItemRow } from "@/components/shopping/ShoppingListItemRow";
import { getWeekStart, shiftWeek } from "@/lib/date";
import { calculateWeekBudgetSummary } from "@/lib/food-budget/week-cost";
import { getOrCreateMealPlan } from "@/lib/meal-plans";
import { setPantryStockStatus } from "@/lib/pantry-stock";
import { groupShoppingItemsByCategory } from "@/lib/shopping/group-by-category";
import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import {
  addManualShoppingItem,
  createOrRegenerateShoppingList,
  partitionShoppingItems,
  removeCheckedShoppingItems,
  removeShoppingItem,
  toggleShoppingItemChecked,
  updateShoppingItem,
  updateShoppingItemListKind,
} from "@/lib/shopping-lists";
import {
  assignStoresForShopping,
  groupAssignmentsByStore,
} from "@/lib/stores/store-assign";
import { getStoreRepository } from "@/lib/stores/store-repository";
import { useFoodBudgetSettings, useIngredientPrices } from "@/lib/use-food-budget";
import { useInventory } from "@/lib/use-inventory";
import { useIsClient } from "@/lib/use-is-client";
import { useRecipes } from "@/lib/use-recipes";
import { useShoppingList } from "@/lib/use-shopping-lists";
import { isPantryIngredientType, type StockStatus } from "@/types/ingredient-meta";
import type { ShoppingListItem } from "@/types/shopping-list";

function formatYenOptional(value: number | null): string {
  if (value == null) return "価格未登録";
  return `約${Math.round(value).toLocaleString("ja-JP")}円`;
}

function StoreGroupedPreview({
  items,
  weekStart,
  prices,
}: {
  items: ShoppingListItem[];
  weekStart: string;
  prices: ReturnType<typeof useIngredientPrices>;
}) {
  const repo = getStoreRepository();
  const stores = repo.list();
  const weekPlan = repo.getWeekPlan(weekStart);
  const assignments = assignStoresForShopping({
    ingredientNames: items.map((item) => item.ingredientName),
    stores,
    weekPlan,
    priceRecords: prices,
  });
  const groups = groupAssignmentsByStore(assignments);
  return (
    <div className="mt-3 space-y-3">
      {groups.map((group) => (
        <div key={group.storeName}>
          <p className="text-sm font-semibold">{group.storeName}</p>
          <ul className="mt-1 space-y-1 text-sm text-on-surface-variant">
            {group.items.map((item) => (
              <li key={item.ingredientName}>
                {item.ingredientName}{" "}
                {formatYenOptional(item.estimatedPriceYen)}
                {item.isReferenceOnly ? "（参考）" : ""}
              </li>
            ))}
          </ul>
          {group.items[0]?.reasons[0] ? (
            <p className="mt-1 text-xs text-on-surface-variant">
              {group.items[0].reasons[0]}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

type SectionProps = {
  title: string;
  count: number;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  hint?: string;
};

function ShoppingSection({
  title,
  count,
  children,
  collapsible = false,
  defaultOpen = true,
  hint,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="space-y-3">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <h2 className="text-base font-semibold text-on-surface">
            {title}
            <span className="ml-2 text-sm font-normal text-on-surface-variant">
              {count}
            </span>
          </h2>
          <span className="text-sm text-on-surface-variant">
            {open ? "閉じる" : "開く"}
          </span>
        </button>
      ) : (
        <h2 className="text-base font-semibold text-on-surface">
          {title}
          <span className="ml-2 text-sm font-normal text-on-surface-variant">
            {count}
          </span>
        </h2>
      )}
      {hint ? (
        <p className="text-xs text-on-surface-variant">{hint}</p>
      ) : null}
      {(!collapsible || open) && children}
    </section>
  );
}

export function ShoppingListPage() {
  const isClient = useIsClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const recipes = useRecipes();
  const inventory = useInventory();
  const settings = useFoodBudgetSettings();
  const prices = useIngredientPrices();
  const weekFromQuery = searchParams.get("week");
  const [weekStart, setWeekStart] = useState(
    () => weekFromQuery ?? getWeekStart(),
  );
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"ingredient" | "store">("ingredient");
  const [storeOpen, setStoreOpen] = useState(false);
  const list = useShoppingList(weekStart);

  const costByName = useMemo(() => {
    if (!isClient) return new Map();
    const plan = getOrCreateMealPlan(weekStart);
    const summary = calculateWeekBudgetSummary({
      mealPlan: plan,
      recipes,
      inventory,
      priceRecords: prices,
      settings,
      weeklyFoodBudgetYenOverride:
        plan.weeklyFoodBudgetYen !== undefined
          ? plan.weeklyFoodBudgetYen
          : settings.weeklyFoodBudgetYen,
    });
    return new Map(
      summary.lines.map((line) => [line.normalizedIngredientName, line]),
    );
  }, [isClient, weekStart, recipes, inventory, prices, settings]);

  if (!isClient) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  const parts = list
    ? partitionShoppingItems(list.items)
    : { buy: [], pantryCheck: [], purchased: [] };
  const uncheckedCount = parts.buy.length + parts.pantryCheck.length;
  const checkedCount = parts.purchased.length;

  function updateWeek(next: string): void {
    setWeekStart(next);
    setMessage(null);
    setAdding(false);
    router.replace(`/shopping?week=${next}`);
  }

  function handleGenerate(): void {
    const mealPlan = getOrCreateMealPlan(weekStart);
    const hasRecipeItems = mealPlan.days.some((day) =>
      day.items.some((item) => item.recipeId !== null),
    );

    if (!hasRecipeItems) {
      setMessage("この週の献立にレシピがありません。先に献立を登録してください。");
      return;
    }

    if (list) {
      const confirmed = window.confirm(
        "献立から買い物リストを再生成します。チェック状態と手動追加項目は可能な限り維持されます。",
      );
      if (!confirmed) {
        return;
      }
    }

    createOrRegenerateShoppingList(mealPlan, recipes);
    setMessage(
      list
        ? "買い物リストを再生成しました"
        : "買い物リストを作成しました",
    );
  }

  function handleRemoveChecked(): void {
    if (!list || checkedCount === 0) {
      return;
    }
    const confirmed = window.confirm("購入済みの項目をすべて削除しますか？");
    if (!confirmed) {
      return;
    }
    removeCheckedShoppingItems(weekStart);
    setMessage("購入済み項目を削除しました");
  }

  function handlePantryStatusChange(
    item: ShoppingListItem,
    status: StockStatus,
  ): void {
    if (!isPantryIngredientType(item.ingredientType)) {
      return;
    }

    setPantryStockStatus(
      item.ingredientName,
      status,
      item.ingredientType,
    );

    if (status === "enough") {
      const confirmed = window.confirm(
        `「${item.ingredientName}」は十分あるため、買い物リストから外しますか？`,
      );
      if (confirmed) {
        removeShoppingItem(weekStart, item.id);
        setMessage("常備品をリストから外しました");
      } else {
        setMessage("在庫状態を更新しました（リストには残っています）");
      }
      return;
    }

    const nextKind = status === "unknown" ? "pantryCheck" : "buy";
    updateShoppingItemListKind(weekStart, item.id, nextKind);
    setMessage("在庫状態を更新しました");
  }

  function handleRestorePantryEnough(item: ShoppingListItem): void {
    if (!isPantryIngredientType(item.ingredientType)) {
      return;
    }
    const confirmed = window.confirm(
      `「${item.ingredientName}」の在庫状態を「十分」に戻しますか？`,
    );
    if (!confirmed) {
      return;
    }
    setPantryStockStatus(
      item.ingredientName,
      "enough",
      item.ingredientType,
    );
    setMessage("在庫状態を十分に戻しました");
  }

  function renderRows(items: ShoppingListItem[], groupByCategory = false): ReactNode {
    if (items.length === 0) {
      return (
        <p className="rounded-2xl bg-surface-container px-4 py-6 text-center text-sm text-on-surface-variant">
          項目はありません
        </p>
      );
    }

    const renderItem = (item: ShoppingListItem) => (
      <ShoppingListItemRow
        key={item.id}
        item={item}
        costLine={
          costByName.get(normalizeIngredientName(item.ingredientName)) ?? null
        }
        onToggle={() => {
          toggleShoppingItemChecked(weekStart, item.id);
          setMessage(null);
        }}
        onUpdate={(input) => {
          updateShoppingItem(weekStart, item.id, input);
          setMessage("項目を更新しました");
        }}
        onRemove={() => {
          removeShoppingItem(weekStart, item.id);
          setMessage("項目を削除しました");
        }}
        onPantryStatusChange={
          isPantryIngredientType(item.ingredientType)
            ? (status) => handlePantryStatusChange(item, status)
            : undefined
        }
        onRestorePantryEnough={
          isPantryIngredientType(item.ingredientType)
            ? () => handleRestorePantryEnough(item)
            : undefined
        }
      />
    );

    if (!groupByCategory) {
      return <ul className="space-y-3">{items.map(renderItem)}</ul>;
    }

    const groups = groupShoppingItemsByCategory(items);
    return (
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.category} className="space-y-2">
            <h3 className="text-sm font-semibold text-on-surface">
              {group.category}
              <span className="ml-2 text-xs font-normal text-on-surface-variant">
                {group.items.length}
              </span>
            </h3>
            <ul className="space-y-3">{group.items.map(renderItem)}</ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">🛒 買い物</h1>
            <p className="text-sm text-on-surface-variant">
              {weekStart.split("-").join("/")} 週
              {list ? ` · 未購入 ${uncheckedCount}` : ""}
            </p>
          </div>
          <CompactMenu
            label="その他"
            trigger={<span className="text-sm font-medium">その他</span>}
            items={[
              {
                id: "prev",
                label: "前の週",
                onClick: () => updateWeek(shiftWeek(weekStart, -1)),
              },
              {
                id: "next",
                label: "次の週",
                onClick: () => updateWeek(shiftWeek(weekStart, 1)),
              },
              {
                id: "meals",
                label: "献立を開く",
                onClick: () => router.push("/meals"),
              },
              {
                id: "regen",
                label: list ? "リストを再生成" : "リストを作成",
                onClick: handleGenerate,
              },
              {
                id: "remove-checked",
                label: "購入済みを削除",
                onClick: handleRemoveChecked,
                disabled: checkedCount === 0,
                danger: true,
              },
              {
                id: "view",
                label: viewMode === "ingredient" ? "店舗別表示" : "食材別表示",
                onClick: () =>
                  setViewMode((mode) =>
                    mode === "ingredient" ? "store" : "ingredient",
                  ),
              },
              {
                id: "pantry",
                label: "常備品",
                onClick: () => router.push("/settings/pantry"),
              },
              {
                id: "receipt",
                label: "レシート取込",
                onClick: () => router.push("/receipts/import"),
              },
            ]}
          />
        </div>

        {!list ? (
          <button
            type="button"
            onClick={handleGenerate}
            className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary shadow-sm"
          >
            献立からリストを作成
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAdding((current) => !current)}
            className="w-full rounded-2xl bg-secondary-container px-4 py-3 text-sm font-semibold text-on-secondary-container"
          >
            {adding ? "追加を閉じる" : "＋ 項目を追加"}
          </button>
        )}

        {message ? (
          <p className="text-sm text-on-surface-variant" role="status">
            {message}
          </p>
        ) : null}
      </header>

      {!list ? (
        <div className="rounded-2xl bg-surface-container px-5 py-8 text-center">
          <p className="font-medium">リストがありません</p>
        </div>
      ) : (
        <>
          {viewMode === "store" && parts.buy.length > 0 ? (
            <section className="rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
              <button
                type="button"
                onClick={() => setStoreOpen((v) => !v)}
                className="w-full text-left text-sm font-semibold"
              >
                店舗別の目安 {storeOpen ? "▲" : "▼"}
              </button>
              {storeOpen ? (
                <StoreGroupedPreview
                  items={parts.buy}
                  weekStart={weekStart}
                  prices={prices}
                />
              ) : (
                <p className="mt-1 text-xs text-on-surface-variant">
                  タップで店舗ごとの買い物目安を表示
                </p>
              )}
            </section>
          ) : null}

          {adding ? (
            <section className="rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
              <h2 className="mb-3 text-sm font-medium">手動で追加</h2>
              <ShoppingItemForm
                submitLabel="追加する"
                onCancel={() => setAdding(false)}
                onSubmit={(input) => {
                  addManualShoppingItem(weekStart, input);
                  setAdding(false);
                  setMessage("項目を追加しました");
                }}
              />
            </section>
          ) : null}

          {list.items.length === 0 ? (
            <div className="rounded-2xl bg-surface-container px-5 py-10 text-center text-sm text-on-surface-variant">
              項目がありません。再生成するか、手動で追加してください。
            </div>
          ) : (
            <div className="space-y-8">
              <ShoppingSection title="買うもの" count={parts.buy.length}>
                {renderRows(parts.buy, true)}
              </ShoppingSection>

              <ShoppingSection
                title="常備品の確認"
                count={parts.pantryCheck.length}
                hint="在庫が未確認の常備調味料・常備食品です。状態を選ぶとリストの扱いが変わります。"
              >
                {renderRows(parts.pantryCheck)}
              </ShoppingSection>

              <ShoppingSection
                title="購入済み"
                count={parts.purchased.length}
                collapsible
                defaultOpen={false}
              >
                {renderRows(parts.purchased)}
              </ShoppingSection>
            </div>
          )}
        </>
      )}
    </div>
  );
}
