import { describe, expect, it } from "vitest";
import {
  buildTodayDashboard,
  buildTodayTip,
  selectUrgentIngredients,
} from "@/lib/today/dashboard";
import { DEFAULT_FOOD_BUDGET_SETTINGS } from "@/types/food-budget";
import { DEFAULT_DIABETES_MEAL_SUPPORT_SETTINGS } from "@/types/diabetes-meal-support";
import type { MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import type { ShoppingList } from "@/types/shopping-list";
import type { InventoryItem } from "@/types/inventory";
import type { LeftoverIngredient } from "@/types/leftover-ingredient";
import { makePriceRecord } from "@/lib/price-learning/test-fixtures";

function makeRecipe(id: string, name: string, minutes: number): Recipe {
  const now = "2026-07-01T00:00:00.000Z";
  return {
    id,
    name,
    category: "和食",
    course: "主菜",
    servings: 2,
    cookingTimeMinutes: minutes,
    ingredients: [
      {
        id: `${id}-i1`,
        name: "キャベツ",
        quantity: 200,
        unit: "g",
        note: "",
        ingredientType: "normal",
      },
    ],
    steps: [{ id: `${id}-s1`, order: 1, text: "作る" }],
    tags: [],
    memo: "",
    favoriteScore: null,
    createdAt: now,
    updatedAt: now,
  };
}

function makePlan(recipeId: string): MealPlan {
  return {
    id: "plan-1",
    weekStart: "2026-07-20",
    weeklyFoodBudgetYen: 7000,
    days: [
      {
        date: "2026-07-20",
        locked: false,
        items: [
          {
            id: "item-1",
            recipeId,
            course: "主菜",
            order: 1,
            source: "manual",
          },
        ],
        recommendation: {
          score: 10,
          stars: 4,
          reasons: ["娘さん向けの簡単メニューです"],
        },
      },
    ],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

describe("今日ホームダッシュボード", () => {
  it("データ無しでも空のダッシュボードを返す", () => {
    const dash = buildTodayDashboard({
      date: "2026-07-20",
      weekStart: "2026-07-20",
      mealPlan: null,
      recipes: [],
      shoppingList: null,
      inventory: [],
      leftovers: [],
      priceRecords: [],
      budgetSettings: DEFAULT_FOOD_BUDGET_SETTINGS,
      diabetesSettings: {
        ...DEFAULT_DIABETES_MEAL_SUPPORT_SETTINGS,
        diabetesMealSupportEnabled: false,
      },
      feedbacks: [],
      cookingHistory: [],
      receipts: [],
    });
    expect(dash.meals).toHaveLength(0);
    expect(dash.shopping.totalUnchecked).toBe(0);
    expect(dash.ingredients).toHaveLength(0);
    expect(dash.budget.weeklyFoodBudgetYen).toBe(
      DEFAULT_FOOD_BUDGET_SETTINGS.weeklyFoodBudgetYen,
    );
    expect(dash.health.enabled).toBe(false);
    expect(dash.tip).toBeNull();
  });

  it("今日の献立・買い物・在庫を表示用に集計する", () => {
    const recipe = makeRecipe("r1", "生姜焼き", 15);
    const plan = makePlan("r1");
    const shopping: ShoppingList = {
      id: "s1",
      weekStart: "2026-07-20",
      createdAt: "",
      updatedAt: "",
      items: [
        {
          id: "a",
          ingredientName: "玉ねぎ",
          checked: false,
          manuallyAdded: false,
          ingredientType: "normal",
          listKind: "buy",
          quantities: [{ quantity: 1, unit: "個", note: "" }],
          sources: [],
        },
        {
          id: "b",
          ingredientName: "にんじん",
          checked: false,
          manuallyAdded: false,
          ingredientType: "normal",
          listKind: "buy",
          quantities: [{ quantity: 2, unit: "本", note: "" }],
          sources: [],
        },
        {
          id: "c",
          ingredientName: "じゃがいも",
          checked: false,
          manuallyAdded: false,
          ingredientType: "normal",
          listKind: "buy",
          quantities: [{ quantity: 3, unit: "個", note: "" }],
          sources: [],
        },
        {
          id: "d",
          ingredientName: "ピーマン",
          checked: false,
          manuallyAdded: false,
          ingredientType: "normal",
          listKind: "buy",
          quantities: [{ quantity: 1, unit: "個", note: "" }],
          sources: [],
        },
        {
          id: "e",
          ingredientName: "買済",
          checked: true,
          manuallyAdded: false,
          ingredientType: "normal",
          listKind: "buy",
          quantities: [],
          sources: [],
        },
      ],
    };
    const inventory: InventoryItem[] = [
      {
        id: "inv1",
        name: "豆腐",
        amount: null,
        unit: "",
        priority: true,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const leftovers: LeftoverIngredient[] = [
      {
        id: "l1",
        householdId: "local",
        name: "キャベツ",
        foodMasterId: null,
        quantity: 0.5,
        unit: "玉",
        priority: "must_use",
        notes: null,
        source: "manual",
        status: "active",
        plannedForDates: [],
        migratedFromInventoryId: null,
        includeInProposal: true,
        createdAt: "",
        updatedAt: "",
      },
    ];

    const dash = buildTodayDashboard({
      date: "2026-07-20",
      weekStart: "2026-07-20",
      mealPlan: plan,
      recipes: [recipe],
      shoppingList: shopping,
      inventory,
      leftovers,
      priceRecords: [],
      budgetSettings: {
        ...DEFAULT_FOOD_BUDGET_SETTINGS,
        weeklyFoodBudgetYen: 7000,
      },
      diabetesSettings: {
        ...DEFAULT_DIABETES_MEAL_SUPPORT_SETTINGS,
        diabetesMealSupportEnabled: false,
      },
      feedbacks: [],
      cookingHistory: [],
      receipts: [],
    });

    expect(dash.meals).toHaveLength(1);
    expect(dash.meals[0]?.title).toBe("生姜焼き");
    expect(dash.meals[0]?.cookingTimeMinutes).toBe(15);
    expect(dash.meals[0]?.cookHref).toContain("/cook");
    expect(dash.shopping.items).toHaveLength(3);
    expect(dash.shopping.totalUnchecked).toBe(4);
    expect(dash.ingredients[0]?.name).toBe("キャベツ");
    expect(dash.tip).toBe("キャベツを使い切る日です");
    expect(dash.budget.weeklyFoodBudgetYen).toBe(7000);
    expect(dash.weekSummary.some((l) => l.id === "cook-count")).toBe(true);
  });

  it("健康◎○△と予算進捗を集計する", () => {
    const recipe = makeRecipe("r1", "焼き魚", 20);
    recipe.ingredients = [
      {
        id: "i1",
        name: "さば",
        quantity: 1,
        unit: "切れ",
        note: "",
        ingredientType: "normal",
      },
    ];
    const plan = makePlan("r1");
    const dash = buildTodayDashboard({
      date: "2026-07-20",
      weekStart: "2026-07-20",
      mealPlan: plan,
      recipes: [recipe],
      shoppingList: null,
      inventory: [],
      leftovers: [],
      priceRecords: [
        makePriceRecord({
          id: "p1",
          ingredientName: "さば",
          normalizedIngredientName: "さば",
          purchasePriceYen: 300,
          packageQuantity: 1,
          packageUnit: "切れ",
          gramsEquivalent: null,
          pricePer100g: null,
          purchasedAt: "2026-07-18T00:00:00.000Z",
        }),
      ],
      budgetSettings: {
        ...DEFAULT_FOOD_BUDGET_SETTINGS,
        weeklyFoodBudgetYen: 7000,
      },
      diabetesSettings: {
        ...DEFAULT_DIABETES_MEAL_SUPPORT_SETTINGS,
        diabetesMealSupportEnabled: true,
      },
      feedbacks: [
        {
          id: "f1",
          historyId: "h1",
          recipeId: "r1",
          householdId: "local",
          cookedAt: "2026-07-19T12:00:00.000Z",
          createdBy: null,
          overallRating: 5,
          tasteSalt: null,
          tasteSweet: null,
          tasteSpicy: null,
          texture: null,
          timeFeeling: null,
          wantAgain: true,
          cookingTimeActualMinutes: null,
          servingsActual: null,
          improvementTags: [],
          memberRatings: [
            { memberId: "m1", memberName: "娘", rating: 5 },
          ],
          adjustments: [],
          seasoningAdjustments: [],
          photoDataUrl: null,
          memo: null,
          createdAt: "2026-07-19T12:00:00.000Z",
          updatedAt: "2026-07-19T12:00:00.000Z",
        },
      ],
      cookingHistory: [],
      receipts: [
        {
          id: "rc1",
          storeId: null,
          storeName: "ロピア",
          purchasedAt: "2026-07-18",
          totalAmountYen: 2000,
          receiptFingerprint: "fp",
          keepImage: false,
          confidence: null,
          warnings: [],
          rawText: null,
          createdAt: "2026-07-18T10:00:00.000Z",
          updatedAt: "2026-07-18T10:00:00.000Z",
        },
      ],
    });

    expect(dash.health.enabled).toBe(true);
    expect(["◎", "○", "△", "—"]).toContain(dash.health.overall);
    expect(dash.recent.some((r) => r.kind === "receipt")).toBe(true);
    expect(dash.recent.some((r) => r.kind === "feedback")).toBe(true);
    expect(dash.recent.some((r) => r.kind === "family")).toBe(true);
  });

  it("買い時・短時間のtipを返す", () => {
    const tipTime = buildTodayTip({
      leftovers: [],
      priceRecords: [],
      meals: [
        {
          mealItemId: "1",
          recipeId: "r",
          title: "サラダ",
          courseLabel: "副菜",
          cookingTimeMinutes: 10,
          photoDataUrl: null,
          cookHref: null,
          recipeHref: null,
        },
      ],
    });
    expect(tipTime).toBe("今日は10分で作れます");

    const now = Date.now();
    const records = [1, 2, 3, 4].map((n) =>
      makePriceRecord({
        id: `p${n}`,
        ingredientName: "豚こま",
        normalizedIngredientName: "豚こま",
        purchasePriceYen: 1000,
        pricePer100g: n === 1 ? 100 : 130,
        purchasedAt: new Date(now - n * 5 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    );
    const tipPrice = buildTodayTip({
      leftovers: [],
      priceRecords: records,
      meals: [],
    });
    expect(tipPrice).toContain("安く買えています");
  });

  it("今日使う食材は最大3件・賞味期限相当を優先", () => {
    const leftovers: LeftoverIngredient[] = (
      ["must_use", "soon", "normal", "must_use"] as const
    ).map((priority, i) => ({
      id: `l${i}`,
      householdId: "local",
      name: `食材${i}`,
      foodMasterId: null,
      quantity: 1,
      unit: "個",
      priority,
      notes: null,
      source: "manual",
      status: "active",
      plannedForDates: [],
      migratedFromInventoryId: null,
      includeInProposal: true,
      createdAt: "",
      updatedAt: "",
    }));
    const selected = selectUrgentIngredients([], leftovers, 3);
    expect(selected).toHaveLength(3);
    expect(selected.every((s) => s.reason.includes("使う") || s.reason === "優先")).toBe(
      true,
    );
    expect(selected[0]?.reason).toBe("優先して使う");
  });
});
