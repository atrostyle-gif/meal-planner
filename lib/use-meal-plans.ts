"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getWeekDates } from "@/lib/date";
import {
  getMealPlansServerSnapshot,
  getMealPlansSnapshot,
  subscribeMealPlans,
} from "@/lib/meal-plans";
import type { MealPlan } from "@/types/meal-plan";

/** localStorage 上の献立一覧を購読する */
export function useMealPlans(): MealPlan[] {
  return useSyncExternalStore(
    subscribeMealPlans,
    getMealPlansSnapshot,
    getMealPlansServerSnapshot,
  );
}

/** 指定週の献立。未保存なら画面用の空データを返す（初回編集で保存） */
export function useMealPlan(weekStart: string): MealPlan {
  const plans = useMealPlans();
  const saved = plans.find((plan) => plan.weekStart === weekStart);

  const emptyPlan = useMemo<MealPlan>(() => {
    const now = new Date().toISOString();
    return {
      id: `temp-${weekStart}`,
      weekStart,
      days: getWeekDates(weekStart).map((date) => ({
        date,
        locked: false,
        items: [],
      })),
      createdAt: now,
      updatedAt: now,
    };
  }, [weekStart]);

  return saved ?? emptyPlan;
}
