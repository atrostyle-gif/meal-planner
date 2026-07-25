import { REFERENCE_GOAL_CONFIG as CFG } from "@/lib/diabetes-meal-support/reference-goal-config";
import type {
  ActivityLevel,
  BmiCategory,
  CarbDistribution,
  CarbPolicy,
  ReferenceGoalAnswers,
  ReferenceGoalResult,
  SexOption,
  StaplePortionReference,
  WeightGoal,
} from "@/lib/diabetes-meal-support/reference-goal-types";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round0(value: number): number {
  return Math.round(value);
}

/** BMI を算出。不正値は null */
export function calculateBmi(
  heightCm: number | null,
  weightKg: number | null,
): number | null {
  if (
    heightCm == null ||
    weightKg == null ||
    !Number.isFinite(heightCm) ||
    !Number.isFinite(weightKg) ||
    heightCm <= 0 ||
    weightKg <= 0
  ) {
    return null;
  }
  const m = heightCm / 100;
  return round1(weightKg / (m * m));
}

export function classifyBmi(bmi: number | null): BmiCategory {
  if (bmi == null) return "unknown";
  if (bmi < CFG.bmiThresholds.underweightMax) return "underweight";
  if (bmi < CFG.bmiThresholds.normalMax) return "normal";
  if (bmi < CFG.bmiThresholds.overweightMax) return "overweight";
  return "obese";
}

export function bmiCategoryLabel(category: BmiCategory): string {
  switch (category) {
    case "underweight":
      return "低体重（参考区分）";
    case "normal":
      return "普通体重（参考区分）";
    case "overweight":
      return "肥満傾向（参考区分）";
    case "obese":
      return "肥満（参考区分）";
    default:
      return "区分不明";
  }
}

/** 参考体重（BMI目安からの計算）。身長不正時は null */
export function calculateReferenceWeight(heightCm: number | null): number | null {
  if (heightCm == null || !Number.isFinite(heightCm) || heightCm <= 0) {
    return null;
  }
  const m = heightCm / 100;
  return round1(CFG.referenceBmi * m * m);
}

function estimateBmrKcal(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: SexOption;
}): number {
  const base =
    CFG.bmr.weightKg * input.weightKg +
    CFG.bmr.heightCm * input.heightCm -
    CFG.bmr.age * input.age;
  const offset =
    input.sex === "male"
      ? CFG.bmr.maleOffset
      : input.sex === "female"
        ? CFG.bmr.femaleOffset
        : CFG.bmr.unspecifiedOffset;
  return base + offset;
}

/**
 * 参考摂取エネルギー範囲（単一値ではなく範囲）。
 * BMIだけで断定せず、活動量・目標も反映する。
 */
export function calculateReferenceCalories(input: {
  heightCm: number | null;
  weightKg: number | null;
  age: number | null;
  sex: SexOption;
  activityLevel: ActivityLevel;
  weightGoal: WeightGoal;
}): { min: number | null; max: number | null } {
  const { heightCm, weightKg, age, sex, activityLevel, weightGoal } = input;
  if (
    heightCm == null ||
    weightKg == null ||
    age == null ||
    !Number.isFinite(heightCm) ||
    !Number.isFinite(weightKg) ||
    !Number.isFinite(age) ||
    heightCm <= 0 ||
    weightKg <= 0 ||
    age <= 0
  ) {
    return { min: null, max: null };
  }

  const bmr = estimateBmrKcal({ weightKg, heightCm, age, sex });
  const tdee = bmr * CFG.activityFactors[activityLevel];
  let center = tdee;
  let min = tdee * (1 - CFG.calorieRangePercent);
  let max = tdee * (1 + CFG.calorieRangePercent);

  if (weightGoal === "gradual_loss") {
    min += CFG.gradualLossCalorieDelta.min;
    max += CFG.gradualLossCalorieDelta.max;
    center = (min + max) / 2;
  }

  // 極端な低カロリーは提案しない（下限の安全フロア）
  const floor = 1200;
  min = Math.max(floor, min);
  max = Math.max(min + 50, max);
  void center;

  return { min: round0(min), max: round0(max) };
}

