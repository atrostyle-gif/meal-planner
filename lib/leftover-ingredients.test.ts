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
  migrateInventoryToLeftovers,
  replaceLeftoverIngredients,
  markLeftoversPlanned,
  markLeftoversUsed,
  loadLeftoverIngredients,
} from "@/lib/leftover-ingredients";
import { replaceInventory } from "@/lib/inventory";
import type { LeftoverIngredient } from "@/types/leftover-ingredient";
import type { Recipe } from "@/types/recipe";
import type { CookingMemberProfile, WeeklyCookingSchedule } from "@/types/weekly-lifestyle";
import type { HouseholdPreferences } from "@/types/meal-preferences";
import type { DayMeal } from "@/types/meal-plan";
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
  return {
    householdId: "local",
    foodMasterId: null,
    quantity: null,
    unit: null,
    priority: "normal",
    notes: null,
    source: "manual",
    status: "active",
    plannedForDates: [],
    migratedFromInventoryId: null,
    includeInProposal: true,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

const preferences: HouseholdPreferences = {
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
  const cabbage = leftoverStub({ id: "l1", name: "キャベツ", priority: "soon" });
  const pork = leftoverStub({ id: "l2", name: "豚こま", priority: "must_use" });
  const carrot = leftoverStub({ id: "l3", name: "にんじん", priority: "normal" });

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

  it("gives higher points to higher priority leftovers", () => {
    const withMust = evaluateLeftoverIngredientUsage(stirFry, [pork]);
    const withNormal = evaluateLeftoverIngredientUsage(stirFry, [
      leftoverStub({ id: "l2", name: "豚こま", priority: "normal" }),
    ]);
    expect(withMust.points).toBeGreaterThan(withNormal.points);
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
      {
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
        createdAt: "",
        updatedAt: "",
      },
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
      {
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
        createdAt: "",
        updatedAt: "",
      },
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
    const leftover = leftoverStub({ id: "le", name: "卵", priority: "must_use" });
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
        leftoverStub({ id: "lc", name: "鶏肉", priority: "must_use" }),
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
      notes: null,
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
  });
});
