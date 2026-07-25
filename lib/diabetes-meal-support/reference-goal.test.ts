import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  calculateBmi,
  calculateReferenceCalories,
  calculateReferenceCarbRange,
  calculateReferenceWeight,
  distributeCarbsAcrossMeals,
  buildReferenceGoalResult,
  createReferenceGoalExplanation,
} from "@/lib/diabetes-meal-support/reference-goal";
import { DEFAULT_REFERENCE_GOAL_ANSWERS } from "@/lib/diabetes-meal-support/reference-goal-types";
import { resolveEffectiveCarbTargets } from "@/lib/diabetes-meal-support/resolve-targets";
import { REFERENCE_GOAL_CONFIG } from "@/lib/diabetes-meal-support/reference-goal-config";
import { scoreDiabetesMealSupport } from "@/lib/diabetes-meal-support/score";
import type { DiabetesMealSupportSettings } from "@/types/diabetes-meal-support";
import type { Recipe } from "@/types/recipe";

function settingsStub(
  patch: Partial<DiabetesMealSupportSettings> = {},
): DiabetesMealSupportSettings {
  return {
    diabetesMealSupportEnabled: true,
    targetCarbsPerMealMin: null,
    targetCarbsPerMealMax: null,
    targetCarbsPerDay: null,
    prioritizeFiber: false,
    prioritizeNonStarchyVegetables: false,
    limitSodium: false,
    limitSaturatedFat: false,
    preferredStaplePortionGrams: null,
    goalSource: null,
    questionnaireCompletedAt: null,
    referenceCaloriesMin: null,
    referenceCaloriesMax: null,
    referenceCarbsPerDayMin: null,
    referenceCarbsPerDayMax: null,
    referenceCarbsPerMealMin: null,
    referenceCarbsPerMealMax: null,
    bmi: null,
    bmiCategory: null,
    usesInsulin: false,
    usesHypoglycemiaRiskMedication: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

function recipeStub(): Recipe {
  return {
    id: "r1",
    name: "テスト主菜",
    ingredients: [],
    steps: [{ id: "s1", order: 1, text: "作る" }],
    category: "和食",
    course: "主菜",
    tags: [],
    servings: 2,
    cookingTimeMinutes: 20,
    calories: null,
    protein: null,
    fat: null,
    carbohydrates: null,
    salt: null,
    vegetables: null,
    proteinType: null,
    season: null,
    difficulty: null,
    favoriteScore: null,
    healthyScore: null,
    isSample: false,
    carbohydratesG: 55,
    nutritionCoverage: 80,
    createdAt: "",
    updatedAt: "",
  };
}

describe("参考目標ウィザード計算", () => {
  it("BMIを正しく計算し、不正値はnull", () => {
    expect(calculateBmi(170, 68)).toBeCloseTo(23.5, 1);
    expect(calculateBmi(null, 68)).toBeNull();
    expect(calculateBmi(170, null)).toBeNull();
    expect(calculateBmi(0, 68)).toBeNull();
    expect(calculateBmi(-1, 68)).toBeNull();
  });

  it("参考体重を身長から算出する", () => {
    const ref = calculateReferenceWeight(160);
    expect(ref).not.toBeNull();
    expect(ref!).toBeCloseTo(22 * 1.6 * 1.6, 1);
    expect(calculateReferenceWeight(null)).toBeNull();
  });

  it("活動量で参考エネルギー範囲が変わる", () => {
    const base = {
      heightCm: 165,
      weightKg: 60,
      age: 40,
      sex: "female" as const,
      weightGoal: "maintain" as const,
    };
    const low = calculateReferenceCalories({ ...base, activityLevel: "low" });
    const high = calculateReferenceCalories({ ...base, activityLevel: "high" });
    expect(low.min).not.toBeNull();
    expect(high.min).not.toBeNull();
    expect(high.min!).toBeGreaterThan(low.min!);
    expect(high.max!).toBeGreaterThan(low.max!);
  });

  it("維持よりゆっくり減量の方がエネルギー範囲が低い", () => {
    const base = {
      heightCm: 170,
      weightKg: 70,
      age: 45,
      sex: "male" as const,
      activityLevel: "moderate" as const,
    };
    const maintain = calculateReferenceCalories({
      ...base,
      weightGoal: "maintain",
    });
    const loss = calculateReferenceCalories({
      ...base,
      weightGoal: "gradual_loss",
    });
    expect(loss.max!).toBeLessThan(maintain.max!);
  });

  it("食事回数で1食あたり配分が変わる", () => {
    const two = distributeCarbsAcrossMeals({
      carbsPerDayMin: 180,
      carbsPerDayMax: 220,
      mealPattern: "twoMeals",
      clinicianMealMin: null,
      clinicianMealMax: null,
      usedClinicianValues: false,
    });
    const three = distributeCarbsAcrossMeals({
      carbsPerDayMin: 180,
      carbsPerDayMax: 220,
      mealPattern: "threeMeals",
      clinicianMealMin: null,
      clinicianMealMax: null,
      usedClinicianValues: false,
    });
    const withSnack = distributeCarbsAcrossMeals({
      carbsPerDayMin: 180,
      carbsPerDayMax: 220,
      mealPattern: "threeMealsWithSnacks",
      clinicianMealMin: null,
      clinicianMealMax: null,
      usedClinicianValues: false,
    });
    expect(two.carbsPerMealMin!).toBeGreaterThan(three.carbsPerMealMin!);
    expect(withSnack.snackCarbsMin).not.toBeNull();
    expect(three.snackCarbsMin).toBeNull();
  });

  it("clinician指示値を最優先する", () => {
    const answers = {
      ...DEFAULT_REFERENCE_GOAL_ANSWERS,
      heightCm: 165,
      weightKg: 60,
      age: 40,
      sex: "female" as const,
      carbPolicy: "clinicianDirected" as const,
      clinicianCarbsPerMealMin: 40,
      clinicianCarbsPerMealMax: 50,
      clinicianCarbsPerDay: 150,
    };
    const range = calculateReferenceCarbRange({
      caloriesMin: 1800,
      caloriesMax: 2000,
      policy: "clinicianDirected",
      answers,
    });
    expect(range.usedClinicianValues).toBe(true);
    expect(range.dayMin).toBeGreaterThan(0);
    const result = buildReferenceGoalResult(answers);
    expect(result.usedClinicianValues).toBe(true);
    expect(result.carbsPerMealMin).toBe(40);
    expect(result.carbsPerMealMax).toBe(50);
  });

  it("インスリン使用時は安全警告と大幅削減回避", () => {
    const answers = {
      ...DEFAULT_REFERENCE_GOAL_ANSWERS,
      heightCm: 165,
      weightKg: 60,
      age: 40,
      sex: "female" as const,
      usesInsulin: true,
      treatmentUnknown: false,
      carbPolicy: "moderatelyLowerCarb" as const,
    };
    const result = buildReferenceGoalResult(answers);
    expect(
      result.warnings.some((w) =>
        w.includes(REFERENCE_GOAL_CONFIG.disclaimers.medicationWarning),
      ),
    ).toBe(true);
    expect(result.carbPolicy).toBe("balanced");
    expect(result.explanation).toContain("普通");
  });

  it("低血糖リスク薬使用時も安全警告がある", () => {
    const result = buildReferenceGoalResult({
      ...DEFAULT_REFERENCE_GOAL_ANSWERS,
      heightCm: 170,
      weightKg: 65,
      age: 50,
      sex: "male",
      usesHypoglycemiaRiskMedication: true,
      treatmentUnknown: false,
      carbPolicy: "moderatelyLowerCarb",
    });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.carbPolicy).toBe("balanced");
  });

  it("特別条件では保存可能な参考値にしない", () => {
    const result = buildReferenceGoalResult({
      ...DEFAULT_REFERENCE_GOAL_ANSWERS,
      heightCm: 160,
      weightKg: 55,
      age: 30,
      sex: "female",
      isPregnant: true,
    });
    expect(result.requiresIndividualConsultation).toBe(true);
    expect(result.canApplyAsReference).toBe(false);
  });

  it("計算理由文を生成する", () => {
    const text = createReferenceGoalExplanation({
      activityLevel: "moderate",
      weightGoal: "gradual_loss",
      carbPolicy: "balanced",
      usedClinicianValues: false,
    });
    expect(text).toContain("普通");
    expect(text).toContain("ゆっくり減量");
  });
});

describe("目標値の優先順位", () => {
  it("manualがquestionnaireのreferenceより優先される", () => {
    const effective = resolveEffectiveCarbTargets(
      settingsStub({
        goalSource: "manual",
        targetCarbsPerMealMin: 30,
        targetCarbsPerMealMax: 40,
        targetCarbsPerDay: 120,
        referenceCarbsPerMealMin: 50,
        referenceCarbsPerMealMax: 60,
        referenceCarbsPerDayMin: 180,
        referenceCarbsPerDayMax: 200,
      }),
    );
    expect(effective.source).toBe("manual");
    expect(effective.mealMin).toBe(30);
    expect(effective.mealMax).toBe(40);
    expect(effective.sourceLabel).toContain("手動");
  });

  it("clinicianが最優先として扱われる", () => {
    const effective = resolveEffectiveCarbTargets(
      settingsStub({
        goalSource: "clinician",
        targetCarbsPerMealMin: 45,
        targetCarbsPerMealMax: 55,
        targetCarbsPerDay: 160,
      }),
    );
    expect(effective.source).toBe("clinician");
    expect(effective.sourceLabel).toContain("医師");
  });

  it("questionnaireはreference値を使う", () => {
    const effective = resolveEffectiveCarbTargets(
      settingsStub({
        goalSource: "questionnaire",
        targetCarbsPerMealMin: 10,
        targetCarbsPerMealMax: 20,
        referenceCarbsPerMealMin: 40,
        referenceCarbsPerMealMax: 50,
        referenceCarbsPerDayMin: 140,
        referenceCarbsPerDayMax: 160,
      }),
    );
    expect(effective.source).toBe("questionnaire");
    expect(effective.mealMin).toBe(40);
    expect(effective.mealMax).toBe(50);
    expect(effective.sourceLabel).toContain("質問");
  });

  it("後方互換: goalSourceなしでもtargetがあればmanual相当", () => {
    const effective = resolveEffectiveCarbTargets(
      settingsStub({
        goalSource: null,
        targetCarbsPerMealMin: 35,
        targetCarbsPerMealMax: 45,
      }),
    );
    expect(effective.source).toBe("manual");
    expect(effective.mealMin).toBe(35);
  });
});

describe("設定OFFでは週間献立スコアへ影響しない", () => {
  it("diabetesMealSupportEnabled=falseなら差分0", () => {
    const delta = scoreDiabetesMealSupport(recipeStub(), {
      settings: settingsStub({
        diabetesMealSupportEnabled: false,
        targetCarbsPerMealMin: 40,
        targetCarbsPerMealMax: 60,
        goalSource: "questionnaire",
        referenceCarbsPerMealMin: 40,
        referenceCarbsPerMealMax: 60,
      }),
      dayCoursesSoFar: [],
      previousDayRecipes: [],
      evaluateAsMealCarbAnchor: true,
    });
    expect(delta.scoreDelta).toBe(0);
  });
});

describe("結果確認前に設定へ保存されない（計算は純関数）", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("window", {
      localStorage: localStorageMock,
      dispatchEvent: () => true,
    });
  });

  it("buildReferenceGoalResultはlocalStorageを変更しない", () => {
    const before = window.localStorage.getItem("meal-planner:diabetesMealSupport");
    buildReferenceGoalResult({
      ...DEFAULT_REFERENCE_GOAL_ANSWERS,
      heightCm: 165,
      weightKg: 60,
      age: 40,
      sex: "female",
    });
    const after = window.localStorage.getItem("meal-planner:diabetesMealSupport");
    expect(after).toBe(before);
  });
});
