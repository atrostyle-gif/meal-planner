import { describe, expect, it } from "vitest";
import { evaluateRecipeHardConstraints } from "@/lib/allergy/check";
import {
  evaluateDayLifestyleFit,
  evaluateRecipeForCook,
  evaluateWeeklyIngredientReuse,
  optimizeWeeklyMealPlanV4,
  type OptimizeContextV4,
} from "@/lib/meal-planner-engine/v4";
import { optimizeWeeklyMealPlan } from "@/lib/meal-planner-engine/v3";
import { emptyRecipeCookingProfile } from "@/lib/cooking-suitability";
import { weeklyCookingScheduleFromRow } from "@/lib/mappers/weekly-cooking-schedule-mapper";
import type { DayMeal } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import type {
  CookingHistory,
  CookingMemberProfile,
  DailyCookingOverride,
  WeeklyCookingSchedule,
} from "@/types/weekly-lifestyle";
import type { HouseholdPreferences } from "@/types/meal-preferences";

function recipeStub(partial: Partial<Recipe> & Pick<Recipe, "id" | "name">): Recipe {
  return {
    ingredients: [],
    steps: Array.from({ length: 3 }, (_, i) => ({
      id: `s${i}`,
      order: i + 1,
      text: `手順${i + 1}`,
    })),
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
    cookingProfile: null,
    ...partial,
  };
}

