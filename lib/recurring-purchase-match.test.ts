import { describe, expect, it } from "vitest";
import {
  dayOfWeekIndex,
  evaluateRecurringPurchaseUsage,
  getRecurringForMealPlanningOnDate,
  getRecurringForShoppingDeduction,
  isRecurringAvailableOnDate,
} from "@/lib/recurring-purchase-match";
import type { RecurringPurchaseIngredient } from "@/types/recurring-purchase-ingredient";
import type { Recipe } from "@/types/recipe";

function makeRecurring(
  overrides: Partial<RecurringPurchaseIngredient> = {},
): RecurringPurchaseIngredient {
  return {
    id: "rec-1",
    householdId: "local",
    name: "牛乳",
    rawName: "牛乳",
    normalizedName: "牛乳",
    foodMasterId: null,
    foodCode: null,
    quantity: 1,
    unit: "本",
    storeId: null,
    storeName: "コープ",
    arrivalDayOfWeek: "wednesday",
    frequency: "weekly",
    active: true,
    preferInMealPlan: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRecipe(ingredientNames: string[]): Recipe {
  return {
    id: "recipe-1",
    name: "テスト料理",
    ingredients: ingredientNames.map((name, index) => ({
      id: `ing-${index}`,
      name,
      quantity: "1",
      unit: "本",
      ingredientType: "vegetable",
    })),
    steps: [],
    tags: [],
    course: "主菜",
    servings: 4,
    cookingTimeMinutes: 20,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("isRecurringAvailableOnDate", () => {
  it("到着前の日付は使用可能在庫として扱わない", () => {
    const item = makeRecurring({ arrivalDayOfWeek: "wednesday" });
    expect(isRecurringAvailableOnDate(item, "2026-08-03")).toBe(false);
    expect(isRecurringAvailableOnDate(item, "2026-08-04")).toBe(false);
  });

  it("到着日以降は在庫相当として扱う", () => {
    const item = makeRecurring({ arrivalDayOfWeek: "wednesday" });
    expect(isRecurringAvailableOnDate(item, "2026-08-05")).toBe(true);
    expect(isRecurringAvailableOnDate(item, "2026-08-09")).toBe(true);
  });

  it("無効または献立優先OFFは献立対象外", () => {
    const inactive = makeRecurring({ active: false });
    const noPrefer = makeRecurring({ preferInMealPlan: false });
    expect(
      getRecurringForMealPlanningOnDate([inactive], "2026-08-06").length,
    ).toBe(0);
    expect(
      getRecurringForMealPlanningOnDate([noPrefer], "2026-08-06").length,
    ).toBe(0);
  });
});

describe("getRecurringForShoppingDeduction", () => {
  it("有効な毎週定期購入を差し引き対象にする", () => {
    const active = makeRecurring();
    const inactive = makeRecurring({ id: "rec-2", active: false });
    const result = getRecurringForShoppingDeduction([active, inactive]);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("rec-1");
  });
});

describe("evaluateRecurringPurchaseUsage", () => {
  it("定期購入食材を使うレシピを加点し理由バッジを返す", () => {
    const item = makeRecurring();
    const recipe = makeRecipe(["牛乳", "砂糖"]);
    const result = evaluateRecurringPurchaseUsage(recipe, [item]);
    expect(result.points).toBeGreaterThan(0);
    expect(result.badges).toContain("定期購入食材を活用");
    expect(result.reasons.some((reason) => reason.includes("牛乳"))).toBe(true);
  });

  it("食材が一致しないレシピは加点しない", () => {
    const item = makeRecurring();
    const recipe = makeRecipe(["豚肉"]);
    const result = evaluateRecurringPurchaseUsage(recipe, [item]);
    expect(result.points).toBe(0);
    expect(result.matchedIds).toHaveLength(0);
  });
});

describe("dayOfWeekIndex", () => {
  it("月曜始まりのインデックスを返す", () => {
    expect(dayOfWeekIndex("monday")).toBe(0);
    expect(dayOfWeekIndex("sunday")).toBe(6);
  });
});
