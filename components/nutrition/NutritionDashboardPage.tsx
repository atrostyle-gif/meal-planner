"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getWeekStart } from "@/lib/date";
import { loadFoodMasters } from "@/lib/food-master/store";
import {
  getCachedRecipeNutrition,
  sumDayNutrition,
} from "@/lib/nutrition/calculate";
import { useIsClient } from "@/lib/use-is-client";
import { useMealPlan } from "@/lib/use-meal-plans";
import { useRecipes } from "@/lib/use-recipes";
import type { NutritionAmount } from "@/types/food-master";

type Status = "良好" | "やや不足" | "やや多い" | "要確認" | "計算不足";

function statusFor(
  key: keyof NutritionAmount,
  value: number,
  confidence: number,
): Status {
  if (confidence < 0.3) return "計算不足";
  if (key === "calories") {
    if (value < 400) return "やや不足";
    if (value > 1000) return "やや多い";
    return "良好";
  }
  if (key === "protein") {
    if (value < 15) return "やや不足";
    if (value > 60) return "やや多い";
    return "良好";
  }
  if (key === "saltEquivalent") {
    if (value > 4) return "やや多い";
    if (value > 3) return "要確認";
    return "良好";
  }
  if (key === "vegetables") {
    if (value < 80) return "やや不足";
    return "良好";
  }
  if (key === "fiber") {
    if (value < 5) return "やや不足";
    return "良好";
  }
  if (key === "calcium" && value < 100) return "やや不足";
  if (key === "iron" && value < 2) return "やや不足";
  return "良好";
}

function statusClass(status: Status): string {
  switch (status) {
    case "良好":
      return "text-primary";
    case "やや不足":
    case "やや多い":
      return "text-on-surface";
    case "要確認":
      return "text-error";
    default:
      return "text-on-surface-variant";
  }
}

export function NutritionDashboardPage() {
  const isClient = useIsClient();
  const weekStart = getWeekStart();
  const plan = useMealPlan(weekStart);
  const recipes = useRecipes();

  const summary = useMemo(() => {
    if (!isClient) return null;
    const masters = loadFoodMasters();
    const dayResults = plan.days.map((day) => {
      const nuts = day.items
        .map((item) => {
          if (!item.recipeId) return null;
          const recipe = recipes.find((r) => r.id === item.recipeId);
          if (!recipe) return null;
          return getCachedRecipeNutrition(recipe, {
            masters,
            servingsOverride: item.servingsOverride,
          });
        })
        .filter((n): n is NonNullable<typeof n> => n !== null);
      const total = sumDayNutrition(nuts);
      const confidence =
        nuts.length === 0
          ? 0
          : nuts.reduce((s, n) => s + n.confidence, 0) / nuts.length;
      return { date: day.date, total, confidence, nuts };
    });

    const weekTotal = dayResults.reduce(
      (sum, day) => ({
        calories: sum.calories + day.total.calories,
        protein: sum.protein + day.total.protein,
        fat: sum.fat + day.total.fat,
        carbohydrates: sum.carbohydrates + day.total.carbohydrates,
        fiber: sum.fiber + day.total.fiber,
        saltEquivalent: sum.saltEquivalent + day.total.saltEquivalent,
        calcium: sum.calcium + day.total.calcium,
        iron: sum.iron + day.total.iron,
        vitaminA: sum.vitaminA + day.total.vitaminA,
        vitaminB1: sum.vitaminB1 + day.total.vitaminB1,
        vitaminB2: sum.vitaminB2 + day.total.vitaminB2,
        vitaminC: sum.vitaminC + day.total.vitaminC,
        vegetables: sum.vegetables + day.total.vegetables,
      }),
      {
        calories: 0,
        protein: 0,
        fat: 0,
        carbohydrates: 0,
        fiber: 0,
        saltEquivalent: 0,
        calcium: 0,
        iron: 0,
        vitaminA: 0,
        vitaminB1: 0,
        vitaminB2: 0,
        vitaminC: 0,
        vegetables: 0,
      } satisfies NutritionAmount,
    );

    const filled = dayResults.filter((d) => d.nuts.length > 0).length || 1;
    const avg = {
      calories: weekTotal.calories / filled,
      protein: weekTotal.protein / filled,
      fat: weekTotal.fat / filled,
      carbohydrates: weekTotal.carbohydrates / filled,
      fiber: weekTotal.fiber / filled,
      saltEquivalent: weekTotal.saltEquivalent / filled,
      calcium: weekTotal.calcium / filled,
      iron: weekTotal.iron / filled,
      vitaminA: weekTotal.vitaminA / filled,
      vitaminB1: weekTotal.vitaminB1 / filled,
      vitaminB2: weekTotal.vitaminB2 / filled,
      vitaminC: weekTotal.vitaminC / filled,
      vegetables: weekTotal.vegetables / filled,
    };

    const today = dayResults.find((d) => d.date === new Date().toISOString().slice(0, 10))
      ?? dayResults[0];

    return { today, avg, dayResults };
  }, [isClient, plan, recipes]);

  if (!isClient || !summary) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  const rows: { key: keyof NutritionAmount; label: string }[] = [
    { key: "calories", label: "カロリー" },
    { key: "protein", label: "たんぱく質" },
    { key: "fat", label: "脂質" },
    { key: "carbohydrates", label: "炭水化物" },
    { key: "vegetables", label: "野菜" },
    { key: "fiber", label: "食物繊維" },
    { key: "saltEquivalent", label: "塩分" },
    { key: "calcium", label: "カルシウム" },
    { key: "iron", label: "鉄" },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p>
          <Link href="/meals" className="text-sm text-primary">
            ← 献立
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight">栄養バランス</h1>
        <p className="text-sm text-on-surface-variant">
          献立作成の参考です。医療判断には使用しません。
        </p>
      </header>

      <section className="space-y-2 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-sm font-medium text-on-surface-variant">今日の目安</h2>
        <ul className="space-y-2">
          {rows.map((row) => {
            const value = summary.today?.total[row.key] ?? 0;
            const status = statusFor(
              row.key,
              value,
              summary.today?.confidence ?? 0,
            );
            return (
              <li key={row.key} className="flex items-center justify-between text-sm">
                <span>{row.label}</span>
                <span className={statusClass(status)}>
                  {status}
                  <span className="ml-2 text-xs text-on-surface-variant">
                    {Math.round(value * 10) / 10}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-sm font-medium text-on-surface-variant">今週の1日平均</h2>
        <ul className="space-y-2">
          {rows.map((row) => {
            const value = summary.avg[row.key];
            const status = statusFor(row.key, value, 0.6);
            return (
              <li key={row.key} className="flex items-center justify-between text-sm">
                <span>{row.label}</span>
                <span className={statusClass(status)}>
                  {status}
                  <span className="ml-2 text-xs text-on-surface-variant">
                    {Math.round(value * 10) / 10}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-xs text-on-surface-variant">
        ※ 適量・未登録材料は計算に含まれません。過去4週間の詳細は今後拡充予定です。
      </p>
    </div>
  );
}
