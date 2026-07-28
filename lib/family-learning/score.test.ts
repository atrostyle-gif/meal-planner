import { describe, expect, it } from "vitest";
import { scoreFamilyLearning } from "@/lib/family-learning/score";
import type { FamilyLearningProfile } from "@/types/family-learning";
import type { Recipe } from "@/types/recipe";

function recipeStub(
  partial: Partial<Recipe> & Pick<Recipe, "id" | "name" | "course">,
): Recipe {
  return {
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
    proteinType: "豚",
    season: null,
    difficulty: null,
    favoriteScore: null,
    healthyScore: null,
    averageRating: 4.5,
    cookCount: 3,
    isSample: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function profileStub(
  partial: Partial<FamilyLearningProfile> = {},
): FamilyLearningProfile {
  return {
    householdId: "local",
    updatedAt: new Date().toISOString(),
    sampleCount: 8,
    favoriteCuisine: [{ name: "和食", avgRating: 4.6, count: 5 }],
    favoriteCookingTime: { maxMinutes: 25, avgRating: 4.5, count: 5 },
    favoriteDifficulty: "easy",
    favoriteIngredients: [{ name: "豚肉", score: 10, count: 3 }],
    favoriteSeason: "夏",
    favoriteWeekday: [
      {
        day: "tuesday",
        label: "火",
        avgRating: 4.8,
        count: 3,
        preferredMaxMinutes: 20,
      },
    ],
    favoriteMealStyle: ["和食"],
    successfulPatterns: [
      {
        id: "member-easy:m1",
        label: "娘担当は簡単料理が成功",
        weight: 10,
        cookMemberId: "m1",
        maxCookingMinutes: 20,
      },
    ],
    memberLearning: [
      {
        memberId: "m1",
        memberName: "娘",
        averageRating: 4.7,
        cookCount: 4,
        preferredMaxCookingMinutes: 20,
        preferEasy: true,
        acceptElaborate: false,
        successfulRecipeIds: ["r1"],
        insight: "娘担当の日は簡単料理を優先",
      },
    ],
    avoidedPatterns: [
      {
        label: "揚げ物",
        reason: "最近評価が低い",
        weight: 10,
        cuisine: "揚げ物",
      },
    ],
    insights: ["和食料理は評価4.6"],
    cookCompletionRate: 0.8,
    changeAwayRecipeIds: [],
    tasteThickRate: 0.1,
    tasteThinRate: 0.2,
    ...partial,
  };
}

describe("scoreFamilyLearning", () => {
  it("家庭の好みジャンルと担当者傾向を加点する", () => {
    const recipe = recipeStub({
      id: "r1",
      name: "豚の生姜焼き",
      course: "主菜",
      category: "和食",
      cookingTimeMinutes: 18,
    });
    const result = scoreFamilyLearning(recipe, profileStub(), {
      dayIndex: 1, // 火
      cookMemberId: "m1",
    });
    expect(result.delta).toBeGreaterThan(0);
    expect(
      result.reasons.some(
        (r) =>
          r.detail.includes("この家庭") ||
          r.detail.includes("娘") ||
          r.detail.includes("火曜"),
      ),
    ).toBe(true);
  });

  it("揚げ物回避を減点する", () => {
    const recipe = recipeStub({
      id: "r2",
      name: "唐揚げ",
      course: "主菜",
      category: "和食",
      cookingTimeMinutes: 30,
    });
    const result = scoreFamilyLearning(recipe, profileStub(), {
      dayIndex: 0,
      cookMemberId: null,
    });
    expect(result.reasons.some((r) => r.detail.includes("揚げ物"))).toBe(true);
    expect(result.delta).toBeLessThan(
      scoreFamilyLearning(
        recipeStub({
          id: "r3",
          name: "焼き魚",
          course: "主菜",
          cookingTimeMinutes: 15,
        }),
        profileStub(),
        { dayIndex: 0 },
      ).delta,
    );
  });

  it("サンプル不足では加点しない", () => {
    const result = scoreFamilyLearning(
      recipeStub({ id: "r1", name: "テスト", course: "主菜" }),
      profileStub({ sampleCount: 1 }),
    );
    expect(result.delta).toBe(0);
  });
});
