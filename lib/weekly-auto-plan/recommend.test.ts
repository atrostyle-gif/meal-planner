import { describe, expect, it } from "vitest";
import { evaluateDayCombo } from "@/lib/weekly-auto-plan/combo";
import { scoreMealPlanTags } from "@/lib/weekly-auto-plan/plan-tags-score";
import { recommendRecipesForSlot } from "@/lib/weekly-auto-plan/recommend";
import type { DayMeal } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";

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

describe("evaluateDayCombo", () => {
  it("パスタ主食がある日は洋風副菜を優先する", () => {
    const pasta = recipeStub({
      id: "p1",
      name: "カルボナーラ",
      course: "主食",
      category: "洋食",
    });
    const salad = recipeStub({
      id: "s1",
      name: "シーザーサラダ",
      course: "副菜",
      category: "洋食",
      tags: ["サラダ"],
    });
    const ginger = recipeStub({
      id: "m1",
      name: "生姜焼き",
      course: "主菜",
      category: "和食",
      proteinType: "豚",
      ingredients: [
        {
          id: "i1",
          name: "豚肉",
          quantity: 200,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
      ],
    });
    const day: DayMeal = {
      date: "2026-07-27",
      locked: false,
      items: [
        {
          id: "x1",
          recipeId: pasta.id,
          course: "主食",
          order: 1,
          source: "manual",
        },
      ],
    };
    const map = new Map([
      [pasta.id, pasta],
      [salad.id, salad],
      [ginger.id, ginger],
    ]);

    const western = evaluateDayCombo(salad, day, map, "副菜");
    const meatMain = evaluateDayCombo(ginger, day, map, "主菜");

    expect(western.reasons.some((r) => r.detail.includes("洋風"))).toBe(true);
    expect(western.delta).toBeGreaterThan(meatMain.delta);
  });
});

describe("scoreMealPlanTags", () => {
  it("時短タグで短い調理時間を加点する", () => {
    const quick = recipeStub({
      id: "q1",
      name: "炒め物",
      course: "主菜",
      cookingTimeMinutes: 15,
    });
    const slow = recipeStub({
      id: "q2",
      name: "煮込み",
      course: "主菜",
      cookingTimeMinutes: 60,
    });
    const quickScore = scoreMealPlanTags(quick, ["quick"]);
    const slowScore = scoreMealPlanTags(slow, ["quick"]);
    expect(quickScore.delta).toBeGreaterThan(slowScore.delta);
  });

  it("魚多めタグで魚料理を加点する", () => {
    const fish = recipeStub({
      id: "f1",
      name: "焼き魚",
      course: "主菜",
      proteinType: "魚",
    });
    const meat = recipeStub({
      id: "m1",
      name: "生姜焼き",
      course: "主菜",
      proteinType: "豚",
    });
    expect(scoreMealPlanTags(fish, ["more_fish"]).delta).toBeGreaterThan(
      scoreMealPlanTags(meat, ["more_fish"]).delta,
    );
  });
});

describe("recommendRecipesForSlot", () => {
  it("スコア順におすすめを返す", () => {
    const weekStart = "2026-07-27";
    const recipes = [
      recipeStub({
        id: "m1",
        name: "鶏の照り焼き",
        course: "主菜",
        proteinType: "鶏",
        cookingTimeMinutes: 20,
        favoriteScore: 5,
      }),
      recipeStub({
        id: "m2",
        name: "豚の生姜焼き",
        course: "主菜",
        proteinType: "豚",
        cookingTimeMinutes: 25,
      }),
      recipeStub({
        id: "m3",
        name: "焼き魚",
        course: "主菜",
        proteinType: "魚",
        cookingTimeMinutes: 15,
      }),
    ];
    const days: DayMeal[] = [
      {
        date: weekStart,
        locked: false,
        items: [],
      },
    ];
    const result = recommendRecipesForSlot({
      weekStart,
      date: weekStart,
      course: "主菜",
      days,
      recipes,
      inventory: [],
      leftovers: [],
      tab: "recommend",
      limit: 5,
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.reasons.length).toBeGreaterThan(0);
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i - 1]!.score).toBeGreaterThanOrEqual(result[i]!.score);
    }
  });
});
