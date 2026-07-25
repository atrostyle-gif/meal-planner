/**
 * 糖尿病配慮の参考目標ウィザード用の型。
 * 診断・治療ではなく、献立作成のための参考値算出に用いる。
 */

export type SexOption = "male" | "female" | "unspecified";

export type ActivityLevel = "low" | "moderate" | "high";

export type WeightGoal =
  | "maintain"
  | "gradual_loss"
  | "doctor_directed"
  | "unknown";

export type MealPattern =
  | "twoMeals"
  | "threeMeals"
  | "threeMealsWithSnacks"
  | "irregular";

export type CarbPolicy =
  | "balanced"
  | "moderatelyLowerCarb"
  | "clinicianDirected"
  | "manual";

export type GoalSource = "manual" | "questionnaire" | "clinician";

export type BmiCategory =
  | "underweight"
  | "normal"
  | "overweight"
  | "obese"
  | "unknown";

/** ウィザードで収集する回答（計算入力） */
export type ReferenceGoalAnswers = {
  heightCm: number | null;
  weightKg: number | null;
  age: number | null;
  sex: SexOption;
  activityLevel: ActivityLevel;
  weightGoal: WeightGoal;
  doctorDirectedTargetWeightKg: number | null;
  usesInsulin: boolean;
  usesHypoglycemiaRiskMedication: boolean;
  usesOtherDiabetesMedication: boolean;
  dietExerciseOnly: boolean;
  treatmentUnknown: boolean;
  mealPattern: MealPattern;
  carbPolicy: CarbPolicy;
  clinicianCarbsPerMealMin: number | null;
  clinicianCarbsPerMealMax: number | null;
  clinicianCarbsPerDay: number | null;
  hasKidneyDisease: boolean;
  isPregnant: boolean;
  isUnder18: boolean;
};

export const DEFAULT_REFERENCE_GOAL_ANSWERS: ReferenceGoalAnswers = {
  heightCm: null,
  weightKg: null,
  age: null,
  sex: "unspecified",
  activityLevel: "moderate",
  weightGoal: "unknown",
  doctorDirectedTargetWeightKg: null,
  usesInsulin: false,
  usesHypoglycemiaRiskMedication: false,
  usesOtherDiabetesMedication: false,
  dietExerciseOnly: false,
  treatmentUnknown: true,
  mealPattern: "threeMeals",
  carbPolicy: "balanced",
  clinicianCarbsPerMealMin: null,
  clinicianCarbsPerMealMax: null,
  clinicianCarbsPerDay: null,
  hasKidneyDisease: false,
  isPregnant: false,
  isUnder18: false,
};

export type CarbDistribution = {
  carbsPerMealMin: number | null;
  carbsPerMealMax: number | null;
  carbsPerDayMin: number | null;
  carbsPerDayMax: number | null;
  snackCarbsMin: number | null;
  snackCarbsMax: number | null;
  mealCount: number;
};

export type StaplePortionReference = {
  cookedRiceGramsMin: number | null;
  cookedRiceGramsMax: number | null;
  note: string;
};

/** 計算結果（参考値）。保存前の確認用 */
export type ReferenceGoalResult = {
  bmi: number | null;
  bmiCategory: BmiCategory;
  referenceWeightKg: number | null;
  caloriesMin: number | null;
  caloriesMax: number | null;
  carbsPerDayMin: number | null;
  carbsPerDayMax: number | null;
  carbsPerMealMin: number | null;
  carbsPerMealMax: number | null;
  snackCarbsMin: number | null;
  snackCarbsMax: number | null;
  staplePortion: StaplePortionReference;
  activityLevel: ActivityLevel;
  weightGoal: WeightGoal;
  carbPolicy: CarbPolicy;
  explanation: string;
  warnings: string[];
  /** 一般計算を保存可能な参考値として扱ってよいか */
  canApplyAsReference: boolean;
  /** 個別相談が必要 */
  requiresIndividualConsultation: boolean;
  usedClinicianValues: boolean;
};
