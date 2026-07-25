"use client";

import Link from "next/link";
import { useState } from "react";
import { DiabetesReferenceGoalWizard } from "@/components/settings/DiabetesReferenceGoalWizard";
import {
  loadDiabetesMealSupportSettings,
  saveDiabetesMealSupportSettings,
} from "@/lib/diabetes-meal-support/settings";
import {
  CARB_NOT_GLUCOSE_DISCLAIMER,
  DIABETES_SUPPORT_DISCLAIMER,
} from "@/lib/diabetes-meal-support/report";
import { REFERENCE_GOAL_CONFIG } from "@/lib/diabetes-meal-support/reference-goal-config";
import {
  goalSourceLabel,
  resolveEffectiveCarbTargets,
} from "@/lib/diabetes-meal-support/resolve-targets";
import { useIsClient } from "@/lib/use-is-client";
import type { DiabetesMealSupportSettings } from "@/types/diabetes-meal-support";

function parseOptionalNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

export function DiabetesMealSupportSettingsPage() {
  const isClient = useIsClient();
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<DiabetesMealSupportSettings | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [tick, setTick] = useState(0);

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
    <div className="space-y-6">
      <Link href="/settings" className="text-sm text-primary">
        ← 設定へ
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">健康・栄養設定</h1>
        <p className="text-sm text-on-surface-variant">
          糖尿病配慮の食事支援（診断・治療ではありません）
        </p>
      </header>

      <section className="space-y-2 rounded-2xl bg-error-container/40 p-4 text-sm text-on-surface">
        <p>{DIABETES_SUPPORT_DISCLAIMER}</p>
        <p className="mt-2">{CARB_NOT_GLUCOSE_DISCLAIMER}</p>
      </section>

      {medicationWarning ? (
        <section className="rounded-2xl bg-secondary-container/60 p-4 text-sm">
          {REFERENCE_GOAL_CONFIG.disclaimers.medicationWarning}
        </section>
      ) : null}

      {!showWizard ? (
        <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
          <h2 className="font-semibold">質問に答えて参考値を計算する</h2>
          <p className="text-sm text-on-surface-variant">
            身長・体重・活動量などから、献立作成に利用する参考値を計算します。約1分で完了します。
          </p>
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary"
          >
            質問に答えて参考値を計算する
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
        <p className="text-sm font-medium text-on-surface">
          目標値は医師または管理栄養士から案内された内容を入力してください
        </p>
        <p className="text-xs text-on-surface-variant">
          未入力の項目には、アプリ側で医学的な基準値を自動設定しません。手動入力もそのまま使えます。
        </p>
        <p className="text-sm">
          目標値の出所：{goalSourceLabel(effective.source === "none" ? null : effective.source)}
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
          糖尿病配慮モードを使う
        </label>

        <label className="block space-y-1 text-sm">
          <span>1食の糖質目標（下限 g）</span>
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
          <span>1食の糖質目標（上限 g）</span>
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
          <span>1日の糖質目標（g）</span>
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