function needsMedicationSafety(answers: ReferenceGoalAnswers): boolean {
  return answers.usesInsulin || answers.usesHypoglycemiaRiskMedication;
}

function needsIndividualConsultation(answers: ReferenceGoalAnswers): boolean {
  return answers.hasKidneyDisease || answers.isPregnant || answers.isUnder18;
}

/**
 * 参考糖質量の日次範囲。
 * clinicianDirected は指示値優先。インスリン等では大幅削減を提案しない。
 */
export function calculateReferenceCarbRange(input: {
  caloriesMin: number | null;
  caloriesMax: number | null;
  policy: CarbPolicy;
  answers: ReferenceGoalAnswers;
}): {
  dayMin: number | null;
  dayMax: number | null;
  usedClinicianValues: boolean;
  effectivePolicy: CarbPolicy;
} {
  const { caloriesMin, caloriesMax, answers } = input;
  let policy = input.policy;
  const medicationRisk = needsMedicationSafety(answers);

  if (policy === "moderatelyLowerCarb" && medicationRisk) {
    policy = "balanced";
  }

  if (policy === "clinicianDirected") {
    const day = answers.clinicianCarbsPerDay;
    const mealMin = answers.clinicianCarbsPerMealMin;
    const mealMax = answers.clinicianCarbsPerMealMax;
    if (day != null && Number.isFinite(day) && day >= 0) {
      return {
        dayMin: round0(day * 0.95),
        dayMax: round0(day * 1.05),
        usedClinicianValues: true,
        effectivePolicy: policy,
      };
    }
    if (
      mealMin != null &&
      mealMax != null &&
      Number.isFinite(mealMin) &&
      Number.isFinite(mealMax)
    ) {
      // 食あたり × 食事回数の概算（間食は別配分で扱う）
      const count = CFG.mealDistribution[answers.mealPattern].mealCount;
      return {
        dayMin: round0(mealMin * count),
        dayMax: round0(mealMax * count),
        usedClinicianValues: true,
        effectivePolicy: policy,
      };
    }
    // 指示値不足時は balanced 参考にフォールバック（保存可否は呼び出し側で制御）
    policy = "balanced";
  }

  if (policy === "manual") {
    return {
      dayMin: null,
      dayMax: null,
      usedClinicianValues: false,
      effectivePolicy: policy,
    };
  }

  if (caloriesMin == null || caloriesMax == null) {
    return {
      dayMin: null,
      dayMax: null,
      usedClinicianValues: false,
      effectivePolicy: policy,
    };
  }

  const ratio =
    policy === "moderatelyLowerCarb"
      ? CFG.carbEnergyRatio.moderatelyLowerCarb
      : CFG.carbEnergyRatio.balanced;

  const dayMin = round0(
    (caloriesMin * ratio.min) / CFG.kcalPerGramCarb,
  );
  const dayMax = round0(
    (caloriesMax * ratio.max) / CFG.kcalPerGramCarb,
  );

  return {
    dayMin: Math.min(dayMin, dayMax),
    dayMax: Math.max(dayMin, dayMax),
    usedClinicianValues: false,
    effectivePolicy: policy,
  };
}

