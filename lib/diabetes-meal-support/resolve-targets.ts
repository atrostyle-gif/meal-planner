import type { DiabetesMealSupportSettings } from "@/types/diabetes-meal-support";
import type { GoalSource } from "@/lib/diabetes-meal-support/reference-goal-types";

export type EffectiveCarbTargets = {
  mealMin: number | null;
  mealMax: number | null;
  day: number | null;
  source: GoalSource | "none";
  sourceLabel: string;
};

export function goalSourceLabel(source: GoalSource | null | undefined): string {
  switch (source) {
    case "clinician":
      return "医師・管理栄養士の指示値";
    case "manual":
      return "手動で入力した値";
    case "questionnaire":
      return "質問から計算した参考値";
    default:
      return "未設定";
  }
}

/**
 * 献立採点・チェック用の有効な糖質目標。
 * 優先順位: clinician > manual > questionnaire
 */
export function resolveEffectiveCarbTargets(
  settings: DiabetesMealSupportSettings,
): EffectiveCarbTargets {
  const source = settings.goalSource ?? null;

  if (source === "clinician") {
    return {
      mealMin: settings.targetCarbsPerMealMin,
      mealMax: settings.targetCarbsPerMealMax,
      day: settings.targetCarbsPerDay,
      source: "clinician",
      sourceLabel: goalSourceLabel("clinician"),
    };
  }

  if (source === "manual") {
    return {
      mealMin: settings.targetCarbsPerMealMin,
      mealMax: settings.targetCarbsPerMealMax,
      day: settings.targetCarbsPerDay,
      source: "manual",
      sourceLabel: goalSourceLabel("manual"),
    };
  }

  if (source === "questionnaire") {
    // 質問由来は reference* を優先し、なければ適用済み target を使う
    return {
      mealMin:
        settings.referenceCarbsPerMealMin ?? settings.targetCarbsPerMealMin,
      mealMax:
        settings.referenceCarbsPerMealMax ?? settings.targetCarbsPerMealMax,
      day:
        settings.referenceCarbsPerDayMax != null &&
        settings.referenceCarbsPerDayMin != null
          ? Math.round(
              (settings.referenceCarbsPerDayMin +
                settings.referenceCarbsPerDayMax) /
                2,
            )
          : settings.targetCarbsPerDay,
      source: "questionnaire",
      sourceLabel: goalSourceLabel("questionnaire"),
    };
  }

  // 後方互換: goalSource 未設定でも target があれば manual 相当
  if (
    settings.targetCarbsPerMealMin != null ||
    settings.targetCarbsPerMealMax != null ||
    settings.targetCarbsPerDay != null
  ) {
    return {
      mealMin: settings.targetCarbsPerMealMin,
      mealMax: settings.targetCarbsPerMealMax,
      day: settings.targetCarbsPerDay,
      source: "manual",
      sourceLabel: goalSourceLabel("manual"),
    };
  }

  return {
    mealMin: null,
    mealMax: null,
    day: null,
    source: "none",
    sourceLabel: goalSourceLabel(null),
  };
}
