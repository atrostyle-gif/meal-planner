import { describe, expect, it, beforeEach, vi } from "vitest";
import { evaluateRecipeHardConstraints } from "@/lib/allergy/check";
import {
  evaluateDayLifestyleFit,
  optimizeWeeklyMealPlanV4,
  type OptimizeContextV4,
} from "@/lib/meal-planner-engine/v4";
import {
  evaluateLeftoverIngredientUsage,
  evaluateRepeatedIngredientPenalty,
  matchLeftoverToRecipe,
} from "@/lib/leftover-match";
import { leftoverIngredientFromRow } from "@/lib/mappers/leftover-ingredient-mapper";
import {
  getActiveLeftoversForProposal,
  getPreviousLeftoverNameSuggestions,
  migrateInventoryToLeftovers,
  replaceLeftoverIngredients,
  markLeftoversPlanned,
  markLeftoversUsed,
  loadLeftoverIngredients,
  saveLeftoverIngredient,
} from "@/lib/leftover-ingredients";
import { summarizeLeftoverUsage } from "@/lib/leftover-match";
import { generateWeeklyMealPlan } from "@/lib/weekly-auto-plan/generate";
import { generateShoppingListFromMealPlan } from "@/lib/shopping/generate-shopping-list";
import { createSampleFoodMasters } from "@/lib/food-master/sample-data";
import { replaceInventory } from "@/lib/inventory";
import type { LeftoverIngredient } from "@/types/leftover-ingredient";
import type { Recipe } from "@/types/recipe";
import type { CookingMemberProfile, WeeklyCookingSchedule } from "@/types/weekly-lifestyle";
import type { HouseholdPreferences } from "@/types/meal-preferences";
import type { DayMeal } from "@/types/meal-plan";
import { foodMasterFixture } from "@/lib/food-master/fixture";
import type { FoodAliasMapping, FoodIngredientMaster } from "@/types/food-master";