/** 食事回数に応じて糖質を配分 */
export function distributeCarbsAcrossMeals(input: {
  carbsPerDayMin: number | null;
  carbsPerDayMax: number | null;
  mealPattern: ReferenceGoalAnswers["mealPattern"];
  clinicianMealMin: number | null;
  clinicianMealMax: number | null;
  usedClinicianValues: boolean;
}): CarbDistribution {
  const dist = CFG.mealDistribution[input.mealPattern];
  if (
    input.usedClinicianValues &&
    input.clinicianMealMin != null &&
    input.clinicianMealMax != null
  ) {
    const snackShare = dist.snack;
    const dayMin = input.carbsPerDayMin;
    const dayMax = input.carbsPerDayMax;
    return {
      carbsPerMealMin: round0(input.clinicianMealMin),
      carbsPerMealMax: round0(input.clinicianMealMax),
      carbsPerDayMin: dayMin,
      carbsPerDayMax: dayMax,
      snackCarbsMin:
        snackShare > 0 && dayMin != null ? round0(dayMin * snackShare) : null,
      snackCarbsMax:
        snackShare > 0 && dayMax != null ? round0(dayMax * snackShare) : null,
      mealCount: dist.mealCount,
    };
  }

  if (input.carbsPerDayMin == null || input.carbsPerDayMax == null) {
    return {
      carbsPerMealMin: null,
      carbsPerMealMax: null,
      carbsPerDayMin: null,
      carbsPerDayMax: null,
      snackCarbsMin: null,
      snackCarbsMax: null,
      mealCount: dist.mealCount,
    };
  }

  return {
    carbsPerMealMin: round0(input.carbsPerDayMin * dist.meal),
    carbsPerMealMax: round0(input.carbsPerDayMax * dist.meal),
    carbsPerDayMin: input.carbsPerDayMin,
    carbsPerDayMax: input.carbsPerDayMax,
    snackCarbsMin:
      dist.snack > 0 ? round0(input.carbsPerDayMin * dist.snack) : null,
    snackCarbsMax:
      dist.snack > 0 ? round0(input.carbsPerDayMax * dist.snack) : null,
    mealCount: dist.mealCount,
  };
}

export function estimateStaplePortion(
  carbsPerMealMin: number | null,
  carbsPerMealMax: number | null,
): StaplePortionReference {
  if (carbsPerMealMin == null || carbsPerMealMax == null) {
    return {
      cookedRiceGramsMin: null,
      cookedRiceGramsMax: null,
      note: "主食量の参考は算出できませんでした",
    };
  }
  // 1食糖質の約55%を主食由来と仮定した炊飯ごはん量（参考）
  const stapleShare = 0.55;
  const per100 = CFG.cookedRiceCarbsPer100g;
  const minG = round0(((carbsPerMealMin * stapleShare) / per100) * 100);
  const maxG = round0(((carbsPerMealMax * stapleShare) / per100) * 100);
  return {
    cookedRiceGramsMin: minG,
    cookedRiceGramsMax: maxG,
    note: "炊飯ごはん量の目安です。パンや麺の場合は分量を読み替えてください（参考）。",
  };
}

const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  low: "少なめ",
  moderate: "普通",
  high: "多め",
};

const GOAL_LABEL: Record<WeightGoal, string> = {
  maintain: "体重維持",
  gradual_loss: "ゆっくり減量",
  doctor_directed: "医師指定の目標体重",
  unknown: "未定",
};

export function createReferenceGoalExplanation(input: {
  activityLevel: ActivityLevel;
  weightGoal: WeightGoal;
  carbPolicy: CarbPolicy;
  usedClinicianValues: boolean;
}): string {
  if (input.usedClinicianValues) {
    return "医師または管理栄養士から案内された糖質量を優先して参考範囲を表示しています。";
  }
  const policyNote =
    input.carbPolicy === "moderatelyLowerCarb"
      ? "方針『やや糖質控えめ（極端な低糖質ではない）』"
      : input.carbPolicy === "balanced"
        ? "方針『バランス重視』"
        : input.carbPolicy === "manual"
          ? "方針『自分で数値を入れる』"
          : "方針『医療者の指示を優先』";
  return `身長・体重・年齢、活動量『${ACTIVITY_LABEL[input.activityLevel]}』、目標『${GOAL_LABEL[input.weightGoal]}』、${policyNote}を基に計算しました。`;
}

