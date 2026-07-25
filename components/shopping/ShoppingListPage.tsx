"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ShoppingItemForm } from "@/components/shopping/ShoppingItemForm";
import { ShoppingListItemRow } from "@/components/shopping/ShoppingListItemRow";
import { getWeekStart, shiftWeek } from "@/lib/date";
import { getOrCreateMealPlan } from "@/lib/meal-plans";
import { setPantryStockStatus } from "@/lib/pantry-stock";
import { groupShoppingItemsByCategory } from "@/lib/shopping/group-by-category";
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
import { useIsClient } from "@/lib/use-is-client";
import { useRecipes } from "@/lib/use-recipes";
import { useShoppingList } from "@/lib/use-shopping-lists";
import { isPantryIngredientType, type StockStatus } from "@/types/ingredient-meta";
import type { ShoppingListItem } from "@/types/shopping-list";

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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
  const weekFromQuery = searchParams.get("week");
  const [weekStart, setWeekStart] = useState(
    () => weekFromQuery ?? getWeekStart(),
  );
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const list = useShoppingList(weekStart);

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
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">買い物リスト</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            献立の材料をまとめてチェックしましょう
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => updateWeek(shiftWeek(weekStart, -1))}
            className="rounded-xl px-3 py-2 text-sm font-medium text-primary"
          >
            ← 前の週
          </button>
          <p className="text-sm font-medium">
            {weekStart.split("-").join("/")} 週
          </p>
          <button
            type="button"
            onClick={() => updateWeek(shiftWeek(weekStart, 1))}
            className="rounded-xl px-3 py-2 text-sm font-medium text-primary"
          >
            次の週 →
          </button>
        </div>

        <Link
          href={`/meals`}
          className="inline-block text-sm font-medium text-primary"
        >
          献立画面を開く
        </Link>

        <button
          type="button"
          onClick={handleGenerate}
          className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary shadow-sm"
        >
          {list
            ? "献立から買い物リストを再生成"
            : "今週の献立から買い物リストを作成"}
        </button>

        {list ? (
          <div className="rounded-2xl bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
            <p>生成・更新: {formatDateTime(list.updatedAt)}</p>
            <p className="mt-1">
              未購入 {uncheckedCount}件　／　購入済み {checkedCount}件
            </p>
          </div>
        ) : null}

        {message ? (
          <p className="text-sm text-on-surface-variant" role="status">
            {message}
          </p>
        ) : null}
      </header>

      {!list ? (
        <div className="rounded-2xl bg-surface-container px-5 py-10 text-center">
          <p className="font-medium text-on-surface">
            まだ買い物リストがありません
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">
            上のボタンから、この週の献立をもとに作成できます。
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAdding((current) => !current)}
              className="rounded-xl bg-secondary-container px-4 py-2.5 text-sm font-semibold text-on-secondary-container"
            >
              {adding ? "追加を閉じる" : "項目を追加"}
            </button>
            <button
              type="button"
              onClick={handleRemoveChecked}
              disabled={checkedCount === 0}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-error ring-1 ring-error/40 disabled:opacity-40"
            >
              購入済みを削除
            </button>
            <Link
              href="/settings/pantry"
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-primary ring-1 ring-outline-variant"
            >
              常備品を管理
            </Link>
          </div>

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