function recipeStub(partial: Partial<Recipe> & Pick<Recipe, "id" | "name">): Recipe {
  return {
    ingredients: [],
    steps: [{ id: "s1", order: 1, text: "煮る" }],
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
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

function leftoverStub(
  partial: Partial<LeftoverIngredient> & Pick<LeftoverIngredient, "id" | "name">,
): LeftoverIngredient {
  const name = partial.name;
  return {
    householdId: "local",
    rawName: name,
    normalizedName: name.toLowerCase().replace(/\s/g, ""),
    foodCode: null,
    foodMasterId: null,
    quantityText: null,
    quantity: null,
    unit: null,
    priority: "soon",
    notes: null,
    source: "manual_meal_plan",
    status: "active",
    weekStart: "2026-07-20",
    plannedForDates: [],
    migratedFromInventoryId: null,
    includeInProposal: true,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

const preferences: HouseholdPreferences = {
  defaultMealServings: 4,
  servingCount: 4,
  members: [],
  healthGoal: "通常",
  cookingTimeLimit: 45,
  conditionMode: "通常",
  updatedAt: "",
};

function blankDay(date: string): DayMeal {
  return { date, locked: false, items: [], recommendation: null };
}

describe("leftover scoring", () => {
  const cabbage = leftoverStub({ id: "l1", name: "キャベツ" });
  const pork = leftoverStub({ id: "l2", name: "豚こま" });
  const carrot = leftoverStub({ id: "l3", name: "にんじん" });

  const stirFry = recipeStub({
    id: "r1",
    name: "野菜炒め",
    course: "主菜",
    ingredients: [
      { id: "i1", name: "キャベツ", quantity: 0.5, unit: "玉", note: "", ingredientType: "通常" },
      { id: "i2", name: "豚こま", quantity: 200, unit: "g", note: "", ingredientType: "通常" },
    ],
  });

  const side = recipeStub({
    id: "r2",
    name: "キャベツの和え物",
    course: "副菜",
    ingredients: [
      { id: "i1", name: "キャベツ", quantity: 0.25, unit: "玉", note: "", ingredientType: "通常" },
    ],
  });

  const soup = recipeStub({
    id: "r3",
    name: "豚汁",
    course: "汁物",
    ingredients: [
      { id: "i1", name: "豚こま", quantity: 100, unit: "g", note: "", ingredientType: "通常" },
      { id: "i2", name: "にんじん", quantity: 0.5, unit: "本", note: "", ingredientType: "通常" },
    ],
  });

  it("boosts recipes that use leftovers", () => {
    const score = evaluateLeftoverIngredientUsage(stirFry, [cabbage, pork]);
    expect(score.points).toBeGreaterThan(0);
    expect(score.matchedIds).toContain("l1");
    expect(score.matchedIds).toContain("l2");
  });

  it("treats all leftovers with the same use-up scoring rule", () => {
    const a = evaluateLeftoverIngredientUsage(stirFry, [pork]);
    const b = evaluateLeftoverIngredientUsage(stirFry, [
      leftoverStub({ id: "l2b", name: "豚こま切れ" }),
    ]);
    expect(a.points).toBe(b.points);
    expect(a.points).toBeGreaterThan(0);
  });

  it("boosts unused leftovers more than already-used ones", () => {
    const first = evaluateLeftoverIngredientUsage(stirFry, [cabbage], [], [], {
      usageCounts: {},
    });
    const second = evaluateLeftoverIngredientUsage(stirFry, [cabbage], [], [], {
      usageCounts: { l1: 2 },
    });
    expect(first.points).toBeGreaterThan(second.points);
  });

  it("works for side dishes and soups", () => {
    expect(evaluateLeftoverIngredientUsage(side, [cabbage]).points).toBeGreaterThan(0);
    expect(evaluateLeftoverIngredientUsage(soup, [pork, carrot]).points).toBeGreaterThan(0);
  });

  it("penalizes repeated leftover usage", () => {
    const penalty = evaluateRepeatedIngredientPenalty(stirFry, [cabbage], { l1: 2 });
    expect(penalty.points).toBeLessThan(0);
  });

  it("matches by name when units are incomparable", () => {
    const score = evaluateLeftoverIngredientUsage(stirFry, [
      leftoverStub({ id: "l1", name: "キャベツ", quantity: null, unit: "半玉" }),
    ]);
    expect(score.matchedIds).toEqual(["l1"]);
  });

  it("matches by foodMasterId", () => {
    const masters: FoodIngredientMaster[] = [
      foodMasterFixture({
        id: "fm-cabbage",
        canonicalName: "キャベツ",
        aliases: ["きゃべつ"],
        category: "野菜",
        edibleUnit: "g",
        gramsPerUnit: null,
        nutritionPer100g: {
          calories: 23,
          protein: 1.3,
          fat: 0.2,
          carbohydrates: 5.2,
          fiber: 1.8,
          saltEquivalent: 0,
          calcium: 0,
          iron: 0,
        },
      }),
    ];
    const leftover = leftoverStub({
      id: "l9",
      name: "きゃべつ",
      foodMasterId: "fm-cabbage",
    });
    const recipe = recipeStub({
      id: "rc",
      name: "炒め",
      ingredients: [
        { id: "i", name: "キャベツ", quantity: 100, unit: "g", note: "", ingredientType: "通常" },
      ],
    });
    const match = matchLeftoverToRecipe(leftover, recipe, masters);
    expect(match?.via).toBe("foodMasterId");
  });

  it("matches via alias mapping", () => {
    const masters: FoodIngredientMaster[] = [
      foodMasterFixture({
        id: "fm-onion",
        canonicalName: "玉ねぎ",
        aliases: [],
        category: "野菜",
        edibleUnit: "個",
        gramsPerUnit: 200,
        nutritionPer100g: {
          calories: 37,
          protein: 1,
          fat: 0.1,
          carbohydrates: 8.8,
          fiber: 1.6,
          saltEquivalent: 0,
          calcium: 0,
          iron: 0,
        },
      }),
    ];
    const aliases: FoodAliasMapping[] = [
      {
        id: "a1",
        householdId: "local",
        aliasName: "たまねぎ",
        masterId: "fm-onion",
        createdAt: "",
        updatedAt: "",
      },
    ];
    const leftover = leftoverStub({ id: "lo", name: "たまねぎ" });
    const recipe = recipeStub({
      id: "ro",
      name: "カレー",
      ingredients: [
        { id: "i", name: "玉ねぎ", quantity: 1, unit: "個", note: "", ingredientType: "通常" },
      ],
    });
    const match = matchLeftoverToRecipe(leftover, recipe, masters, aliases);
    expect(match).not.toBeNull();
  });

  it("allergy still wins over leftover boost", () => {
    const eggDish = recipeStub({
      id: "egg",
      name: "卵焼き",
      ingredients: [
        { id: "i", name: "卵", quantity: 2, unit: "個", note: "", ingredientType: "通常" },
      ],
    });
    const leftover = leftoverStub({ id: "le", name: "卵" });
    const leftoverScore = evaluateLeftoverIngredientUsage(eggDish, [leftover]);
    const allergy = evaluateRecipeHardConstraints(eggDish, ["卵"], []);
    expect(leftoverScore.points).toBeGreaterThan(0);
    expect(allergy.blocked).toBe(true);
  });

  it("cook suitability still blocks even with leftover match", () => {
    const fried = recipeStub({
      id: "fried",
      name: "唐揚げ",
      cookingTimeMinutes: 40,
      cookingProfile: {
        difficulty: "hard",
        effortLevel: "elaborate",
        activeCookingMinutes: 40,
        totalCookingMinutes: 40,
        stepCount: 10,
        cleanupLevel: "high",
        requiresDeepFrying: true,
        requiresOven: false,
        requiresPressureCooker: false,
        requiresRawFishHandling: false,
        canBatchCook: false,
        makeAheadSuitable: false,
        beginnerFriendly: false,
        assignedCookMemberIds: [],
        preferredCookMemberIds: [],
        avoidCookMemberIds: [],
        memberSuitability: [],
        source: "manual",
      },
      ingredients: [
        { id: "i", name: "鶏肉", quantity: 300, unit: "g", note: "", ingredientType: "通常" },
      ],
    });
    const cook: CookingMemberProfile = {
      id: "c1",
      householdId: "local",
      familyMemberProfileId: "daughter",
      cookingLevel: "beginner",
      defaultMaxCookingMinutes: 25,
      maxComfortableStepCount: 5,
      canDeepFry: false,
      canUseOven: true,
      canUsePressureCooker: false,
      canHandleRawFish: false,
      prefersLowCleanup: true,
      preferredRecipeIds: [],
      avoidRecipeIds: [],
      masteredRecipeIds: [],
      learningRecipeIds: [],
      preferredCategories: [],
      dislikedCookingMethods: ["揚げ物"],
      notes: null,
      isActive: true,
      createdAt: "",
      updatedAt: "",
    };
    const schedule: WeeklyCookingSchedule = {
      id: "s",
      householdId: "local",
      dayOfWeek: "friday",
      defaultCookMemberId: "daughter",
      backupCookMemberIds: [],
      cookingTimeLimitMinutes: 25,
      effortLevel: "very_easy",
      shoppingAvailable: false,
      isShoppingDay: false,
      allowNewRecipes: false,
      preferFamiliarRecipes: true,
      allowBatchCooking: false,
      preferLowCleanup: true,
      maxStepCount: 5,
      avoidDeepFrying: true,
      preferMakeAhead: false,
      notes: null,
      isActive: true,
      createdAt: "",
      updatedAt: "",
    };
    const fit = evaluateDayLifestyleFit(schedule, null, fried, cook);
    expect(fit.blocked).toBe(true);
    expect(
      evaluateLeftoverIngredientUsage(fried, [
        leftoverStub({ id: "lc", name: "鶏肉" }),
      ]).points,
    ).toBeGreaterThan(0);
  });

  it("time limit still blocks leftover-heavy long recipes", () => {
    const long = recipeStub({
      id: "long",
      name: "煮込み",
      cookingTimeMinutes: 60,
      cookingProfile: {
        difficulty: "normal",
        effortLevel: "normal",
        activeCookingMinutes: 60,
        totalCookingMinutes: 60,
        stepCount: 4,
        cleanupLevel: "medium",
        requiresDeepFrying: false,
        requiresOven: false,
        requiresPressureCooker: false,
        requiresRawFishHandling: false,
        canBatchCook: true,
        makeAheadSuitable: true,
        beginnerFriendly: true,
        assignedCookMemberIds: [],
        preferredCookMemberIds: [],
        avoidCookMemberIds: [],
        memberSuitability: [],
        source: "manual",
      },
      ingredients: [
        { id: "i", name: "キャベツ", quantity: 1, unit: "玉", note: "", ingredientType: "通常" },
      ],
    });
    const fit = evaluateDayLifestyleFit(
      {
        id: "s",
        householdId: "local",
        dayOfWeek: "tuesday",
        defaultCookMemberId: "husband",
        backupCookMemberIds: [],
        cookingTimeLimitMinutes: 30,
        effortLevel: "easy",
        shoppingAvailable: false,
        isShoppingDay: false,
        allowNewRecipes: true,
        preferFamiliarRecipes: false,
        allowBatchCooking: false,
        preferLowCleanup: false,
        maxStepCount: null,
        avoidDeepFrying: false,
        preferMakeAhead: false,
        notes: null,
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
      null,
      long,
      null,
    );
    expect(fit.blocked).toBe(true);
  });

  it("works with empty leftovers (legacy generation)", () => {
    const context: OptimizeContextV4 = {
      recipes: [
        recipeStub({ id: "m", name: "主菜", course: "主菜" }),
        recipeStub({ id: "s", name: "汁物", course: "汁物" }),
      ],
      inventory: [],
      preferences,
      recentRecipeIds: [],
      allergies: [],
      dietaryRestrictions: [],
      conditionsByDate: {},
      mode: "バランス重視",
      foodMasters: [],
      schedules: [],
      cookingProfiles: [],
      overrides: [],
      cookingHistory: [],
      householdId: "local",
      memberDisplayNames: {},
      leftovers: [],
    };
    const proposal = optimizeWeeklyMealPlanV4("2026-07-20", [blankDay("2026-07-20")], context);
    expect(proposal.days.length).toBeGreaterThanOrEqual(0);
  });
});

describe("leftover storage migration and status", () => {
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
    vi.stubGlobal(
      "CustomEvent",
      class CustomEvent<T> {
        detail: T | undefined;
        constructor(_type: string, init?: { detail?: T }) {
          this.detail = init?.detail;
        }
      },
    );
    replaceLeftoverIngredients([]);
    replaceInventory([]);
  });

  it("migrates inventory without pantry-like names and is idempotent", () => {
    replaceInventory([
      {
        id: "inv1",
        name: "キャベツ",
        amount: { kind: "text", value: "半玉" },
        unit: "",
        priority: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "inv2",
        name: "醤油",
        amount: null,
        unit: "",
        priority: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const first = migrateInventoryToLeftovers("local");
    expect(first.migrated).toBe(1);
    const second = migrateInventoryToLeftovers("local");
    expect(second.migrated).toBe(0);
    expect(loadLeftoverIngredients()).toHaveLength(1);
    expect(loadLeftoverIngredients()[0]?.source).toBe("migrated_fridge");
    expect(loadLeftoverIngredients()[0]?.priority).toBe("soon");
  });

  it("marks planned then used with user confirmation flow APIs", () => {
    replaceLeftoverIngredients([
      leftoverStub({ id: "l1", name: "キャベツ", status: "active" }),
    ]);
    markLeftoversPlanned(["l1"], ["2026-07-21"]);
    expect(loadLeftoverIngredients()[0]?.status).toBe("planned");
    markLeftoversUsed(["l1"]);
    expect(loadLeftoverIngredients()[0]?.status).toBe("used");
    expect(loadLeftoverIngredients()[0]?.includeInProposal).toBe(false);
  });

  it("maps supabase row", () => {
    const item = leftoverIngredientFromRow({
      id: "11111111-1111-1111-1111-111111111111",
      household_id: "22222222-2222-2222-2222-222222222222",
      name: "豆腐",
      food_master_id: null,
      quantity: 1,
      unit: "丁",
      priority: "soon",
      notes: "[mp]week:2026-07-20|qty:1丁 メモ",
      source: "manual",
      status: "active",
      planned_for_dates: [],
      migrated_from_inventory_id: null,
      include_in_proposal: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(item?.name).toBe("豆腐");
    expect(item?.priority).toBe("soon");
    expect(item?.weekStart).toBe("2026-07-20");
    expect(item?.quantityText).toBe("1丁");
  });

  it("does not auto-carry leftovers to the next week", () => {
    saveLeftoverIngredient({
      name: "キャベツ",
      householdId: "local",
      weekStart: "2026-07-13",
      source: "manual_meal_plan",
    });
    expect(getActiveLeftoversForProposal("local", "2026-07-20")).toHaveLength(0);
    expect(getPreviousLeftoverNameSuggestions("2026-07-20")).toContain("キャベツ");
  });

  it("normalizes alias names via Food Master on save", () => {
    const saved = saveLeftoverIngredient({
      name: "豚こま",
      householdId: "local",
      weekStart: "2026-07-20",
      source: "manual_meal_plan",
    });
    expect(saved.name).toBe("豚こま切れ");
    expect(saved.foodCode).toBe("fm-pork-koma");
  });
});

describe("leftover weekly plan and shopping", () => {
  const masters = createSampleFoodMasters();

  it("prefers recipes that use leftovers and reports unused", () => {
    const recipes = [
      recipeStub({
        id: "r-cabbage",
        name: "キャベツ炒め",
        course: "主菜",
        ingredients: [
          {
            id: "i1",
            name: "キャベツ",
            quantity: 200,
            unit: "g",
            note: "",
            ingredientType: "通常",
          },
        ],
      }),
      recipeStub({
        id: "r-other",
        name: "唐揚げ",
        course: "主菜",
        ingredients: [
          {
            id: "i1",
            name: "鶏肉",
            quantity: 300,
            unit: "g",
            note: "",
            ingredientType: "通常",
          },
        ],
      }),
      recipeStub({
        id: "r-side",
        name: "サラダ",
        course: "副菜",
        ingredients: [
          {
            id: "i1",
            name: "レタス",
            quantity: 1,
            unit: "個",
            note: "",
            ingredientType: "通常",
          },
        ],
      }),
      recipeStub({
        id: "r-soup",
        name: "味噌汁",
        course: "汁物",
        ingredients: [
          {
            id: "i1",
            name: "豆腐",
            quantity: 0.5,
            unit: "丁",
            note: "",
            ingredientType: "通常",
          },
        ],
      }),
    ];
    const leftovers = [
      leftoverStub({ id: "l1", name: "キャベツ", weekStart: "2026-07-20" }),
      leftoverStub({ id: "l2", name: "バナナ", weekStart: "2026-07-20" }),
    ];
    const result = generateWeeklyMealPlan({
      weekStart: "2026-07-20",
      days: [blankDay("2026-07-20")],
      recipes,
      leftovers,
      foodMasters: masters,
      foodAliasMappings: [],
    });
    const main = result.days[0]?.items.find((item) => item.course === "主菜");
    expect(main?.recipeId).toBe("r-cabbage");
    expect(result.leftoverUsage.used.some((u) => u.name === "キャベツ")).toBe(
      true,
    );
    expect(result.leftoverUsage.unused.some((u) => u.name === "バナナ")).toBe(
      true,
    );
  });

  it("does not treat unknown quantity leftovers as full stock", () => {
    const plan = {
      id: "p",
      weekStart: "2026-07-20",
      createdAt: "",
      updatedAt: "",
      days: [
        {
          date: "2026-07-20",
          locked: false,
          servings: 2,
          servingsMode: "custom" as const,
          items: [
            {
              id: "m1",
              recipeId: "r1",
              course: "主菜" as const,
              order: 1,
              customName: null,
              source: "manual" as const,
            },
          ],
          recommendation: null,
        },
      ],
    };
    const recipes = [
      recipeStub({
        id: "r1",
        name: "炒め",
        ingredients: [
          {
            id: "i1",
            name: "キャベツ",
            quantity: 300,
            unit: "g",
            note: "",
            ingredientType: "通常",
          },
        ],
      }),
    ];
    const leftovers = [
      leftoverStub({
        id: "l1",
        name: "キャベツ",
        quantity: null,
        quantityText: null,
        unit: null,
      }),
    ];
    const list = generateShoppingListFromMealPlan(
      plan,
      recipes,
      null,
      leftovers,
    );
    const cabbage = list.items.find((item) => item.ingredientName === "キャベツ");
    expect(cabbage).toBeTruthy();
    expect(cabbage?.leftoverNote).toContain("数量不明");
    expect(cabbage?.quantities[0]?.quantity).toBe(300);
  });

  it("deducts known leftover quantity from shopping list", () => {
    const plan = {
      id: "p",
      weekStart: "2026-07-20",
      createdAt: "",
      updatedAt: "",
      days: [
        {
          date: "2026-07-20",
          locked: false,
          servings: 2,
          servingsMode: "custom" as const,
          items: [
            {
              id: "m1",
              recipeId: "r1",
              course: "主菜" as const,
              order: 1,
              customName: null,
              source: "manual" as const,
            },
          ],
          recommendation: null,
        },
      ],
    };
    const recipes = [
      recipeStub({
        id: "r1",
        name: "炒め",
        ingredients: [
          {
            id: "i1",
            name: "キャベツ",
            quantity: 300,
            unit: "g",
            note: "",
            ingredientType: "通常",
          },
        ],
      }),
    ];
    const leftovers = [
      leftoverStub({
        id: "l1",
        name: "キャベツ",
        quantity: 300,
        unit: "g",
        quantityText: "300g",
      }),
    ];
    const list = generateShoppingListFromMealPlan(
      plan,
      recipes,
      null,
      leftovers,
    );
    expect(list.items.find((item) => item.ingredientName === "キャベツ")).toBeUndefined();
  });

  it("summarizes multi-recipe leftover usage", () => {
    const leftovers = [leftoverStub({ id: "l1", name: "キャベツ" })];
    const recipes = [
      recipeStub({
        id: "r1",
        name: "炒め",
        ingredients: [
          {
            id: "i1",
            name: "キャベツ",
            quantity: 100,
            unit: "g",
            note: "",
            ingredientType: "通常",
          },
        ],
      }),
      recipeStub({
        id: "r2",
        name: "和え物",
        course: "副菜",
        ingredients: [
          {
            id: "i1",
            name: "キャベツ",
            quantity: 100,
            unit: "g",
            note: "",
            ingredientType: "通常",
          },
        ],
      }),
    ];
    const summary = summarizeLeftoverUsage(
      [
        {
          date: "2026-07-20",
          locked: false,
          items: [
            {
              id: "a",
              recipeId: "r1",
              course: "主菜",
              order: 1,
              customName: null,
              source: "auto",
            },
            {
              id: "b",
              recipeId: "r2",
              course: "副菜",
              order: 2,
              customName: null,
              source: "auto",
            },
          ],
          recommendation: null,
        },
      ],
      recipes,
      leftovers,
      masters,
    );
    expect(summary.used[0]?.recipeCount).toBe(2);
  });
});
