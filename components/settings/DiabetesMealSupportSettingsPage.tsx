"use client";

import { useState } from "react";
import { DiabetesReferenceGoalWizard } from "@/components/settings/DiabetesReferenceGoalWizard";
import { FirstVisitTip, HelpButton } from "@/components/ui/FirstVisitTip";
import {
  loadDiabetesMealSupportSettings,
  saveDiabetesMealSupportSettings,
} from "@/lib/diabetes-meal-support/settings";
import {
  CARB_NOT_GLUCOSE_DISCLAIMER,
  DIABETES_SUPPORT_DISCLAIMER,
  HEALTH_WEIGHT_SUPPORT_INTRO,
} from "@/lib/diabetes-meal-support/report";
import { REFERENCE_GOAL_CONFIG } from "@/lib/diabetes-meal-support/reference-goal-config";
import {
  goalSourceLabel,
  resolveEffectiveCarbTargets,
} from "@/lib/diabetes-meal-support/resolve-targets";
import { useIsClient } from "@/lib/use-is-client";
import type { DiabetesMealSupportSettings } from "@/types/diabetes-meal-support";

const HEALTH_HELP_KEY = "meal-planner:healthSettingsHelpSeen";

function parseOptionalNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

type DiabetesHealthSectionProps = {
  /** 家族プロフィール内セクションとして埋め込む */
  embedded?: boolean;
};

