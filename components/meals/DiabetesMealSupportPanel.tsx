"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HelpButton, FirstVisitTip } from "@/components/ui/FirstVisitTip";
import { buildDiabetesMealSupportReport } from "@/lib/diabetes-meal-support/report";
import { REFERENCE_GOAL_CONFIG } from "@/lib/diabetes-meal-support/reference-goal-config";
import { loadDiabetesMealSupportSettings } from "@/lib/diabetes-meal-support/settings";
import { buildWeeklyHealthSummaryView } from "@/lib/diabetes-meal-support/weekly-summary";
import type { MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";

type DiabetesMealSupportPanelProps = {
  plan: MealPlan;
  recipes: Recipe[];
};

const DISCLAIMER_KEY = "meal-planner:healthDisclaimerSeen";

/**
 * 普段は星・◎○△・改善件数のみ。詳細はタップ展開。
 */
export function DiabetesMealSupportPanel({
  plan,
  recipes,
}: DiabetesMealSupportPanelProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const settings = loadDiabetesMealSupportSettings();
  const report = useMemo(
    () => buildDiabetesMealSupportReport(plan, recipes, settings),
    [plan, recipes, settings],
  );
  const summary = useMemo(
    () => buildWeeklyHealthSummaryView(report),
    [report],
  );
  const medicationWarning =
    settings.usesInsulin === true ||
    settings.usesHypoglycemiaRiskMedication === true;

  if (!settings.diabetesMealSupportEnabled) {
    return (
      <section className="rounded-2xl bg-surface-container px-3 py-2.5 text-sm">
        <p className="font-medium">⭐ 健康・体重管理</p>
        <p className="mt-0.5 text-xs text-on-surface-variant">オフ</p>
        <Link
          href="/settings/family-profiles?section=health"
          className="mt-1 inline-block text-xs font-medium text-primary"
        >
          設定
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-surface-container-lowest ring-1 ring-outline-variant">
      <div className="flex items-start gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={() => setDetailOpen((value) => !value)}
          className="min-w-0 flex-1 space-y-1 text-left"
          aria-expanded={detailOpen}
        >
          <p
            className="text-lg leading-none text-primary"
            aria-label={`評価${summary.stars}`}
          >
            {summary.starsLabel}
          </p>
          <p className="text-sm">
            体重管理 {summary.weightManagement}
            <span className="mx-1.5 text-on-surface-variant">·</span>
            🥕 野菜 {summary.vegetables}
            <span className="mx-1.5 text-on-surface-variant">·</span>
            🍖 たんぱく質 {summary.protein}
          </p>
          <p className="text-xs text-on-surface-variant">
            改善点 {summary.improvementCount}件
            {summary.nutritionMissingRecipeCount > 0
              ? " · 栄養情報が不足しています"
              : ""}
          </p>
        </button>
        <HelpButton
          label="免責を見る"
          onClick={() => setShowDisclaimer(true)}
        />
        <button
          type="button"
          onClick={() => setDetailOpen((value) => !value)}
          className="shrink-0 pt-1 text-xs font-medium text-primary"
        >
          {detailOpen ? "▲" : "▼"}
        </button>
      </div>

      {showDisclaimer ? (
        <div className="px-3 pb-2">
          <FirstVisitTip
            storageKey={DISCLAIMER_KEY}
            title="ご注意"
            forceOpen={showDisclaimer}
            onForceClose={() => setShowDisclaimer(false)}
          >
            {report.disclaimer}
          </FirstVisitTip>
        </div>
      ) : null}

      {detailOpen ? (
        <div className="space-y-3 border-t border-outline-variant px-3 py-3 text-sm">
          {medicationWarning ? (
            <p className="rounded-xl bg-surface-container p-2 text-xs">
              {REFERENCE_GOAL_CONFIG.disclaimers.medicationWarning}
            </p>
          ) : null}

          <p className="text-xs text-on-surface-variant">
            カバー率 {Math.round(summary.weeklyCoverage)}%
          </p>

          <div>
            <p className="font-medium">改善候補</p>
            {summary.aggregatedImprovements.length === 0 ? (
              <p className="mt-1 text-xs text-on-surface-variant">候補なし</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {summary.aggregatedImprovements.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-baseline justify-between gap-2 text-sm"
                  >
                    <span>{item.title}</span>
                    <span className="shrink-0 text-xs text-on-surface-variant">
                      {item.countLabel}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href="/settings/family-profiles?section=health"
            className="inline-block text-xs font-medium text-primary"
          >
            目標を編集
          </Link>
        </div>
      ) : null}
      {!detailOpen ? <div className="pb-3" /> : null}
    </section>
  );
}
