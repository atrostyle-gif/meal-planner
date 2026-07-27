"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HelpButton, FirstVisitTip } from "@/components/ui/FirstVisitTip";
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

type Status = "◎" | "○" | "△" | "—";

function statusFor(
  key: keyof NutritionAmount,
  value: number,
  confidence: number,
): Status {
  if (confidence < 0.3) return "—";
  if (key === "calories") {
    if (value < 400 || value > 1000) return "△";
    return "◎";
  }
  if (key === "protein") {
    if (value < 15) return "△";
    if (value > 60) return "○";
    return "◎";
  }
  if (key === "saltEquivalent") {
    if (value > 4) return "△";
    if (value > 3) return "○";
    return "◎";
  }
  if (key === "vegetables") {
    if (value < 80) return "△";
    return "◎";
  }
  if (key === "carbohydrates") {
    if (value > 120) return "△";
    return "◎";
  }
  return "○";
}

const DISCLAIMER_KEY = "meal-planner:nutritionDisclaimerSeen";

export function NutritionDashboardPage() {
  const isClient = useIsClient();
  const weekStart = getWeekStart();
  const plan = useMealPlan(weekStart);
  const recipes = useRecipes();
  const [detailOpen, setDetailOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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

    const today =
      dayResults.find(
        (d) => d.date === new Date().toISOString().slice(0, 10),
      ) ?? dayResults[0];

    return { today };
  }, [isClient, plan, recipes]);

  if (!isClient || !summary) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  const primaryRows: { key: keyof NutritionAmount; label: string; icon: string }[] = [
    { key: "calories", label: "カロリー", icon: "🔥" },
    { key: "vegetables", label: "野菜", icon: "🥕" },
    { key: "protein", label: "たんぱく質", icon: "🍖" },
    { key: "carbohydrates", label: "糖質", icon: "🍚" },
  ];

  const extraRows: { key: keyof NutritionAmount; label: string }[] = [
    { key: "fat", label: "脂質" },
    { key: "fiber", label: "食物繊維" },
    { key: "saltEquivalent", label: "塩分" },
    { key: "calcium", label: "カルシウム" },
    { key: "iron", label: "鉄" },
  ];

  const confidence = summary.today?.confidence ?? 0;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <Link href="/meals" className="text-sm text-primary">
            ← 献立
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">栄養</h1>
        </div>
        <HelpButton onClick={() => setShowHelp(true)} />
      </header>

      {showHelp ? (
        <FirstVisitTip
          storageKey={DISCLAIMER_KEY}
          title="ご注意"
          forceOpen={showHelp}
          onForceClose={() => setShowHelp(false)}
        >
          献立作成の参考です。医療判断には使いません。
        </FirstVisitTip>
      ) : null}

      {confidence < 0.3 ? (
        <p className="rounded-2xl bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
          栄養情報が不足しています
        </p>
      ) : null}

      <section className="rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <p className="mb-3 text-xs text-on-surface-variant">今日の目安</p>
        <ul className="space-y-3">
          {primaryRows.map((row) => {
            const value = summary.today?.total[row.key] ?? 0;
            const status = statusFor(row.key, value, confidence);
            return (
              <li
                key={row.key}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {row.icon} {row.label}
                </span>
                <span className="font-semibold">
                  {status}{" "}
                  <span className="font-normal text-on-surface-variant">
                    {Math.round(value * 10) / 10}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <button
        type="button"
        onClick={() => setDetailOpen((v) => !v)}
        className="w-full rounded-xl bg-surface-container px-3 py-2.5 text-sm font-medium"
      >
        {detailOpen ? "▲ 詳細を閉じる" : "▼ 詳細を見る"}
      </button>

      {detailOpen ? (
        <section className="rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
          <ul className="space-y-2">
            {extraRows.map((row) => {
              const value = summary.today?.total[row.key] ?? 0;
              const status = statusFor(row.key, value, confidence);
              return (
                <li
                  key={row.key}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{row.label}</span>
                  <span>
                    {status}{" "}
                    <span className="text-on-surface-variant">
                      {Math.round(value * 10) / 10}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
