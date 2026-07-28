import { describe, expect, it } from "vitest";
import { estimateIngredientPrice } from "@/lib/food-budget/prices";
import { scoreBudgetSupport } from "@/lib/food-budget/score";
import {
  calculateWeekBudgetSummary,
  computePackSplitCost,
} from "@/lib/food-budget/week-cost";
import {
  DEFAULT_FOOD_BUDGET_SETTINGS,
  DEFAULT_MEAL_PLAN_SCORE_WEIGHTS,
} from "@/types/food-budget";
import type { IngredientPriceRecord } from "@/types/ingredient-price";
import type { InventoryItem } from "@/types/inventory";
import type { MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import { LOPIA_STORE_PROFILE } from "@/types/store-profile";
import { generateWeeklyMealPlan } from "@/lib/weekly-auto-plan/generate";
import {
  DEFAULT_DIABETES_MEAL_SUPPORT_SETTINGS,
} from "@/types/diabetes-meal-support";

function makeRecipe(
  id: string,
  name: string,
  ingredients: Recipe["ingredients"],
  extras: Partial<Recipe> = {},
): Recipe {
  const now = "2026-07-01T00:00:00.000Z";
  return {
    id,
    name,
    category: "和食",
    course: "主菜",
    servings: 2,
    cookingTimeMinutes: 20,
    ingredients,
    steps: [{ id: `${id}-s1`, order: 1, text: "作る" }],
    tags: extras.tags ?? [],
    memo: "",
    favoriteScore: null,
    createdAt: now,
    updatedAt: now,
    ...extras,
  };
}

function makePlan(recipeIds: string[]): MealPlan {
  const days = [
    "2026-07-20",
    "2026-07-21",
    "2026-07-22",
    "2026-07-23",
    "2026-07-24",
    "2026-07-25",
    "2026-07-26",
  ].map((date, index) => ({
    date,
    locked: false,
    // テスト用レシピは2人分基準。日別人数も2人にして倍率1にする
    servings: 2,
    servingsMode: "custom" as const,
    items:
      index < recipeIds.length
        ? [
            {
              id: `item-${index}`,
              recipeId: recipeIds[index],
              course: "主菜" as const,
              order: 1,
              source: "manual" as const,
            },
          ]
        : [],
  }));
  return {
    id: "plan-1",
    weekStart: "2026-07-20",
    days,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

describe("食費予算・大容量購入", () => {
  it("1kg購入・600g使用時の購入額・使用原価・繰越価値", () => {
    const result = computePackSplitCost({
      purchasePriceYen: 1200,
      packageGrams: 1000,
      consumedGrams: 600,
    });
    expect(result.estimatedPurchaseCost).toBe(1200);
    expect(result.estimatedConsumedCost).toBe(720);
    expect(result.estimatedCarryoverValue).toBe(480);
  });

  it("価格履歴から直近または中央値を取得し、未登録は0円にしない", () => {
    const records: IngredientPriceRecord[] = [
      {
        id: "1",
        ingredientName: "豚こま",
        normalizedIngredientName: "豚こま",
        storeName: "ロピア",
        purchasePriceYen: 1000,
        packageQuantity: 1,
        packageUnit: "kg",
        gramsEquivalent: 1000,
        pricePer100g: 100,
        purchasedAt: "2026-07-01T00:00:00.000Z",
        isSalePrice: false,
        memo: "",
      },
      {
        id: "2",
        ingredientName: "豚こま",
        normalizedIngredientName: "豚こま",
        storeName: "ロピア",
        purchasePriceYen: 1400,
        packageQuantity: 1,
        packageUnit: "kg",
        gramsEquivalent: 1000,
        pricePer100g: 140,
        purchasedAt: "2026-07-10T00:00:00.000Z",
        isSalePrice: false,
        memo: "",
      },
    ];
    const estimate = estimateIngredientPrice("豚こま", records, "ロピア");
    expect(estimate.source).toBe("median");
    expect(estimate.estimatedPurchasePriceYen).toBe(1200);
    expect(estimate.pricePer100g).toBe(120);

    const missing = estimateIngredientPrice("にんじん", records);
    expect(missing.source).toBe("none");
    expect(missing.estimatedPurchasePriceYen).toBeNull();
  });

  it("既存在庫を差し引いた購入量になる", () => {
    const recipes = [
      makeRecipe("r1", "生姜焼き", [
        {
          id: "i1",
          name: "豚こま",
          quantity: 600,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
      ]),
    ];
    const inventory: InventoryItem[] = [
      {
        id: "inv1",
        name: "豚こま",
        amount: { kind: "quantity", value: 200 },
        unit: "g",
        priority: false,
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ];
    const prices: IngredientPriceRecord[] = [
      {
        id: "p1",
        ingredientName: "豚こま",
        normalizedIngredientName: "豚こま",
        storeName: "ロピア",
        purchasePriceYen: 1200,
        packageQuantity: 1,
        packageUnit: "kg",
        gramsEquivalent: 1000,
        pricePer100g: 120,
        purchasedAt: "2026-07-01T00:00:00.000Z",
        isSalePrice: false,
        memo: "",
      },
    ];
    const summary = calculateWeekBudgetSummary({
      mealPlan: makePlan(["r1"]),
      recipes,
      inventory,
      priceRecords: prices,
      settings: {
        ...DEFAULT_FOOD_BUDGET_SETTINGS,
        storeProfiles: [LOPIA_STORE_PROFILE],
        scoreWeights: { ...DEFAULT_MEAL_PLAN_SCORE_WEIGHTS },
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });
    const line = summary.lines.find(
      (item) =>
        item.ingredientName === "豚こま" ||
        item.ingredientName === "豚こま切れ",
    );
    expect(line).toBeTruthy();
    // 必要600g - 在庫200g = 400g → 1kgパック購入
    expect(line?.purchaseGrams).toBe(1000);
    expect(line?.consumedGrams).toBe(600);
    expect(line?.estimatedPurchaseCostYen).toBe(1200);
  });

  it("常備品は十分なら購入額へ加算しない", () => {
    const recipes = [
      makeRecipe("r1", "炒め物", [
        {
          id: "i1",
          name: "しょうゆ",
          quantity: 1,
          unit: "大さじ",
          note: "",
          ingredientType: "pantrySeasoning",
        },
        {
          id: "i2",
          name: "キャベツ",
          quantity: 200,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
      ]),
    ];
    const prices: IngredientPriceRecord[] = [
      {
        id: "p1",
        ingredientName: "しょうゆ",
        normalizedIngredientName: "しょうゆ",
        storeName: "ロピア",
        purchasePriceYen: 300,
        packageQuantity: 1,
        packageUnit: "本",
        gramsEquivalent: null,
        pricePer100g: null,
        purchasedAt: "2026-07-01T00:00:00.000Z",
        isSalePrice: false,
        memo: "",
      },
      {
        id: "p2",
        ingredientName: "キャベツ",
        normalizedIngredientName: "キャベツ",
        storeName: "ロピア",
        purchasePriceYen: 150,
        packageQuantity: 500,
        packageUnit: "g",
        gramsEquivalent: 500,
        pricePer100g: 30,
        purchasedAt: "2026-07-01T00:00:00.000Z",
        isSalePrice: false,
        memo: "",
      },
    ];
    const summary = calculateWeekBudgetSummary({
      mealPlan: makePlan(["r1"]),
      recipes,
      inventory: [],
      priceRecords: prices,
      settings: {
        ...DEFAULT_FOOD_BUDGET_SETTINGS,
        storeProfiles: [LOPIA_STORE_PROFILE],
        scoreWeights: { ...DEFAULT_MEAL_PLAN_SCORE_WEIGHTS },
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
      getStockStatus: (name) =>
        name.includes("しょうゆ") ? "enough" : "unknown",
    });
    const soy = summary.lines.find((item) => item.ingredientName === "しょうゆ");
    expect(soy?.purchaseSkipped).toBe(true);
    expect(soy?.estimatedPurchaseCostYen).toBe(0);
    // しょうゆ分は週合計購入額に乗らない
    expect(summary.estimatedPurchaseCostYen).toBe(150);
  });

  it("大容量食材を複数料理に配分できる", () => {
    const recipes = [
      makeRecipe("r1", "生姜焼き", [
        {
          id: "i1",
          name: "豚こま",
          quantity: 350,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
      ]),
      makeRecipe("r2", "豚汁", [
        {
          id: "i2",
          name: "豚こま",
          quantity: 250,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
      ], { course: "汁物" }),
      makeRecipe("r3", "回鍋肉", [
        {
          id: "i3",
          name: "豚こま",
          quantity: 300,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
      ]),
    ];
    const prices: IngredientPriceRecord[] = [
      {
        id: "p1",
        ingredientName: "豚こま",
        normalizedIngredientName: "豚こま",
        storeName: "ロピア",
        purchasePriceYen: 1200,
        packageQuantity: 1,
        packageUnit: "kg",
        gramsEquivalent: 1000,
        pricePer100g: 120,
        purchasedAt: "2026-07-01T00:00:00.000Z",
        isSalePrice: false,
        memo: "",
      },
    ];
    const summary = calculateWeekBudgetSummary({
      mealPlan: makePlan(["r1", "r2", "r3"]),
      recipes,
      inventory: [],
      priceRecords: prices,
      settings: {
        ...DEFAULT_FOOD_BUDGET_SETTINGS,
        storeProfiles: [LOPIA_STORE_PROFILE],
        scoreWeights: { ...DEFAULT_MEAL_PLAN_SCORE_WEIGHTS },
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });
    expect(summary.bulkSuggestions.length).toBeGreaterThan(0);
    expect(summary.bulkSuggestions[0]?.summary).toContain("3品で使用");
    expect(summary.bulkSuggestions[0]?.leftoverSummary).toMatch(/残り|冷凍/);
  });

  it("予算超過レシピが減点される", () => {
    const cheap = makeRecipe("cheap", "安い炒め", [
      {
        id: "i1",
        name: "キャベツ",
        quantity: 100,
        unit: "g",
        note: "",
        ingredientType: "normal",
      },
    ]);
    const expensive = makeRecipe("exp", "高い肉料理", [
      {
        id: "i2",
        name: "和牛",
        quantity: 500,
        unit: "g",
        note: "",
        ingredientType: "normal",
      },
    ]);
    const prices: IngredientPriceRecord[] = [
      {
        id: "p1",
        ingredientName: "和牛",
        normalizedIngredientName: "和牛",
        storeName: "ロピア",
        purchasePriceYen: 5000,
        packageQuantity: 500,
        packageUnit: "g",
        gramsEquivalent: 500,
        pricePer100g: 1000,
        purchasedAt: "2026-07-01T00:00:00.000Z",
        isSalePrice: false,
        memo: "",
      },
      {
        id: "p2",
        ingredientName: "キャベツ",
        normalizedIngredientName: "キャベツ",
        storeName: "ロピア",
        purchasePriceYen: 150,
        packageQuantity: 500,
        packageUnit: "g",
        gramsEquivalent: 500,
        pricePer100g: 30,
        purchasedAt: "2026-07-01T00:00:00.000Z",
        isSalePrice: false,
        memo: "",
      },
    ];
    const settings = {
      ...DEFAULT_FOOD_BUDGET_SETTINGS,
      weeklyFoodBudgetYen: 2000,
      storeProfiles: [LOPIA_STORE_PROFILE],
      scoreWeights: { ...DEFAULT_MEAL_PLAN_SCORE_WEIGHTS },
      updatedAt: "2026-07-01T00:00:00.000Z",
    };
    const baseCtx = {
      settings,
      store: LOPIA_STORE_PROFILE,
      priceRecords: prices,
      inventory: [] as InventoryItem[],
      selectedRecipes: [] as Recipe[],
      weeklyFoodBudgetYen: 2000,
      runningPurchaseCostYen: 0,
    };
    const cheapScore = scoreBudgetSupport(cheap, baseCtx);
    const expensiveScore = scoreBudgetSupport(expensive, baseCtx);
    expect(expensiveScore.scoreDelta).toBeLessThan(cheapScore.scoreDelta);
  });

  it("同じ食材共有は加点し、味付け連続は減点方向", () => {
    const first = makeRecipe(
      "r1",
      "生姜焼き",
      [
        {
          id: "i1",
          name: "豚こま",
          quantity: 300,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
      ],
      { tags: ["生姜"] },
    );
    const second = makeRecipe(
      "r2",
      "豚丼",
      [
        {
          id: "i2",
          name: "豚こま",
          quantity: 300,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
      ],
      { tags: ["生姜"] },
    );
    const prices: IngredientPriceRecord[] = [
      {
        id: "p1",
        ingredientName: "豚こま",
        normalizedIngredientName: "豚こま",
        storeName: "ロピア",
        purchasePriceYen: 1200,
        packageQuantity: 1,
        packageUnit: "kg",
        gramsEquivalent: 1000,
        pricePer100g: 120,
        purchasedAt: "2026-07-01T00:00:00.000Z",
        isSalePrice: false,
        memo: "",
      },
    ];
    const settings = {
      ...DEFAULT_FOOD_BUDGET_SETTINGS,
      storeProfiles: [LOPIA_STORE_PROFILE],
      scoreWeights: { ...DEFAULT_MEAL_PLAN_SCORE_WEIGHTS },
      updatedAt: "2026-07-01T00:00:00.000Z",
    };
    const shared = scoreBudgetSupport(second, {
      settings,
      store: LOPIA_STORE_PROFILE,
      priceRecords: prices,
      inventory: [],
      selectedRecipes: [first],
      weeklyFoodBudgetYen: 7000,
      runningPurchaseCostYen: 1200,
    });
    expect(shared.badges).toContain("まとめ買い向き");
    expect(shared.reasons.some((r) => r.detail.includes("味付け"))).toBe(true);
  });

  it("候補不足でもクラッシュしない", () => {
    const result = generateWeeklyMealPlan({
      weekStart: "2026-07-20",
      days: makePlan([]).days,
      recipes: [],
      inventory: [],
      diabetesSettings: {
        ...DEFAULT_DIABETES_MEAL_SUPPORT_SETTINGS,
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
      foodBudgetSettings: {
        ...DEFAULT_FOOD_BUDGET_SETTINGS,
        storeProfiles: [LOPIA_STORE_PROFILE],
        scoreWeights: { ...DEFAULT_MEAL_PLAN_SCORE_WEIGHTS },
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
      priceRecords: [],
    });
    expect(result.days).toHaveLength(7);
    expect(result.filledCount).toBe(0);
  });

  it("健康サポートOFFでも予算計算は動く", () => {
    const recipes = [
      makeRecipe("r1", "生姜焼き", [
        {
          id: "i1",
          name: "豚こま",
          quantity: 600,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
      ]),
    ];
    const prices: IngredientPriceRecord[] = [
      {
        id: "p1",
        ingredientName: "豚こま",
        normalizedIngredientName: "豚こま",
        storeName: "ロピア",
        purchasePriceYen: 1200,
        packageQuantity: 1,
        packageUnit: "kg",
        gramsEquivalent: 1000,
        pricePer100g: 120,
        purchasedAt: "2026-07-01T00:00:00.000Z",
        isSalePrice: false,
        memo: "",
      },
    ];
    const summary = calculateWeekBudgetSummary({
      mealPlan: makePlan(["r1"]),
      recipes,
      priceRecords: prices,
      settings: {
        ...DEFAULT_FOOD_BUDGET_SETTINGS,
        storeProfiles: [LOPIA_STORE_PROFILE],
        scoreWeights: { ...DEFAULT_MEAL_PLAN_SCORE_WEIGHTS },
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });
    expect(summary.estimatedPurchaseCostYen).toBe(1200);
    expect(summary.estimatedConsumedCostYen).toBe(720);
    expect(summary.estimatedCarryoverValueYen).toBe(480);
  });
});
