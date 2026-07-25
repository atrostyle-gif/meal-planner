"use client";

import { useMemo, useState } from "react";
import { REFERENCE_GOAL_CONFIG } from "@/lib/diabetes-meal-support/reference-goal-config";
import {
  activityLevelDescription,
  bmiCategoryLabel,
  buildReferenceGoalResult,
} from "@/lib/diabetes-meal-support/reference-goal";
import {
  DEFAULT_REFERENCE_GOAL_ANSWERS,
  type ReferenceGoalAnswers,
  type ReferenceGoalResult,
} from "@/lib/diabetes-meal-support/reference-goal-types";
import { saveDiabetesMealSupportSettings } from "@/lib/diabetes-meal-support/settings";
import type { DiabetesGoalSource } from "@/types/diabetes-meal-support";

type WizardMode = "wizard" | "edit-before-save";

type DiabetesReferenceGoalWizardProps = {
  onClose: () => void;
  onApplied: () => void;
};

const STEPS = [
  "条件確認",
  "身長・体重",
  "年齢・性別",
  "活動量",
  "体重目標",
  "治療状況",
  "食事回数",
  "方針",
  "結果確認",
] as const;

function parseNum(text: string): number | null {
  const t = text.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

function ChoiceButton({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl px-4 py-4 text-left ${
        selected
          ? "bg-primary text-on-primary"
          : "bg-surface-container text-on-surface ring-1 ring-outline-variant"
      }`}
    >
      <p className="text-base font-semibold">{title}</p>
      {description ? (
        <p
          className={`mt-1 text-xs ${
            selected ? "text-on-primary/90" : "text-on-surface-variant"
          }`}
        >
          {description}
        </p>
      ) : null}
    </button>
  );
}

export function DiabetesReferenceGoalWizard({
  onClose,
  onApplied,
}: DiabetesReferenceGoalWizardProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<ReferenceGoalAnswers>(
    DEFAULT_REFERENCE_GOAL_ANSWERS,
  );
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<WizardMode>("wizard");
  const [editMealMin, setEditMealMin] = useState("");
  const [editMealMax, setEditMealMax] = useState("");
  const [editDay, setEditDay] = useState("");
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const result: ReferenceGoalResult = useMemo(
    () => buildReferenceGoalResult(answers),
    [answers],
  );

  const medicationRisk =
    answers.usesInsulin || answers.usesHypoglycemiaRiskMedication;

  function patch(partial: Partial<ReferenceGoalAnswers>): void {
    setAnswers((current) => ({ ...current, ...partial }));
    setError(null);
  }

  function validateStep(index: number): string | null {
    const v = REFERENCE_GOAL_CONFIG.validation;
    if (index === 1) {
      if (
        answers.heightCm == null ||
        answers.heightCm < v.heightCm.min ||
        answers.heightCm > v.heightCm.max
      ) {
        return `身長は ${v.heightCm.min}〜${v.heightCm.max} cm で入力してください`;
      }
      if (
        answers.weightKg == null ||
        answers.weightKg < v.weightKg.min ||
        answers.weightKg > v.weightKg.max
      ) {
        return `体重は ${v.weightKg.min}〜${v.weightKg.max} kg で入力してください`;
      }
    }
    if (index === 2) {
      if (
        answers.age == null ||
        answers.age < v.age.min ||
        answers.age > v.age.max
      ) {
        return `年齢は ${v.age.min}〜${v.age.max} 歳で入力してください（18歳未満は前の画面で個別相談になります）`;
      }
    }
    if (index === 4 && answers.weightGoal === "doctor_directed") {
      const tw = answers.doctorDirectedTargetWeightKg;
      if (
        tw == null ||
        tw < v.targetWeightKg.min ||
        tw > v.targetWeightKg.max
      ) {
        return "医師から指定された目標体重（kg）を入力してください";
      }
    }
    if (index === 7 && answers.carbPolicy === "clinicianDirected") {
      const hasDay =
        answers.clinicianCarbsPerDay != null &&
        answers.clinicianCarbsPerDay >= 0;
      const hasMeal =
        answers.clinicianCarbsPerMealMin != null &&
        answers.clinicianCarbsPerMealMax != null;
      if (!hasDay && !hasMeal) {
        return "医療者から案内された1食または1日の糖質量を入力してください";
      }
    }
    return null;
  }

  function goNext(): void {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    // インスリン等の場合、方針ステップで moderatelyLowerCarb を避ける
    if (step === 6 && medicationRisk && answers.carbPolicy === "moderatelyLowerCarb") {
      patch({ carbPolicy: "balanced" });
    }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function goBack(): void {
    setError(null);
    if (mode === "edit-before-save") {
      setMode("wizard");
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  }

  function applyResult(source: DiabetesGoalSource, overrides?: {
    mealMin: number | null;
    mealMax: number | null;
    day: number | null;
  }): void {
    if (!result.canApplyAsReference && source === "questionnaire") {
      setError(
        "この条件では一般の参考値として保存できません。医療者へご相談ください。",
      );
      return;
    }

    const mealMin = overrides?.mealMin ?? result.carbsPerMealMin;
    const mealMax = overrides?.mealMax ?? result.carbsPerMealMax;
    const day =
      overrides?.day ??
      (result.carbsPerDayMin != null && result.carbsPerDayMax != null
        ? Math.round((result.carbsPerDayMin + result.carbsPerDayMax) / 2)
        : result.carbsPerDayMax);

    const staple =
      result.staplePortion.cookedRiceGramsMin != null &&
      result.staplePortion.cookedRiceGramsMax != null
        ? Math.round(
            (result.staplePortion.cookedRiceGramsMin +
              result.staplePortion.cookedRiceGramsMax) /
              2,
          )
        : null;

    saveDiabetesMealSupportSettings({
      diabetesMealSupportEnabled: true,
      targetCarbsPerMealMin: mealMin,
      targetCarbsPerMealMax: mealMax,
      targetCarbsPerDay: day,
      preferredStaplePortionGrams: staple,
      goalSource: source,
      questionnaireCompletedAt: new Date().toISOString(),
      referenceCaloriesMin: result.caloriesMin,
      referenceCaloriesMax: result.caloriesMax,
      referenceCarbsPerDayMin: result.carbsPerDayMin,
      referenceCarbsPerDayMax: result.carbsPerDayMax,
      referenceCarbsPerMealMin: result.carbsPerMealMin,
      referenceCarbsPerMealMax: result.carbsPerMealMax,
      bmi: result.bmi,
      bmiCategory: result.bmiCategory,
      usesInsulin: answers.usesInsulin,
      usesHypoglycemiaRiskMedication: answers.usesHypoglycemiaRiskMedication,
    });
    setSavedNotice("参考値を設定に保存しました");
    onApplied();
  }

  function handleUseReference(): void {
    const source: DiabetesGoalSource = result.usedClinicianValues
      ? "clinician"
      : "questionnaire";
    applyResult(source);
  }

  function handleEditAndUse(): void {
    setEditMealMin(result.carbsPerMealMin?.toString() ?? "");
    setEditMealMax(result.carbsPerMealMax?.toString() ?? "");
    setEditDay(
      result.carbsPerDayMin != null && result.carbsPerDayMax != null
        ? String(
            Math.round((result.carbsPerDayMin + result.carbsPerDayMax) / 2),
          )
        : "",
    );
    setMode("edit-before-save");
    setError(null);
  }

  function handleSaveEdited(): void {
    const mealMin = parseNum(editMealMin);
    const mealMax = parseNum(editMealMax);
    const day = parseNum(editDay);
    if (mealMin == null && mealMax == null && day == null) {
      setError("修正後の糖質量を入力してください");
      return;
    }
    applyResult("manual", { mealMin, mealMax, day });
  }

  const progress = `${step + 1} / ${STEPS.length}`;

  return (
    <section className="space-y-4 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">参考値ウィザード</h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            {STEPS[step]} ・ {progress}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-primary">
          閉じる
        </button>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-surface-container">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {mode === "edit-before-save" ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">数値を修正して使用する</p>
          <label className="block text-sm">
            1食糖質 下限（g）
            <input
              type="number"
              inputMode="decimal"
              value={editMealMin}
              onChange={(e) => setEditMealMin(e.target.value)}
              className="mt-1 w-full rounded-xl bg-surface-container px-3 py-3"
            />
          </label>
          <label className="block text-sm">
            1食糖質 上限（g）
            <input
              type="number"
              inputMode="decimal"
              value={editMealMax}
              onChange={(e) => setEditMealMax(e.target.value)}
              className="mt-1 w-full rounded-xl bg-surface-container px-3 py-3"
            />
          </label>
          <label className="block text-sm">
            1日糖質（g）
            <input
              type="number"
              inputMode="decimal"
              value={editDay}
              onChange={(e) => setEditDay(e.target.value)}
              className="mt-1 w-full rounded-xl bg-surface-container px-3 py-3"
            />
          </label>
          <button
            type="button"
            onClick={handleSaveEdited}
            className="w-full rounded-2xl bg-primary px-4 py-3.5 font-semibold text-on-primary"
          >
            修正した値を保存する
          </button>
          <button
            type="button"
            onClick={goBack}
            className="w-full rounded-2xl px-4 py-3 text-sm ring-1 ring-outline-variant"
          >
            結果に戻る
          </button>
        </div>
      ) : null}

      {mode === "wizard" && step === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-on-surface-variant">
            一般的な質問だけでは扱いにくい条件がないか確認します。
          </p>
          {(
            [
              ["hasKidneyDisease", "腎臓病がある（または指摘されている）"],
              ["isPregnant", "妊娠中・授乳中である"],
              ["isUnder18", "18歳未満である"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={answers[key]}
                onChange={(e) => patch({ [key]: e.target.checked })}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      ) : null}

      {mode === "wizard" && step === 1 ? (
        <div className="space-y-3">
          <label className="block text-sm">
            身長（cm）
            <input
              type="number"
              inputMode="decimal"
              value={answers.heightCm ?? ""}
              onChange={(e) => patch({ heightCm: parseNum(e.target.value) })}
              className="mt-1 w-full rounded-xl bg-surface-container px-3 py-3 text-base"
              placeholder="例: 165"
            />
          </label>
          <label className="block text-sm">
            体重（kg）
            <input
              type="number"
              inputMode="decimal"
              value={answers.weightKg ?? ""}
              onChange={(e) => patch({ weightKg: parseNum(e.target.value) })}
              className="mt-1 w-full rounded-xl bg-surface-container px-3 py-3 text-base"
              placeholder="例: 60"
            />
          </label>
          <p className="text-xs text-on-surface-variant">
            身長・体重だけで糖質量を決めません。この後の生活状況も使います。
          </p>
        </div>
      ) : null}

      {mode === "wizard" && step === 2 ? (
        <div className="space-y-3">
          <label className="block text-sm">
            年齢（歳）
            <input
              type="number"
              inputMode="numeric"
              value={answers.age ?? ""}
              onChange={(e) => patch({ age: parseNum(e.target.value) })}
              className="mt-1 w-full rounded-xl bg-surface-container px-3 py-3 text-base"
            />
          </label>
          <p className="text-sm font-medium">性別（計算の参考）</p>
          {(
            [
              ["female", "女性"],
              ["male", "男性"],
              ["unspecified", "指定しない"],
            ] as const
          ).map(([value, label]) => (
            <ChoiceButton
              key={value}
              selected={answers.sex === value}
              onClick={() => patch({ sex: value })}
              title={label}
            />
          ))}
        </div>
      ) : null}

      {mode === "wizard" && step === 3 ? (
        <div className="space-y-3">
          <p className="text-sm text-on-surface-variant">
            ふだんの動き方に近いものを選んでください
          </p>
          {(
            [
              ["low", "少なめ"],
              ["moderate", "普通"],
              ["high", "多め"],
            ] as const
          ).map(([value, label]) => (
            <ChoiceButton
              key={value}
              selected={answers.activityLevel === value}
              onClick={() => patch({ activityLevel: value })}
              title={label}
              description={activityLevelDescription(value)}
            />
          ))}
        </div>
      ) : null}

      {mode === "wizard" && step === 4 ? (
        <div className="space-y-3">
          {(
            [
              ["maintain", "今の体重を維持したい"],
              ["gradual_loss", "ゆっくり減量したい"],
              ["doctor_directed", "医師から目標体重を指定されている"],
              ["unknown", "まだ決めていない"],
            ] as const
          ).map(([value, label]) => (
            <ChoiceButton
              key={value}
              selected={answers.weightGoal === value}
              onClick={() => patch({ weightGoal: value })}
              title={label}
            />
          ))}
          {answers.weightGoal === "doctor_directed" ? (
            <label className="block text-sm">
              医師指定の目標体重（kg）
              <input
                type="number"
                inputMode="decimal"
                value={answers.doctorDirectedTargetWeightKg ?? ""}
                onChange={(e) =>
                  patch({
                    doctorDirectedTargetWeightKg: parseNum(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-xl bg-surface-container px-3 py-3"
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {mode === "wizard" && step === 5 ? (
        <div className="space-y-3">
          <p className="text-sm text-on-surface-variant">
            当てはまるものを選んでください（複数可）
          </p>
          {(
            [
              ["usesInsulin", "インスリンを使っている"],
              [
                "usesHypoglycemiaRiskMedication",
                "低血糖になりやすい薬を使っている",
              ],
              ["usesOtherDiabetesMedication", "その他の糖尿病の薬を使っている"],
              ["dietExerciseOnly", "食事・運動のみで管理している"],
              ["treatmentUnknown", "よく分からない・答えたくない"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-start gap-3 rounded-2xl bg-surface-container px-4 py-3 text-sm"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5"
                checked={answers[key]}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (key === "treatmentUnknown" && checked) {
                    patch({
                      treatmentUnknown: true,
                      usesInsulin: false,
                      usesHypoglycemiaRiskMedication: false,
                      usesOtherDiabetesMedication: false,
                      dietExerciseOnly: false,
                    });
                    return;
                  }
                  patch({
                    [key]: checked,
                    treatmentUnknown: key === "treatmentUnknown" ? checked : false,
                  });
                }}
              />
              <span>{label}</span>
            </label>
          ))}
          {medicationRisk ? (
            <p className="rounded-xl bg-error-container/50 p-3 text-xs">
              {REFERENCE_GOAL_CONFIG.disclaimers.medicationWarning}
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "wizard" && step === 6 ? (
        <div className="space-y-3">
          {(
            [
              ["twoMeals", "ほぼ1日2食"],
              ["threeMeals", "ほぼ1日3食"],
              ["threeMealsWithSnacks", "3食＋間食"],
              ["irregular", "日によって不規則"],
            ] as const
          ).map(([value, label]) => (
            <ChoiceButton
              key={value}
              selected={answers.mealPattern === value}
              onClick={() => patch({ mealPattern: value })}
              title={label}
            />
          ))}
        </div>
      ) : null}

      {mode === "wizard" && step === 7 ? (
        <div className="space-y-3">
          {(
            [
              ["balanced", "バランス重視（参考）", "極端な制限はしません"],
              [
                "moderatelyLowerCarb",
                "やや糖質控えめ（参考）",
                "ケトジェニックなどの極端な低糖質は提案しません",
              ],
              [
                "clinicianDirected",
                "医師・管理栄養士の指示値を使う",
                "案内された数値を優先します",
              ],
              ["manual", "あとで自分で数値を入れる", "この場では計算しません"],
            ] as const
          )
            .filter(([value]) => {
              if (value === "moderatelyLowerCarb" && medicationRisk) {
                return false;
              }
              return true;
            })
            .map(([value, title, description]) => (
              <ChoiceButton
                key={value}
                selected={answers.carbPolicy === value}
                onClick={() => patch({ carbPolicy: value })}
                title={title}
                description={description}
              />
            ))}
          {answers.carbPolicy === "clinicianDirected" ? (
            <div className="space-y-2 rounded-xl bg-surface-container p-3">
              <p className="text-xs text-on-surface-variant">
                案内された数値（分かる範囲で入力）
              </p>
              <label className="block text-sm">
                1食糖質 下限（g）
                <input
                  type="number"
                  value={answers.clinicianCarbsPerMealMin ?? ""}
                  onChange={(e) =>
                    patch({
                      clinicianCarbsPerMealMin: parseNum(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-xl bg-surface-container-lowest px-3 py-3"
                />
              </label>
              <label className="block text-sm">
                1食糖質 上限（g）
                <input
                  type="number"
                  value={answers.clinicianCarbsPerMealMax ?? ""}
                  onChange={(e) =>
                    patch({
                      clinicianCarbsPerMealMax: parseNum(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-xl bg-surface-container-lowest px-3 py-3"
                />
              </label>
              <label className="block text-sm">
                1日糖質（g）
                <input
                  type="number"
                  value={answers.clinicianCarbsPerDay ?? ""}
                  onChange={(e) =>
                    patch({ clinicianCarbsPerDay: parseNum(e.target.value) })
                  }
                  className="mt-1 w-full rounded-xl bg-surface-container-lowest px-3 py-3"
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "wizard" && step === 8 ? (
        <div className="space-y-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">BMI（参考）</dt>
              <dd className="font-medium">
                {result.bmi ?? "—"}（{bmiCategoryLabel(result.bmiCategory)}）
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">参考体重</dt>
              <dd className="font-medium">
                {result.referenceWeightKg != null
                  ? `${result.referenceWeightKg} kg`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">参考摂取エネルギー</dt>
              <dd className="font-medium text-right">
                {result.caloriesMin != null && result.caloriesMax != null
                  ? `${result.caloriesMin}〜${result.caloriesMax} kcal/日`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">参考糖質量／日</dt>
              <dd className="font-medium text-right">
                {result.carbsPerDayMin != null && result.carbsPerDayMax != null
                  ? `${result.carbsPerDayMin}〜${result.carbsPerDayMax} g`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">参考糖質量／食</dt>
              <dd className="font-medium text-right">
                {result.carbsPerMealMin != null &&
                result.carbsPerMealMax != null
                  ? `${result.carbsPerMealMin}〜${result.carbsPerMealMax} g`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">間食の参考糖質</dt>
              <dd className="font-medium text-right">
                {result.snackCarbsMin != null && result.snackCarbsMax != null
                  ? `${result.snackCarbsMin}〜${result.snackCarbsMax} g`
                  : "割り当てなし／—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">主食量の参考</dt>
              <dd className="font-medium text-right">
                {result.staplePortion.cookedRiceGramsMin != null &&
                result.staplePortion.cookedRiceGramsMax != null
                  ? `炊飯ごはん ${result.staplePortion.cookedRiceGramsMin}〜${result.staplePortion.cookedRiceGramsMax} g`
                  : "—"}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-on-surface-variant">
            {result.staplePortion.note}
          </p>
          <p className="text-sm">{result.explanation}</p>
          <div className="space-y-2 rounded-xl bg-error-container/40 p-3 text-xs">
            <p>{REFERENCE_GOAL_CONFIG.disclaimers.referenceOnly}</p>
            <p>{REFERENCE_GOAL_CONFIG.disclaimers.carbNotGlucose}</p>
          </div>
          {result.warnings.map((warning) => (
            <p
              key={warning}
              className="rounded-xl bg-secondary-container/60 p-3 text-xs"
            >
              {warning}
            </p>
          ))}

          {result.canApplyAsReference ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleUseReference}
                className="w-full rounded-2xl bg-primary px-4 py-3.5 font-semibold text-on-primary"
              >
                この参考値を使用する
              </button>
              <button
                type="button"
                onClick={handleEditAndUse}
                className="w-full rounded-2xl px-4 py-3.5 text-sm font-medium ring-1 ring-outline-variant"
              >
                数値を修正して使用する
              </button>
            </div>
          ) : (
            <p className="rounded-xl bg-error-container/50 p-3 text-sm">
              {result.requiresIndividualConsultation
                ? REFERENCE_GOAL_CONFIG.disclaimers.specialCondition
                : answers.carbPolicy === "manual"
                  ? "方針が「自分で数値を入れる」のため、ここでは自動保存しません。設定画面で手動入力してください。"
                  : "参考値を算出できなかったため保存できません。入力内容を見直してください。"}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl px-4 py-3 text-sm text-on-surface-variant"
          >
            保存せず戻る
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      {savedNotice ? (
        <p className="text-sm text-on-surface-variant" role="status">
          {savedNotice}
        </p>
      ) : null}

      {mode === "wizard" && step < 8 ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={step === 0 ? onClose : goBack}
            className="flex-1 rounded-2xl px-4 py-3.5 text-sm font-medium ring-1 ring-outline-variant"
          >
            {step === 0 ? "キャンセル" : "戻る"}
          </button>
          <button
            type="button"
            onClick={goNext}
            className="flex-1 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-on-primary"
          >
            次へ
          </button>
        </div>
      ) : null}

      {mode === "wizard" && step === 8 ? (
        <button
          type="button"
          onClick={goBack}
          className="w-full rounded-2xl px-4 py-3 text-sm ring-1 ring-outline-variant"
        >
          戻って修正する
        </button>
      ) : null}
    </section>
  );
}
