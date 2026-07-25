import { describe, expect, it } from "vitest";
import {
  evaluateCarbTargetStatus,
  sumMealNutrition,
  weeklyNutritionTotals,
} from "@/lib/diabetes-meal-support/aggregate";
import { scoreDiabetesMealSupport } from "@/lib/diabetes-meal-support/score";
import {
  assertSuggestionsAreProposalsOnly,
  buildDiabetesImprovementSuggestions,
} from "@/lib/diabetes-meal-support/suggestions";
import { buildDiabetesMealSupportReport } from "@/lib/diabetes-meal-support/report";
import { resolveRecipeMealNutrition } from "@/lib/diabetes-meal-support/recipe-nutrition";
import { generateWeeklyMealPlan } from "@/lib/weekly-auto-plan/generate";
import { getWeekDates } from "@/lib/date";
import type { DiabetesMealSupportSettings } from "@/types/diabetes-meal-support";
import type { DayMeal, MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";

function settingsStub(
  patch: Partial<DiabetesMealSupportSettings> = {},
): DiabetesMealSupportSettings {
  return {
    diabetesMealSupportEnabled: false,
    targetCarbsPerMealMin: null,
    targetCarbsPerMealMax: null,
    targetCarbsPerDay: null,
    prioritizeFiber: false,
    prioritizeNonStarchyVegetables: false,
    limitSodium: false,
    limitSaturatedFat: false,
    preferredStaplePortionGrams: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

function recipeStub(
  partial: Partial<Recipe> & Pick<Recipe, "id" | "name" | "course">,
): Recipe {
  return {
    ingredients: [],
    steps: [{ id: "s1", order: 1, text: "作る" }],
    category: "和食",
    tags: [],
    servings: 2,
    cookingTimeMinutes: 20,
    calories: null,
    protein: null,
    fat: null,
    carbohydrates: null,
    salt: null,
    vegetables: null,
    nutritionStatus: "unavailable",
    caloriesKcal: null,
    carbohydratesG: null,
    sugarsG: null,
    dietaryFiberG: null,
    proteinG: null,
    fatG: null,
    saturatedFatG: null,
    sodiumMg: null,
    saltEquivalentG: null,
    proteinType: null,
    season: null,
    difficulty: null,
    favoriteScore: null,
    healthyScore: null,
    isSample: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function emptyDays(weekStart: string): DayMeal[] {
  return getWeekDates(weekStart).map((date) => ({
    date,
    locked: false,
    items: [],
  }));
}

describe("糖尿病配慮モード", () => {
  const weekStart = "2026-07-20";

  it("糖質目標内の献立が加点される", () => {
    const recipe = recipeStub({
      id: "in-range",
      name: "目標内の主菜",
      course: "主菜",
      nutritionStatus: "estimated",
      carbohydratesG: 40,
      caloriesKcal: 350,
      proteinG: 20,
      fatG: 10,
    });
    const delta = scoreDiabetesMealSupport(recipe, {
      settings: settingsStub({
        diabetesMealSupportEnabled: true,
        targetCarbsPerMealMin: 30,
        targetCarbsPerMealMax: 50,
      }),
      dayCoursesSoFar: [],
      previousDayRecipes: [],
      evaluateAsMealCarbAnchor: true,
    });
    expect(delta.scoreDelta).toBeGreaterThan(0);
    expect(delta.reasons.some((r) => r.detail.includes("目標範囲内"))).toBe(
      true,
    );
  });

  it("上限超過が減点される", () => {
    const recipe = recipeStub({
      id: "over",
      name: "糖質多め",
      course: "主菜",
      nutritionStatus: "estimated",
      carbohydratesG: 90,
      caloriesKcal: 600,
      proteinG: 20,
      fatG: 15,
    });
    const delta = scoreDiabetesMealSupport(recipe, {
      settings: settingsStub({
        diabetesMealSupportEnabled: true,
        targetCarbsPerMealMax: 50,
      }),
      dayCoursesSoFar: [],
      previousDayRecipes: [],
      evaluateAsMealCarbAnchor: true,
    });
    expect(delta.scoreDelta).toBeLessThan(0);
    expect(delta.reasons.some((r) => r.detail.includes("上限を超過"))).toBe(
      true,
    );
  });

  it("null栄養値を0として扱わない", () => {
    const recipe = recipeStub({
      id: "nulls",
      name: "栄養不明",
      course: "主菜",
      nutritionStatus: "unavailable",
      carbohydratesG: null,
      caloriesKcal: null,
    });
    const resolved = resolveRecipeMealNutrition(recipe);
    expect(resolved.carbohydratesG).toBeNull();
    expect(resolved.caloriesKcal).toBeNull();

    const sum = sumMealNutrition([recipe]);
    expect(sum.carbohydratesG).toBeNull();
    expect(sum.caloriesKcal).toBeNull();
    // 0埋めされていない
    expect(sum.carbohydratesG).not.toBe(0);
  });

  it("栄養カバー率が正しく計算される", () => {
    const withInfo = recipeStub({
      id: "a",
      name: "あり",
      course: "主菜",
      nutritionStatus: "estimated",
      caloriesKcal: 300,
      carbohydratesG: 40,
      proteinG: 20,
      fatG: 10,
    });
    const without = recipeStub({
      id: "b",
      name: "なし",
      course: "副菜",
      nutritionStatus: "unavailable",
    });
    const totals = sumMealNutrition([withInfo, without]);
    expect(totals.recipeCount).toBe(2);
    expect(totals.recipesWithNutrition).toBe(1);
    expect(totals.nutritionCoverage).toBe(50);
    // 片方 null なので炭水化物合計は不完全
    expect(totals.carbohydratesG).toBeNull();
  });

  it("設定OFFでは従来の編成結果へ影響しない", () => {
    const recipes = [
      recipeStub({
        id: "m1",
        name: "主菜A",
        course: "主菜",
        proteinType: "鶏",
        cookingTimeMinutes: 20,
        nutritionStatus: "estimated",
        carbohydratesG: 80,
        caloriesKcal: 500,
        proteinG: 25,
        fatG: 15,
      }),
      recipeStub({
        id: "m2",
        name: "主菜B",
        course: "主菜",
        proteinType: "魚",
        cookingTimeMinutes: 20,
        nutritionStatus: "estimated",
        carbohydratesG: 35,
        caloriesKcal: 350,
        proteinG: 25,
        fatG: 12,
      }),
      ...Array.from({ length: 7 }, (_, i) =>
        recipeStub({
          id: `s${i}`,
          name: `副菜${i}`,
          course: "副菜",
          cookingTimeMinutes: 10,
        }),
      ),
      ...Array.from({ length: 7 }, (_, i) =>
        recipeStub({
          id: `u${i}`,
          name: `汁${i}`,
          course: "汁物",
          cookingTimeMinutes: 10,
        }),
      ),
    ];

    const off = generateWeeklyMealPlan({
      weekStart,
      days: emptyDays(weekStart),
      recipes,
      diabetesSettings: settingsStub({ diabetesMealSupportEnabled: false }),
    });
    const alsoOff = generateWeeklyMealPlan({
      weekStart,
      days: emptyDays(weekStart),
      recipes,
      diabetesSettings: settingsStub({ diabetesMealSupportEnabled: false }),
    });
    expect(off.days.map((d) => d.items.map((i) => i.recipeId))).toEqual(
      alsoOff.days.map((d) => d.items.map((i) => i.recipeId)),
    );
  });

  it("ロック済み献立を勝手に変更しない", () => {
    const recipes = [
      recipeStub({ id: "lock-main", name: "固定主菜", course: "主菜" }),
      recipeStub({ id: "other-main", name: "別主菜", course: "主菜" }),
      recipeStub({ id: "side1", name: "副菜1", course: "副菜" }),
      recipeStub({ id: "soup1", name: "汁1", course: "汁物" }),
    ];
    const days = emptyDays(weekStart);
    days[0] = {
      date: days[0].date,
      locked: false,
      items: [
        {
          id: "locked-slot",
          recipeId: "lock-main",
          course: "主菜",
          order: 1,
          slotLocked: true,
          source: "manual",
        },
      ],
    };
    const result = generateWeeklyMealPlan({
      weekStart,
      days,
      recipes,
      diabetesSettings: settingsStub({
        diabetesMealSupportEnabled: true,
        targetCarbsPerMealMax: 40,
      }),
      scope: { type: "week" },
    });
    const main = result.days[0].items.find((i) => i.course === "主菜");
    expect(main?.recipeId).toBe("lock-main");
    expect(main?.slotLocked).toBe(true);
  });

  it("改善候補が提案のみで自動適用されない", () => {
    const recipes = [
      recipeStub({
        id: "heavy",
        name: "カツ丼",
        course: "主菜",
        category: "丼物",
        nutritionStatus: "estimated",
        carbohydratesG: 100,
        caloriesKcal: 800,
        proteinG: 30,
        fatG: 30,
      }),
    ];
    const plan: MealPlan = {
      id: "p",
      weekStart,
      days: [
        {
          date: weekStart,
          locked: false,
          items: [
            {
              id: "1",
              recipeId: "heavy",
              course: "主菜",
              order: 1,
            },
          ],
        },
      ],
      createdAt: "",
      updatedAt: "",
    };
    const before = JSON.stringify(plan);
    const suggestions = buildDiabetesImprovementSuggestions(
      plan,
      recipes,
      settingsStub({
        diabetesMealSupportEnabled: true,
        targetCarbsPerMealMax: 50,
      }),
    );
    expect(suggestions.length).toBeGreaterThan(0);
    expect(assertSuggestionsAreProposalsOnly(suggestions)).toBe(true);
    expect(JSON.stringify(plan)).toBe(before);
  });

  it("日・週集計が正しい", () => {
    const r1 = recipeStub({
      id: "r1",
      name: "A",
      course: "主菜",
      nutritionStatus: "estimated",
      carbohydratesG: 40,
      caloriesKcal: 300,
      proteinG: 20,
      fatG: 10,
      dietaryFiberG: 5,
    });
    const r2 = recipeStub({
      id: "r2",
      name: "B",
      course: "副菜",
      nutritionStatus: "estimated",
      carbohydratesG: 10,
      caloriesKcal: 80,
      proteinG: 3,
      fatG: 2,
      dietaryFiberG: 4,
    });
    const plan: MealPlan = {
      id: "p",
      weekStart,
      days: [
        {
          date: weekStart,
          locked: false,
          items: [
            { id: "1", recipeId: "r1", course: "主菜", order: 1 },
            { id: "2", recipeId: "r2", course: "副菜", order: 2 },
          ],
        },
        ...emptyDays(weekStart).slice(1),
      ],
      createdAt: "",
      updatedAt: "",
    };
    const weekly = weeklyNutritionTotals(
      plan,
      [r1, r2],
      settingsStub({ targetCarbsPerDay: 200 }),
    );
    expect(weekly.daily[0].carbohydratesG).toBe(50);
    expect(weekly.daily[0].caloriesKcal).toBe(380);
    expect(weekly.daily[0].dietaryFiberG).toBe(9);
    expect(weekly.carbohydratesG).toBe(50);
    expect(weekly.nutritionCoverage).toBe(100);
  });

  it("レポートに免責と糖質/血糖の区別が含まれる", () => {
    const plan: MealPlan = {
      id: "p",
      weekStart,
      days: emptyDays(weekStart),
      createdAt: "",
      updatedAt: "",
    };
    const report = buildDiabetesMealSupportReport(
      plan,
      [],
      settingsStub({ diabetesMealSupportEnabled: true }),
    );
    expect(report.disclaimer).toContain("医療上の判断や治療の代わりにはなりません");
    expect(report.carbDisclaimer).toContain("糖質");
    expect(report.carbDisclaimer).toContain("血糖値");
  });

  it("糖質目標未設定時は no_target", () => {
    expect(
      evaluateCarbTargetStatus(40, settingsStub(), "meal"),
    ).toBe("no_target");
  });
});