/** 健康・体重管理サポート設定。家族プロフィール内のセクションとしても使う */
export function DiabetesHealthSection({
  embedded = false,
}: DiabetesHealthSectionProps) {
  const isClient = useIsClient();
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<DiabetesMealSupportSettings | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [tick, setTick] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  if (!isClient) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  void tick;
  const settings = form ?? loadDiabetesMealSupportSettings();
  const effective = resolveEffectiveCarbTargets(settings);
  const medicationWarning =
    settings.usesInsulin === true ||
    settings.usesHypoglycemiaRiskMedication === true;

  function update<K extends keyof DiabetesMealSupportSettings>(
    key: K,
    value: DiabetesMealSupportSettings[K],
  ): void {
    setForm({ ...settings, [key]: value });
  }

  function handleSave(): void {
    const saved = saveDiabetesMealSupportSettings({
      diabetesMealSupportEnabled: settings.diabetesMealSupportEnabled,
      targetCarbsPerMealMin: settings.targetCarbsPerMealMin,
      targetCarbsPerMealMax: settings.targetCarbsPerMealMax,
      targetCarbsPerDay: settings.targetCarbsPerDay,
      prioritizeFiber: settings.prioritizeFiber,
      prioritizeNonStarchyVegetables: settings.prioritizeNonStarchyVegetables,
      limitSodium: settings.limitSodium,
      limitSaturatedFat: settings.limitSaturatedFat,
      preferredStaplePortionGrams: settings.preferredStaplePortionGrams,
      goalSource: settings.goalSource ?? "manual",
      usesInsulin: settings.usesInsulin,
      usesHypoglycemiaRiskMedication: settings.usesHypoglycemiaRiskMedication,
      referenceCaloriesMin: settings.referenceCaloriesMin,
      referenceCaloriesMax: settings.referenceCaloriesMax,
      referenceCarbsPerDayMin: settings.referenceCarbsPerDayMin,
      referenceCarbsPerDayMax: settings.referenceCarbsPerDayMax,
      referenceCarbsPerMealMin: settings.referenceCarbsPerMealMin,
      referenceCarbsPerMealMax: settings.referenceCarbsPerMealMax,
      bmi: settings.bmi,
      bmiCategory: settings.bmiCategory,
      questionnaireCompletedAt: settings.questionnaireCompletedAt,
    });
    setForm(saved);
    setMessage("保存しました");
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {embedded ? (
            <h2 className="text-lg font-semibold tracking-tight">⭐ 健康</h2>
          ) : (
            <h1 className="text-2xl font-bold tracking-tight">⭐ 健康・体重管理</h1>
          )}
        </div>
        <HelpButton
          label="説明・免責を見る"
          onClick={() => setShowHelp(true)}
        />
      </header>

      <FirstVisitTip
        storageKey={HEALTH_HELP_KEY}
        title="ご注意"
        forceOpen={showHelp}
        onForceClose={() => setShowHelp(false)}
      >
        <p>{HEALTH_WEIGHT_SUPPORT_INTRO}</p>
        <p className="mt-2">{DIABETES_SUPPORT_DISCLAIMER}</p>
        <p className="mt-2">{CARB_NOT_GLUCOSE_DISCLAIMER}</p>
        {medicationWarning ? (
          <p className="mt-2">
            {REFERENCE_GOAL_CONFIG.disclaimers.medicationWarning}
          </p>
        ) : null}
      </FirstVisitTip>

      {!showWizard ? (
        <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary"
          >
            質問に答えて参考値を計算
          </button>
        </section>
      ) : (
        <DiabetesReferenceGoalWizard
          onClose={() => setShowWizard(false)}
          onApplied={() => {
            setShowWizard(false);
            setForm(null);
            setTick((n) => n + 1);
            setMessage("ウィザードの参考値を反映しました");
          }}
        />
      )}

      <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <p className="text-sm">
          出所：{goalSourceLabel(effective.source === "none" ? null : effective.source)}
        </p>
        {effective.source !== "none" ? (
          <p className="text-xs text-on-surface-variant">
            有効な目安: 1食{" "}
            {effective.mealMin ?? "—"}〜{effective.mealMax ?? "—"} g / 1日{" "}
            {effective.day ?? "—"} g
          </p>
        ) : null}

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.diabetesMealSupportEnabled}
            onChange={(e) =>
              update("diabetesMealSupportEnabled", e.target.checked)
            }
            className="h-5 w-5"
          />
          健康的な体重管理サポートを使う
        </label>

        <p className="pt-1 text-xs font-medium text-on-surface-variant">
          糖質の目安（補助・極端な制限はしません）
        </p>

        <label className="block space-y-1 text-sm">
          <span>1食の糖質目安（下限 g）</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={settings.targetCarbsPerMealMin ?? ""}
            onChange={(e) =>
              update(
                "targetCarbsPerMealMin",
                parseOptionalNumber(e.target.value),
              )
            }
            placeholder="未設定"
            className="w-full rounded-xl bg-surface-container px-3 py-2"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span>1食の糖質目安（上限 g）</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={settings.targetCarbsPerMealMax ?? ""}
            onChange={(e) =>
              update(
                "targetCarbsPerMealMax",
                parseOptionalNumber(e.target.value),
              )
            }
            placeholder="未設定"
            className="w-full rounded-xl bg-surface-container px-3 py-2"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span>1日の糖質目安（g）</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={settings.targetCarbsPerDay ?? ""}
            onChange={(e) =>
              update("targetCarbsPerDay", parseOptionalNumber(e.target.value))
            }
            placeholder="未設定"
            className="w-full rounded-xl bg-surface-container px-3 py-2"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span>希望する主食量（g）</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={settings.preferredStaplePortionGrams ?? ""}
            onChange={(e) =>
              update(
                "preferredStaplePortionGrams",
                parseOptionalNumber(e.target.value),
              )
            }
            placeholder="未設定（提案の参考）"
            className="w-full rounded-xl bg-surface-container px-3 py-2"
          />
        </label>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.prioritizeFiber}
            onChange={(e) => update("prioritizeFiber", e.target.checked)}
            className="h-5 w-5"
          />
          食物繊維が多い料理を優先
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.prioritizeNonStarchyVegetables}
            onChange={(e) =>
              update("prioritizeNonStarchyVegetables", e.target.checked)
            }
            className="h-5 w-5"
          />
          非でんぷん野菜を優先
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.limitSodium}
            onChange={(e) => update("limitSodium", e.target.checked)}
            className="h-5 w-5"
          />
          塩分を抑えめに評価
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.limitSaturatedFat}
            onChange={(e) => update("limitSaturatedFat", e.target.checked)}
            className="h-5 w-5"
          />
          飽和脂肪を抑えめに評価
        </label>

        <button
          type="button"
          onClick={handleSave}
          className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary"
        >
          保存する
        </button>
        {message ? (
          <p className="text-sm text-on-surface-variant" role="status">
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}

/** @deprecated 独立ページは廃止。リダイレクト用に残す */
export function DiabetesMealSupportSettingsPage() {
  return <DiabetesHealthSection />;
}
