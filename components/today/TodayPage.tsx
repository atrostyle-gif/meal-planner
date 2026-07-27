"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CompactMenu } from "@/components/meals/CompactMenu";
import { TodayCollapsible } from "@/components/today/TodayCollapsible";
import { TodayMealCard } from "@/components/today/TodayMealCard";
import { getToday, formatDisplayDate, getWeekStartFromDate } from "@/lib/date";
import { getOrCreateMealPlan } from "@/lib/meal-plans";
import { buildTodayDashboardFromLocal } from "@/lib/today/dashboard";
import { useFoodBudgetSettings, useIngredientPrices } from "@/lib/use-food-budget";
import { useInventory } from "@/lib/use-inventory";
import { useIsClient } from "@/lib/use-is-client";
import { useMealPlan } from "@/lib/use-meal-plans";
import { useRecipes } from "@/lib/use-recipes";
import { useShoppingList } from "@/lib/use-shopping-lists";

function getWeekStartSafe(date: string): string {
  try {
    return getWeekStartFromDate(date);
  } catch {
    return getWeekStartFromDate(getToday());
  }
}

function yen(value: number): string {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

/** ホーム: 今日やることだけを3秒で把握 */
export function TodayPage() {
  const isClient = useIsClient();
  const router = useRouter();
  const today = getToday();
  const weekStart = getWeekStartSafe(today);
  const recipes = useRecipes();
  const inventory = useInventory();
  const shoppingList = useShoppingList(weekStart);
  const settings = useFoodBudgetSettings();
  const prices = useIngredientPrices();
  const [healthOpen, setHealthOpen] = useState(false);

  if (isClient) {
    getOrCreateMealPlan(weekStart);
  }
  const plan = useMealPlan(weekStart);

  const dashboard = useMemo(() => {
    if (!isClient) return null;
    return buildTodayDashboardFromLocal({
      date: today,
      weekStart,
      mealPlan: plan,
      recipes,
      shoppingList,
      inventory,
      budgetSettings: settings,
      // prices 変更で再計算
      priceRecords: prices,
    });
  }, [
    isClient,
    today,
    weekStart,
    plan,
    recipes,
    shoppingList,
    inventory,
    settings,
    prices,
  ]);

  if (!isClient || !dashboard) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  const moreShopping =
    dashboard.shopping.totalUnchecked - dashboard.shopping.items.length;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">今日</h1>
          <p className="text-sm text-on-surface-variant">
            {formatDisplayDate(today)}
          </p>
        </div>
        <CompactMenu
          label="その他"
          trigger={<span className="text-sm font-medium">⋯</span>}
          items={[
            {
              id: "meals",
              label: "週間献立",
              onClick: () => router.push("/meals"),
            },
            {
              id: "receipt",
              label: "レシート取込",
              onClick: () => router.push("/receipts/import"),
            },
            {
              id: "fridge",
              label: "冷蔵庫",
              onClick: () => router.push("/fridge"),
            },
          ]}
        />
      </header>

      {dashboard.tip ? (
        <p className="rounded-xl bg-secondary-container/50 px-3 py-2 text-sm text-on-secondary-container">
          {dashboard.tip}
        </p>
      ) : null}

      {/* ① 今日の献立 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">今日の献立</h2>
          <Link href="/meals" className="text-xs font-medium text-primary">
            週間
          </Link>
        </div>
        {dashboard.meals.length === 0 ? (
          <Link
            href="/meals"
            className="block rounded-2xl bg-primary px-4 py-3.5 text-center text-sm font-semibold text-on-primary"
          >
            今週の献立を作る
          </Link>
        ) : (
          <ul className="space-y-2">
            {dashboard.meals.map((meal) => (
              <TodayMealCard
                key={meal.mealItemId}
                meal={meal}
                onOpenMenu={(href) => router.push(href)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ② 買い忘れ */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">買い忘れ</h2>
          <Link href="/shopping" className="text-xs font-medium text-primary">
            もっと見る
          </Link>
        </div>
        {dashboard.shopping.items.length === 0 ? (
          <p className="rounded-2xl bg-surface-container px-3 py-2.5 text-sm text-on-surface-variant">
            なし
          </p>
        ) : (
          <ul className="space-y-1 rounded-2xl bg-surface-container-lowest px-3 py-2 ring-1 ring-outline-variant">
            {dashboard.shopping.items.map((item) => (
              <li
                key={item.id}
                className="flex justify-between gap-2 py-1 text-sm"
              >
                <span className="truncate font-medium">{item.name}</span>
                <span className="shrink-0 text-on-surface-variant">
                  {item.quantityLabel}
                </span>
              </li>
            ))}
            {moreShopping > 0 ? (
              <li className="pt-1">
                <Link href="/shopping" className="text-xs font-medium text-primary">
                  もっと見る（ほか{moreShopping}件）
                </Link>
              </li>
            ) : null}
          </ul>
        )}
      </section>

      {/* ③ 今日使う食材 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">今日使う食材</h2>
          <Link href="/fridge" className="text-xs font-medium text-primary">
            冷蔵庫
          </Link>
        </div>
        {dashboard.ingredients.length === 0 ? (
          <p className="rounded-2xl bg-surface-container px-3 py-2.5 text-sm text-on-surface-variant">
            優先なし
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {dashboard.ingredients.map((item) => (
              <li
                key={item.id}
                className="rounded-full bg-secondary-container px-3 py-1.5 text-sm font-medium text-on-secondary-container"
              >
                {item.name}
                <span className="ml-1 text-xs opacity-70">{item.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ④ 今週予算 */}
      <section className="rounded-2xl bg-surface-container-lowest px-3 py-3 ring-1 ring-outline-variant">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">今週予算</h2>
          <Link
            href="/food-expenses"
            className="text-xs font-medium text-primary"
          >
            詳細
          </Link>
        </div>
        {dashboard.budget.weeklyFoodBudgetYen == null ? (
          <p className="mt-1 text-sm text-on-surface-variant">未設定</p>
        ) : (
          <>
            <p className="mt-1 text-lg font-bold">
              残り{" "}
              {dashboard.budget.remainingBudgetYen != null
                ? yen(dashboard.budget.remainingBudgetYen)
                : "—"}
            </p>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container"
              role="progressbar"
              aria-valuenow={dashboard.budget.progressPercent ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{
                  width: `${dashboard.budget.progressPercent ?? 0}%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-on-surface-variant">
              予定{" "}
              {dashboard.budget.estimatedPurchaseCostYen != null
                ? yen(dashboard.budget.estimatedPurchaseCostYen)
                : "—"}{" "}
              / 枠 {yen(dashboard.budget.weeklyFoodBudgetYen)}
            </p>
          </>
        )}
      </section>

      {/* ⑤ 今日の健康 */}
      <section className="rounded-2xl bg-surface-container-lowest px-3 py-3 ring-1 ring-outline-variant">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          aria-expanded={healthOpen}
          onClick={() => setHealthOpen((v) => !v)}
        >
          <div>
            <h2 className="text-sm font-semibold">今日の健康</h2>
            {!dashboard.health.enabled ? (
              <p className="mt-1 text-sm text-on-surface-variant">オフ</p>
            ) : (
              <p className="mt-1 text-3xl font-bold leading-none text-primary">
                {dashboard.health.overall}
              </p>
            )}
          </div>
          <span className="text-on-surface-variant" aria-hidden>
            {healthOpen ? "▾" : "›"}
          </span>
        </button>
        {healthOpen && dashboard.health.enabled ? (
          <ul className="mt-3 space-y-1 border-t border-outline-variant/40 pt-2 text-sm">
            <li className="flex justify-between">
              <span>糖質</span>
              <span>{dashboard.health.carbohydrates}</span>
            </li>
            <li className="flex justify-between">
              <span>野菜</span>
              <span>{dashboard.health.vegetables}</span>
            </li>
            <li className="flex justify-between">
              <span>タンパク質</span>
              <span>{dashboard.health.protein}</span>
            </li>
            <li className="flex justify-between">
              <span>塩分</span>
              <span>{dashboard.health.salt}</span>
            </li>
            <li className="flex justify-between">
              <span>体重管理</span>
              <span>{dashboard.health.weightManagement}</span>
            </li>
            {dashboard.health.improvements.length > 0 ? (
              <li className="pt-1 text-on-surface-variant">
                改善候補: {dashboard.health.improvements.join(" / ")}
              </li>
            ) : null}
          </ul>
        ) : null}
      </section>

      <TodayCollapsible title="今週サマリー">
        {dashboard.weekSummary.length === 0 ? (
          <p className="text-on-surface-variant">まだデータがありません</p>
        ) : (
          <ul className="space-y-1">
            {dashboard.weekSummary.map((line) => (
              <li key={line.id}>{line.text}</li>
            ))}
          </ul>
        )}
      </TodayCollapsible>

      <TodayCollapsible title="最近">
        {dashboard.recent.length === 0 ? (
          <p className="text-on-surface-variant">まだ記録がありません</p>
        ) : (
          <ul className="space-y-1">
            {dashboard.recent.map((line) => (
              <li key={line.id}>{line.text}</li>
            ))}
          </ul>
        )}
      </TodayCollapsible>
    </div>
  );
}