/** 回答全体から参考目標結果を生成する */
export function buildReferenceGoalResult(
  answers: ReferenceGoalAnswers,
): ReferenceGoalResult {
  const warnings: string[] = [];
  const medicationRisk = needsMedicationSafety(answers);
  const special = needsIndividualConsultation(answers);

  if (medicationRisk) {
    warnings.push(CFG.disclaimers.medicationWarning);
  }
  if (special) {
    warnings.push(CFG.disclaimers.specialCondition);
  }

  let policy = answers.carbPolicy;
  if (medicationRisk && policy === "moderatelyLowerCarb") {
    policy = "balanced";
    warnings.push(
      "インスリンまたは低血糖リスクのある薬を使用中のため、糖質量の大幅な削減は提案せず、バランス重視の参考範囲を表示しています。",
    );
  }

  const bmi = calculateBmi(answers.heightCm, answers.weightKg);
  const bmiCategory = classifyBmi(bmi);
  const referenceWeightKg = calculateReferenceWeight(answers.heightCm);
  const calories = calculateReferenceCalories({
    heightCm: answers.heightCm,
    weightKg: answers.weightKg,
    age: answers.age,
    sex: answers.sex,
    activityLevel: answers.activityLevel,
    weightGoal: answers.weightGoal,
  });

  const carbDay = calculateReferenceCarbRange({
    caloriesMin: calories.min,
    caloriesMax: calories.max,
    policy,
    answers,
  });

  const distribution = distributeCarbsAcrossMeals({
    carbsPerDayMin: carbDay.dayMin,
    carbsPerDayMax: carbDay.dayMax,
    mealPattern: answers.mealPattern,
    clinicianMealMin: answers.clinicianCarbsPerMealMin,
    clinicianMealMax: answers.clinicianCarbsPerMealMax,
    usedClinicianValues: carbDay.usedClinicianValues,
  });

  const staplePortion = estimateStaplePortion(
    distribution.carbsPerMealMin,
    distribution.carbsPerMealMax,
  );

  const explanation = createReferenceGoalExplanation({
    activityLevel: answers.activityLevel,
    weightGoal: answers.weightGoal,
    carbPolicy: carbDay.effectivePolicy,
    usedClinicianValues: carbDay.usedClinicianValues,
  });

  const hasCoreNumbers =
    bmi != null &&
    calories.min != null &&
    calories.max != null &&
    (carbDay.usedClinicianValues ||
      (distribution.carbsPerDayMin != null &&
        distribution.carbsPerMealMin != null));

  // 特別条件がある場合は保存可能な参考値として扱わない
  const canApplyAsReference = hasCoreNumbers && !special && policy !== "manual";

  return {
    bmi,
    bmiCategory,
    referenceWeightKg,
    caloriesMin: calories.min,
    caloriesMax: calories.max,
    carbsPerDayMin: distribution.carbsPerDayMin,
    carbsPerDayMax: distribution.carbsPerDayMax,
    carbsPerMealMin: distribution.carbsPerMealMin,
    carbsPerMealMax: distribution.carbsPerMealMax,
    snackCarbsMin: distribution.snackCarbsMin,
    snackCarbsMax: distribution.snackCarbsMax,
    staplePortion,
    activityLevel: answers.activityLevel,
    weightGoal: answers.weightGoal,
    carbPolicy: carbDay.effectivePolicy,
    explanation,
    warnings,
    canApplyAsReference,
    requiresIndividualConsultation: special,
    usedClinicianValues: carbDay.usedClinicianValues,
  };
}

export function activityLevelDescription(level: ActivityLevel): string {
  switch (level) {
    case "low":
      return "デスクワークが中心で、運動はほとんどしない";
    case "moderate":
      return "通勤や家事に加え、軽い運動を週に数回する";
    case "high":
      return "立ち仕事や運動が多く、身体を動かす時間が多い";
  }
}
