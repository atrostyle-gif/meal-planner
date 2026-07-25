"use client";

import { useEffect } from "react";
import { removeSampleRecipes, resetSampleRecipes } from "@/lib/recipes";

type MealPlannerDevApi = {
  /** サンプルを削除し、100件を入れ直す（ユーザー作成レシピは残す） */
  resetSampleRecipes: () => number;
  /** サンプルのみ削除する */
  removeSampleRecipes: () => number;
};

declare global {
  interface Window {
    __mealPlanner?: MealPlannerDevApi;
  }
}

/**
 * ブラウザコンソールからサンプル操作できるようにする開発用ヘルパー。
 * 使い方:
 *   __mealPlanner.resetSampleRecipes()
 */
export function DevConsoleHelpers() {
  useEffect(() => {
    window.__mealPlanner = {
      resetSampleRecipes: () => {
        const count = resetSampleRecipes();
        console.info(`[meal-planner] サンプルを ${count} 件入れ直しました`);
        return count;
      },
      removeSampleRecipes: () => {
        const removed = removeSampleRecipes();
        console.info(`[meal-planner] サンプルを ${removed} 件削除しました`);
        return removed;
      },
    };

    return () => {
      delete window.__mealPlanner;
    };
  }, []);

  return null;
}