function cookStub(
  partial: Partial<CookingMemberProfile> & Pick<CookingMemberProfile, "familyMemberProfileId">,
): CookingMemberProfile {
  return {
    id: `cook-${partial.familyMemberProfileId}`,
    householdId: "local",
    cookingLevel: "basic",
    defaultMaxCookingMinutes: 35,
    maxComfortableStepCount: 8,
    canDeepFry: true,
    canUseOven: true,
    canUsePressureCooker: false,
    canHandleRawFish: false,
    prefersLowCleanup: false,
    preferredRecipeIds: [],
    avoidRecipeIds: [],
    masteredRecipeIds: [],
    learningRecipeIds: [],
    preferredCategories: [],
    dislikedCookingMethods: [],
    notes: null,
    isActive: true,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

function scheduleStub(
  partial: Partial<WeeklyCookingSchedule> & Pick<WeeklyCookingSchedule, "dayOfWeek">,
): WeeklyCookingSchedule {
  return {
    id: `sch-${partial.dayOfWeek}`,
    householdId: "local",
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
    ...partial,
  };
}

const basePreferences: HouseholdPreferences = {
  defaultMealServings: 4,
  servingCount: 4,
  members: [],
  healthGoal: "通常",
  cookingTimeLimit: 45,
  conditionMode: "通常",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function baseContext(partial: Partial<OptimizeContextV4> = {}): OptimizeContextV4 {
  return {
    recipes: [],
    inventory: [],
    preferences: basePreferences,
    recentRecipeIds: [],
    allergies: [],
    dietaryRestrictions: [],
    conditionsByDate: {},
    mode: "生活優先",
    foodMasters: [],
    schedules: [],
    cookingProfiles: [],
    overrides: [],
    cookingHistory: [],
    householdId: "local",
    memberDisplayNames: { husband: "夫", wife: "妻", daughter: "娘" },
    ...partial,
  };
}

function blankDay(date: string): DayMeal {
  return {
    date,
    locked: false,
    items: [],
    recommendation: null,
  };
}

describe("weekly schedule / lifestyle fit", () => {
  it("gets schedule for day via mapper shape", () => {
    const row = {
      id: "11111111-1111-1111-1111-111111111111",
      household_id: "22222222-2222-2222-2222-222222222222",
      day_of_week: "tuesday",
      default_cook_member_id: null,
      backup_cook_member_ids: [],
      cooking_time_limit_minutes: 30,
      effort_level: "easy",
      shopping_available: false,
      is_shopping_day: false,
      allow_new_recipes: false,
      prefer_familiar_recipes: true,
      allow_batch_cooking: false,
      prefer_low_cleanup: false,
      max_step_count: 8,
      avoid_deep_frying: false,
      prefer_make_ahead: false,
      notes: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const schedule = weeklyCookingScheduleFromRow(row);
    expect(schedule).not.toBeNull();
    expect(schedule?.dayOfWeek).toBe("tuesday");
    expect(schedule?.cookingTimeLimitMinutes).toBe(30);
  });

  it("falls back to v3 when schedule is missing", () => {
    const recipes = [
      recipeStub({ id: "a", name: "炒め物", course: "主菜", cookingTimeMinutes: 15 }),
      recipeStub({ id: "b", name: "味噌汁", course: "汁物", cookingTimeMinutes: 10 }),
    ];
    const days = [blankDay("2026-07-20")]; // Monday
    const v3 = optimizeWeeklyMealPlan("2026-07-20", days, {
      recipes,
      inventory: [],
      preferences: basePreferences,
      recentRecipeIds: [],
      allergies: [],
      dietaryRestrictions: [],
      conditionsByDate: {},
      mode: "バランス重視",
      foodMasters: [],
    });
    const v4 = optimizeWeeklyMealPlanV4(
      "2026-07-20",
      days,
      baseContext({ recipes, mode: "バランス重視", schedules: [] }),
    );
    expect(v4.days.length).toBe(v3.days.length);
  });
});

describe("cook suitability hard rules", () => {
  const fried = recipeStub({
    id: "fried",
    name: "唐揚げ",
    cookingProfile: {
      ...emptyRecipeCookingProfile(),
      requiresDeepFrying: true,
      difficulty: "hard",
      beginnerFriendly: false,
      stepCount: 10,
      totalCookingMinutes: 45,
      source: "manual",
    },
  });

  it("excludes recipes the cook cannot make", () => {
    const cook = cookStub({
      familyMemberProfileId: "daughter",
      cookingLevel: "beginner",
      canDeepFry: false,
      avoidRecipeIds: [],
    });
    const fit = evaluateDayLifestyleFit(
      scheduleStub({ dayOfWeek: "friday", avoidDeepFrying: false, defaultCookMemberId: "daughter" }),
      null,
      fried,
      cook,
    );
    expect(fit.blocked).toBe(true);
  });

  it("boosts preferred / mastered recipes", () => {
    const easy = recipeStub({ id: "easy", name: "麻婆豆腐" });
    const cook = cookStub({
      familyMemberProfileId: "husband",
      preferredRecipeIds: ["easy"],
      masteredRecipeIds: ["easy"],
    });
    const score = evaluateRecipeForCook(easy, cook, []);
    expect(score.points).toBeGreaterThan(0);
    expect(score.blocked).toBe(false);
  });

  it("blocks hard recipes on beginner day", () => {
    const hard = recipeStub({
      id: "hard",
      name: "複雑な料理",
      cookingProfile: {
        ...emptyRecipeCookingProfile(),
        difficulty: "hard",
        beginnerFriendly: false,
        source: "manual",
      },
    });
    const cook = cookStub({
      familyMemberProfileId: "daughter",
      cookingLevel: "beginner",
      canDeepFry: false,
    });
    const fit = evaluateDayLifestyleFit(
      scheduleStub({
        dayOfWeek: "friday",
        defaultCookMemberId: "daughter",
        effortLevel: "very_easy",
        maxStepCount: 5,
      }),
      null,
      hard,
      cook,
    );
    expect(fit.blocked).toBe(true);
  });

  it("blocks deep frying on avoidDeepFrying days", () => {
    const cook = cookStub({
      familyMemberProfileId: "daughter",
      cookingLevel: "beginner",
      canDeepFry: true,
    });
    const fit = evaluateDayLifestyleFit(
      scheduleStub({
        dayOfWeek: "friday",
        defaultCookMemberId: "daughter",
        avoidDeepFrying: true,
      }),
      null,
      fried,
      cook,
    );
    expect(fit.blocked).toBe(true);
  });

  it("blocks over cooking time limit", () => {
    const long = recipeStub({
      id: "long",
      name: "煮込み",
      cookingTimeMinutes: 50,
      cookingProfile: {
        ...emptyRecipeCookingProfile(),
        totalCookingMinutes: 50,
        source: "manual",
      },
    });
    const fit = evaluateDayLifestyleFit(
      scheduleStub({ dayOfWeek: "tuesday", cookingTimeLimitMinutes: 30 }),
      null,
      long,
      cookStub({ familyMemberProfileId: "husband" }),
    );
    expect(fit.blocked).toBe(true);
  });

  it("blocks over step count", () => {
    const many = recipeStub({
      id: "many",
      name: "工程多い",
      steps: Array.from({ length: 12 }, (_, i) => ({
        id: `x${i}`,
        order: i + 1,
        text: "step",
      })),
      cookingProfile: {
        ...emptyRecipeCookingProfile(),
        stepCount: 12,
        source: "manual",
      },
    });
    const fit = evaluateDayLifestyleFit(
      scheduleStub({ dayOfWeek: "friday", maxStepCount: 5 }),
      null,
      many,
      cookStub({ familyMemberProfileId: "daughter", cookingLevel: "beginner" }),
    );
    expect(fit.blocked).toBe(true);
  });

  it("prefers low cleanup", () => {
    const clean = recipeStub({
      id: "clean",
      name: "和え物",
      course: "副菜",
      cookingProfile: {
        ...emptyRecipeCookingProfile(),
        cleanupLevel: "low",
        source: "manual",
      },
    });
    const fit = evaluateDayLifestyleFit(
      scheduleStub({ dayOfWeek: "wednesday", preferLowCleanup: true }),
      null,
      clean,
      cookStub({ familyMemberProfileId: "husband" }),
    );
    expect(fit.points).toBeGreaterThan(0);
    expect(fit.reasons.some((r) => r.includes("洗い物"))).toBe(true);
  });
});

describe("shopping and familiarity", () => {
  it("scores shopping day candidates higher for new ingredients", () => {
    const score = evaluateWeeklyIngredientReuse(
      {},
      recipeStub({
        id: "buy",
        name: "鶏料理",
        ingredients: [
          {
            id: "1",
            name: "鶏肉",
            quantity: 300,
            unit: "g",
            note: "",
            ingredientType: "通常",
          },
        ],
      }),
      "2026-07-20",
      "2026-07-20",
    );
    expect(score.points).toBeGreaterThan(0);
  });

  it("penalizes many new ingredients on non-shopping days", () => {
    const score = evaluateWeeklyIngredientReuse(
      { 鶏肉: 1 },
      recipeStub({
        id: "extra",
        name: "新しい材料多数",
        ingredients: [
          { id: "1", name: "鶏肉", quantity: 100, unit: "g", note: "", ingredientType: "通常" },
          { id: "2", name: "あさり", quantity: 1, unit: "パック", note: "", ingredientType: "通常" },
          { id: "3", name: "生クリーム", quantity: 100, unit: "ml", note: "", ingredientType: "通常" },
          { id: "4", name: "パルメザン", quantity: 20, unit: "g", note: "", ingredientType: "通常" },
        ],
      }),
      "2026-07-21",
      "2026-07-20",
    );
    expect(score.points).toBeLessThan(0);
  });

  it("treats 3+ history cooks as familiar", () => {
    const recipe = recipeStub({ id: "omurice", name: "オムライス" });
    const cook = cookStub({ familyMemberProfileId: "husband" });
    const history: CookingHistory[] = [1, 2, 3].map((n) => ({
      id: `h${n}`,
      householdId: "local",
      recipeId: "omurice",
      cookedByMemberId: "husband",
      cookedAt: `2026-01-0${n}T00:00:00.000Z`,
      difficultyFeedback: null,
      durationMinutes: null,
      successRating: null,
      notes: null,
    }));
    const score = evaluateRecipeForCook(recipe, cook, history);
    expect(score.points).toBeGreaterThan(0);
    expect(score.reasons.some((r) => r.includes("作り慣れた"))).toBe(true);
  });

  it("boosts new recipes on allowNewRecipes days", () => {
    const recipe = recipeStub({ id: "new", name: "新しい料理" });
    const cook = cookStub({ familyMemberProfileId: "wife" });
    const fit = evaluateDayLifestyleFit(
      scheduleStub({
        dayOfWeek: "monday",
        defaultCookMemberId: "wife",
        allowNewRecipes: true,
        effortLevel: "elaborate",
        shoppingAvailable: true,
        isShoppingDay: true,
      }),
      null,
      recipe,
      cook,
    );
    expect(fit.blocked).toBe(false);
  });
});

describe("daily overrides and weekly plan", () => {
  it("skips eating out days", () => {
    const override: DailyCookingOverride = {
      id: "o1",
      householdId: "local",
      date: "2026-07-21",
      cookMemberId: null,
      isEatingOut: true,
      skipMealPlanning: false,
      cookingTimeLimitMinutes: null,
      effortLevel: null,
      shoppingAvailable: null,
      allowNewRecipes: null,
      participantMemberIds: [],
      notes: null,
      updatedAt: "",
    };
    const proposal = optimizeWeeklyMealPlanV4(
      "2026-07-20",
      [blankDay("2026-07-21")],
      baseContext({
        recipes: [recipeStub({ id: "a", name: "炒め", course: "主菜" })],
        schedules: [scheduleStub({ dayOfWeek: "tuesday" })],
        overrides: [override],
        cookingProfiles: [cookStub({ familyMemberProfileId: "husband" })],
      }),
    );
    expect(proposal.days[0]?.items).toEqual([]);
    expect(proposal.days[0]?.recommendation.reasons[0]).toContain("外食");
  });

  it("applies cook override for a specific day", () => {
    const wifeOnly = recipeStub({
      id: "wife-dish",
      name: "妻の料理",
      cookingProfile: {
        ...emptyRecipeCookingProfile(),
        assignedCookMemberIds: ["wife"],
        source: "manual",
      },
    });
    const husbandCook = cookStub({ familyMemberProfileId: "husband" });
    const wifeCook = cookStub({ familyMemberProfileId: "wife", cookingLevel: "advanced" });
    const blockedForHusband = evaluateDayLifestyleFit(
      scheduleStub({ dayOfWeek: "tuesday", defaultCookMemberId: "husband" }),
      null,
      wifeOnly,
      husbandCook,
    );
    const allowedForWife = evaluateDayLifestyleFit(
      scheduleStub({ dayOfWeek: "tuesday", defaultCookMemberId: "husband" }),
      {
        id: "ov",
        householdId: "local",
        date: "2026-07-21",
        cookMemberId: "wife",
        isEatingOut: false,
        skipMealPlanning: false,
        cookingTimeLimitMinutes: null,
        effortLevel: null,
        shoppingAvailable: null,
        allowNewRecipes: null,
        participantMemberIds: [],
        notes: null,
        updatedAt: "",
      },
      wifeOnly,
      wifeCook,
    );
    expect(blockedForHusband.blocked).toBe(true);
    expect(allowedForWife.blocked).toBe(false);
  });

  it("reuses weekly ingredients across days", () => {
    const first = evaluateWeeklyIngredientReuse(
      {},
      recipeStub({
        id: "d1",
        name: "鶏",
        ingredients: [
          { id: "1", name: "鶏肉", quantity: 200, unit: "g", note: "", ingredientType: "通常" },
        ],
      }),
      "2026-07-20",
      "2026-07-20",
    );
    const second = evaluateWeeklyIngredientReuse(
      { 鶏肉: 1 },
      recipeStub({
        id: "d2",
        name: "鶏2",
        ingredients: [
          { id: "1", name: "鶏肉", quantity: 200, unit: "g", note: "", ingredientType: "通常" },
        ],
      }),
      "2026-07-21",
      "2026-07-20",
    );
    expect(first.points).toBeGreaterThan(0);
    expect(second.reasons.some((r) => r.includes("活用"))).toBe(true);
  });

  it("keeps allergy hard constraints above cook suitability", () => {
    const egg = recipeStub({
      id: "egg",
      name: "卵料理",
      ingredients: [
        {
          id: "1",
          name: "卵",
          quantity: 2,
          unit: "個",
          note: "",
          ingredientType: "通常",
        },
      ],
      cookingProfile: {
        ...emptyRecipeCookingProfile(),
        beginnerFriendly: true,
        assignedCookMemberIds: ["daughter"],
        source: "manual",
      },
    });
    const allergy = evaluateRecipeHardConstraints(egg, ["卵"], []);
    expect(allergy.blocked).toBe(true);
    const cookFit = evaluateDayLifestyleFit(
      scheduleStub({ dayOfWeek: "friday", defaultCookMemberId: "daughter" }),
      null,
      egg,
      cookStub({
        familyMemberProfileId: "daughter",
        cookingLevel: "beginner",
        preferredRecipeIds: ["egg"],
      }),
    );
    // 適性だけでは通るが、アレルギーは別レイヤで必ず除外
    expect(cookFit.blocked).toBe(false);
    expect(allergy.blocked).toBe(true);
  });

  it("remains compatible with v3 optimizeWeeklyMealPlan signature usage", () => {
    const recipes = [
      recipeStub({ id: "m", name: "主菜", course: "主菜" }),
      recipeStub({ id: "s", name: "汁物", course: "汁物" }),
    ];
    const days = [blankDay("2026-07-22")];
    const proposal = optimizeWeeklyMealPlan("2026-07-20", days, {
      recipes,
      inventory: [],
      preferences: basePreferences,
      recentRecipeIds: [],
      allergies: [],
      dietaryRestrictions: [],
      conditionsByDate: {},
      mode: "バランス重視",
      foodMasters: [],
    });
    expect(proposal.mode).toBe("バランス重視");
  });
});
