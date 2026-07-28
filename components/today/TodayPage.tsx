"use client";

import { useMemo, useState } from "react";
import { TodayCookReviewPanel } from "@/components/today/TodayCookReviewPanel";
import { TodayDinnerCard } from "@/components/today/TodayDinnerCard";
import { getToday, formatDisplayDate, getWeekStartFromDate } from "@/lib/date";
import {
  getOrCreateMealPlan,
  resetDayMealServings,
  setDayMealServings,
} from "@/lib/meal-plans";
import { createOrRegenerateShoppingList } from "@/lib/shopping-lists";
import { buildTodayDashboardFromLocal } from "@/lib/today/dashboard";
import { useIsClient } from "@/lib/use-is-client";
import { useMealPlan } from "@/lib/use-meal-plans";
import { useHouseholdPreferences } from "@/lib/use-meal-preferences";
import { useRecipes } from "@/lib/use-recipes";
import { useShoppingList } from "@/lib/use-shopping-lists";

function getWeekStartSafe(date: string): string {
  try {
    return getWeekStartFromDate(date);
  } catch {
    return getWeekStartFromDate(getToday());
  }
}

/** ホーム: 今日の夕食を作ることだけに集中 */
export function TodayPage() {
  const isClient = useIsClient();
  const today = getToday();
  const weekStart = getWeekStartSafe(today);
  const recipes = useRecipes();
  const shoppingList = useShoppingList(weekStart);
  const { preferences } = useHouseholdPreferences();
  const [reviewTick, setReviewTick] = useState(0);

  if (isClient) {
    getOrCreateMealPlan(weekStart);
  }
  const plan = useMealPlan(weekStart);

  const dashboard = useMemo(() => {
    if (!isClient) return null;
    // reviewTick: レビュー保存後にフィードバックを再読込する
    void reviewTick;
    return buildTodayDashboardFromLocal({
      date: today,
      weekStart,
      mealPlan: plan,
      recipes,
      defaultMealServings: preferences.defaultMealServings,
    });
  }, [
    isClient,
    today,
    weekStart,
    plan,
    recipes,
    reviewTick,
    preferences.defaultMealServings,
  ]);

  if (!isClient || !dashboard) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  function refreshShopping(updatedPlan: typeof plan): void {
    if (shoppingList) {
      createOrRegenerateShoppingList(updatedPlan, recipes);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">今日</h1>
        <p className="text-sm text-on-surface-variant">
          {formatDisplayDate(today)}
        </p>
      </header>

      <TodayDinnerCard
        dishes={dashboard.dishes}
        servings={dashboard.servings}
        servingsIsCustom={dashboard.servingsIsCustom}
        defaultMealServings={dashboard.defaultMealServings}
        cookingTimeMinutes={dashboard.cookingTimeMinutes}
        primaryCook={dashboard.primaryCook}
        decisionReasons={dashboard.decisionReasons}
        onChangeServings={(servings) => {
          const updated = setDayMealServings(
            weekStart,
            today,
            servings,
            preferences.defaultMealServings,
          );
          refreshShopping(updated);
        }}
        onResetServings={() => {
          const updated = resetDayMealServings(weekStart, today);
          refreshShopping(updated);
        }}
      />

      {dashboard.primaryCook &&
      (dashboard.reviewStatus === "ready" ||
        dashboard.reviewStatus === "done") ? (
        <TodayCookReviewPanel
          primaryCook={dashboard.primaryCook}
          mode={dashboard.reviewStatus === "done" ? "done" : "ready"}
          summary={dashboard.reviewSummary}
          onSaved={() => setReviewTick((n) => n + 1)}
        />
      ) : null}
    </div>
  );
}
