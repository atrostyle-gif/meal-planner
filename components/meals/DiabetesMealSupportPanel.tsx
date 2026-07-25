"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  buildDiabetesMealSupportReport,
} from "@/lib/diabetes-meal-support/report";
import { loadDiabetesMealSupportSettings } from "@/lib/diabetes-meal-support/settings";
import { WEEKDAY_LABELS, formatMonthDay, parseDate } from "@/lib/date";
import type { MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import type { CarbTargetStatus } from "@/types/diabetes-meal-support";

function statusLabel(status: CarbTargetStatus): string {
  switch (status) {
    case "in_range":
      return "目標範囲内";
    case "over":
      return "超過";
    case "under":
      return "不足";
    case "unknown":
      return "判定不能";
    case "no_target":
      return "目標未設定";
    default:
      return status;
  }
}

type DiabetesMealSupportPanelProps = {
  plan: MealPlan;
  recipes: Recipe[];
};

export function DiabetesMealSupportPanel({
  plan,
  recipes,
}: DiabetesMealSupportPanelProps) {
  const [open, setOpen] = useState(true);
  const settings = loadDiabetesMealSupportSettings();
  const report = useMemo(
    () => buildDiabetesMealSupportReport(plan, recipes, settings),
    [plan, recipes, settings],
  );

  if (!settings.diabetesMealSupportEnabled) {
    return (
      <section className="rounded-2xl bg-surface-container p-4 text-sm">
        <p className="font-semibold text-on-surface">糖尿病配慮チェック</p>
        <p className="mt-1 text-on-surface-variant">
          現在オフです。目標値を設定すると、献立の糖質目安などを確認できます。
        </p>
        <Link
          href="/settings/health-nutrition"
          className="mt-2 inline-block font-medium text-primary"
        >
          健康・栄養設定を開く
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl bg-secondary-container/50 p-4 text-on-secondary-container">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">糖尿病配慮チェック</h2>
          <p className="mt-1 text-xs opacity-90">
            栄養カバー率（週）: {report.weeklyTotals.nutritionCoverage}%
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="text-xs font-medium"
        >
          {open ? "閉じる" : "開く"}
        </button>
      </div>

      <p className="text-xs leading-relaxed opacity-95">{report.disclaimer}</p>
      <p className="text-xs leading-relaxed opacity-95">{report.carbDisclaimer}</p>

      {open ? (
        <>
          <ul className="space-y-2 text-sm">
            {report.mealChecks.map((meal) => {
              const weekdayIndex = (parseDate(meal.date).getDay() + 6) % 7;
              return (
                <li
                  key={meal.date}
                  className="rounded-xl bg-white/50 px-3 py-2 text-on-surface"
                >
                  <p className="font-medium">
                    {WEEKDAY_LABELS[weekdayIndex]} {formatMonthDay(meal.date)}
                  </p>
                  <p className="mt-1 text-xs">
                    推定糖質:{" "}
                    {meal.carbohydratesG == null
                      ? "判定不能（栄養情報不足）"
                      : `${meal.carbohydratesG}g`}
                    {" · "}
                    {statusLabel(meal.status)}
                  </p>
                  <p className="text-xs">
                    1日合計糖質:{" "}
                    {report.dailyTotals.find((d) => d.date === meal.date)
                      ?.carbohydratesG == null
                      ? "不完全"
                      : `${report.dailyTotals.find((d) => d.date === meal.date)?.carbohydratesG}g`}
                    {" · 食物繊維: "}
                    {meal.dietaryFiberG == null
                      ? "不明"
                      : `${meal.dietaryFiberG}g`}
                    {" · 野菜: "}
                    {meal.hasVegetables ? "あり" : "少なめ"}
                    {" · カバー率: "}
                    {meal.nutritionCoverage}%
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="rounded-xl bg-white/50 p-3 text-sm text-on-surface">
            <p className="font-medium">改善候補（提案のみ・自動変更しません）</p>
            {report.suggestions.length === 0 ? (
              <p className="mt-1 text-xs text-on-surface-variant">
                いま提示できる候補はありません
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {report.suggestions.slice(0, 8).map((suggestion) => (
                  <li key={suggestion.id} className="text-xs">
                    <p className="font-medium">{suggestion.title}</p>
                    <p className="text-on-surface-variant">{suggestion.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href="/settings/health-nutrition"
            className="inline-block text-xs font-medium text-primary"
          >
            目標値を編集する
          </Link>
        </>
      ) : null}
    </section>
  );
}
