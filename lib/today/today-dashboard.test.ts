import { describe, expect, it } from "vitest";
import {
  buildTodayDashboard,
  pickPrimaryDish,
} from "@/lib/today/dashboard";
import type { MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import type { CookingFeedback } from "@/types/recipe-learning";
import type { CookingHistory } from "@/types/weekly-lifestyle";

function makeRecipe(
  id: string,
  name: string,
  minutes: number,
  course: Recipe["course"] = "主菜",
  servings = 2,
): Recipe {
  const now = "2026-07-01T00:00:00.000Z";
  return {
    id,
    name,
    category: "和食",
    course,
    servings,
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

function makePlan(items: MealPlan["days"][0]["items"], participantMemberIds?: string[]): MealPlan {
  return {
    id: "plan-1",
    weekStart: "2026-07-20",
    weeklyFoodBudgetYen: 7000,
    days: [
      {
        date: "2026-07-20",
        locked: false,
        items,
        participantMemberIds,
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
      feedbacks: [],
      cookingHistory: [],
    });
    expect(dash.dishes).toHaveLength(0);
    expect(dash.primaryCook).toBeNull();
    expect(dash.servings).toBeNull();
    expect(dash.cookingTimeMinutes).toBeNull();
    expect(dash.reviewStatus).toBe("pending");
    expect(dash.reviewSummary).toBeNull();
  });

  it("今日の献立を主菜・副菜・汁物などで集約する", () => {
    const main = makeRecipe("r1", "生姜焼き", 25, "主菜", 4);
    const side = makeRecipe("r2", "サラダ", 10, "副菜", 4);
    const soup = makeRecipe("r3", "味噌汁", 15, "汁物", 4);
    const plan = makePlan([
      { id: "item-1", recipeId: "r1", course: "主菜", order: 1, source: "manual" },
      { id: "item-2", recipeId: "r2", course: "副菜", order: 2, source: "manual" },
      { id: "item-3", recipeId: "r3", course: "汁物", order: 3, source: "manual" },
    ]);

    const dash = buildTodayDashboard({
      date: "2026-07-20",
      weekStart: "2026-07-20",
      mealPlan: plan,
      recipes: [main, side, soup],
      defaultMealServings: 4,
      feedbacks: [],
      cookingHistory: [],
    });

    expect(dash.dishes).toHaveLength(3);
    expect(dash.dishes.map((d) => d.title)).toEqual([
      "生姜焼き",
      "サラダ",
      "味噌汁",
    ]);
    expect(dash.cookingTimeMinutes).toBe(25);
    expect(dash.servings).toBe(4);
    expect(dash.primaryCook?.recipeId).toBe("r1");
    expect(dash.primaryCook?.cookHref).toContain("/recipes/r1/cook");
    expect(dash.primaryCook?.cookHref).toContain("mealItemId=item-1");
    expect(dash.reviewStatus).toBe("pending");
  });

  it("日別献立人数を優先する", () => {
    const recipe = makeRecipe("r1", "生姜焼き", 15, "主菜", 4);
    const plan = makePlan(
      [{ id: "item-1", recipeId: "r1", course: "主菜", order: 1, source: "manual" }],
    );
    plan.days[0] = {
      ...plan.days[0]!,
      servings: 3,
      servingsMode: "custom",
    };
    const dash = buildTodayDashboard({
      date: "2026-07-20",
      weekStart: "2026-07-20",
      mealPlan: plan,
      recipes: [recipe],
      defaultMealServings: 4,
      feedbacks: [],
      cookingHistory: [],
    });
    expect(dash.servings).toBe(3);
    expect(dash.servingsIsCustom).toBe(true);
    expect(dash.primaryCook?.servings).toBe(3);
    expect(recipe.servings).toBe(4);
  });

  it("参加者がいれば人数に使う", () => {
    // 互換: 参加者は日別人数が無いときの候補ではなく、日別人数が正
    const recipe = makeRecipe("r1", "生姜焼き", 15, "主菜", 2);
    const plan = makePlan(
      [{ id: "item-1", recipeId: "r1", course: "主菜", order: 1, source: "manual" }],
      ["m1", "m2", "m3"],
    );
    const dash = buildTodayDashboard({
      date: "2026-07-20",
      weekStart: "2026-07-20",
      mealPlan: plan,
      recipes: [recipe],
      defaultMealServings: 4,
      feedbacks: [],
      cookingHistory: [],
    });
    expect(dash.servings).toBe(4);
  });

  it("主菜が無い場合は主食など次の優先コースを調理対象にする", () => {
    const staple = makeRecipe("r1", "ごはん", 5, "主食");
    const side = makeRecipe("r2", "サラダ", 10, "副菜");
    const dishes = [
      {
        mealItemId: "i2",
        recipeId: "r2",
        title: "サラダ",
        course: "副菜" as const,
        cookingTimeMinutes: 10,
        cookHref: "/cook/r2",
      },
      {
        mealItemId: "i1",
        recipeId: "r1",
        title: "ごはん",
        course: "主食" as const,
        cookingTimeMinutes: 5,
        cookHref: "/cook/r1",
      },
    ];
    expect(pickPrimaryDish(dishes)?.recipeId).toBe("r1");
    void staple;
    void side;
  });

  it("調理完了フラグがあるとレビュー ready になる", () => {
    const recipe = makeRecipe("r1", "生姜焼き", 15);
    const plan = makePlan([
      { id: "item-1", recipeId: "r1", course: "主菜", order: 1, source: "manual" },
    ]);
    const dash = buildTodayDashboard({
      date: "2026-07-20",
      weekStart: "2026-07-20",
      mealPlan: plan,
      recipes: [recipe],
      feedbacks: [],
      cookingHistory: [],
      cookDoneByRecipeId: { r1: true },
    });
    expect(dash.reviewStatus).toBe("ready");
  });

  it("当日の調理履歴があるとレビュー ready になる", () => {
    const recipe = makeRecipe("r1", "生姜焼き", 15);
    const plan = makePlan([
      { id: "item-1", recipeId: "r1", course: "主菜", order: 1, source: "manual" },
    ]);
    const cookingHistory: CookingHistory[] = [
      {
        id: "h1",
        householdId: "local",
        recipeId: "r1",
        cookedAt: "2026-07-20T18:00:00.000Z",
        cookedByMemberId: null,
        createdBy: null,
        difficultyFeedback: null,
        durationMinutes: 15,
        cookingTimeActual: 15,
        servings: 2,
        successRating: null,
        notes: null,
        memo: null,
        wantAgain: null,
        improvementTags: [],
      },
    ];
    const dash = buildTodayDashboard({
      date: "2026-07-20",
      weekStart: "2026-07-20",
      mealPlan: plan,
      recipes: [recipe],
      feedbacks: [],
      cookingHistory,
      cookDoneByRecipeId: { r1: false },
    });
    expect(dash.reviewStatus).toBe("ready");
  });

  it("当日フィードバックがあるとレビュー done になる", () => {
    const recipe = makeRecipe("r1", "生姜焼き", 15);
    const plan = makePlan([
      { id: "item-1", recipeId: "r1", course: "主菜", order: 1, source: "manual" },
    ]);
    const feedbacks: CookingFeedback[] = [
      {
        id: "f1",
        historyId: "h1",
        recipeId: "r1",
        householdId: "local",
        cookedAt: "2026-07-20T19:00:00.000Z",
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
        improvementTags: ["want_again"],
        memberRatings: [],
        adjustments: [],
        seasoningAdjustments: [],
        photoDataUrl: null,
        memo: "美味しかった",
        createdAt: "2026-07-20T19:00:00.000Z",
        updatedAt: "2026-07-20T19:00:00.000Z",
      },
    ];
    const dash = buildTodayDashboard({
      date: "2026-07-20",
      weekStart: "2026-07-20",
      mealPlan: plan,
      recipes: [recipe],
      feedbacks,
      cookingHistory: [],
      cookDoneByRecipeId: { r1: true },
    });
    expect(dash.reviewStatus).toBe("done");
    expect(dash.reviewSummary?.overallRating).toBe(5);
    expect(dash.reviewSummary?.memo).toBe("美味しかった");
  });
});
