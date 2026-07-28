import { describe, expect, it } from "vitest";
import {
  aggregateDaySelectionReasons,
  buildMealSelectionReason,
  selectionReasonFromLegacyStrings,
} from "@/lib/weekly-auto-plan/explain";
import type { Recipe } from "@/types/recipe";

function recipeStub(
  partial: Partial<Recipe> & Pick<Recipe, "id" | "name" | "course">,
): Recipe {
  return {
    ingredients: [
      {
        id: "i1",
        name: "キャベツ",
        quantity: 1,
        unit: "個",
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
    favoriteScore: 5,
    healthyScore: null,
    averageRating: 4.6,
    isSample: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("buildMealSelectionReason", () => {
  it("余り食材・タグ・担当を構造化する", () => {
    const result = buildMealSelectionReason({
      recipe: recipeStub({
        id: "r1",
        name: "豚の生姜焼き",
        course: "主菜",
      }),
      score: 88,
      scoredReasons: [
        { detail: "平日のため30分以内", badge: "時短" },
        { detail: "レビュー評価が高い料理です" },
      ],
      dayIndex: 1,
      date: "2026-07-28",
      planTags: ["weight_loss", "quick"],
      leftoverMatched: ["キャベツ"],
      cookMember: { id: "m1", displayName: "太朗" },
      familyProfiles: [
        {
          id: "m1",
          householdId: "local",
          displayName: "太朗",
          age: 40,
          birthYear: null,
          ageGroup: "成人",
          sex: "男性",
          activityLevel: "普通",
          servingPortion: "普通",
          calorieTarget: null,
          proteinTarget: null,
          fatTarget: null,
          carbTarget: null,
          saltLimit: null,
          useStandardNutrition: true,
          goals: [],
          healthFlags: ["diabetes_care"],
          allergies: [],
          dislikedIngredients: [],
          likedIngredients: [],
          dietaryRestrictions: ["なし"],
          foodPreferences: [],
          cookingDays: ["tuesday"],
          notes: null,
          healthNotes: null,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
      householdHealthGoal: "減塩",
    });

    expect(result.stars).toBeGreaterThanOrEqual(4);
    expect(result.structured.inventory).toBeTruthy();
    expect(result.inventoryInfluence.some((m) => m.includes("キャベツ"))).toBe(
      true,
    );
    expect(result.profileInfluence.some((m) => m.includes("太朗"))).toBe(true);
    expect(result.tagInfluence.length).toBeGreaterThan(0);
    expect(result.structured.household).toContain("減塩");
    expect(result.reasons.every((r) => r.message.length <= 22)).toBe(true);
    expect(result.reasons[0]?.reasonType).toBeTruthy();
  });
});

describe("aggregateDaySelectionReasons", () => {
  it("日全体の理由を重複なくまとめる", () => {
    const a = selectionReasonFromLegacyStrings([
      "冷蔵庫のキャベツを使えます",
      "平日のため30分以内",
    ]);
    const b = selectionReasonFromLegacyStrings([
      "冷蔵庫のキャベツを使えます",
      "魚不足を補えます",
    ]);
    const aggregated = aggregateDaySelectionReasons([a, b]);
    expect(aggregated.messages.length).toBeGreaterThanOrEqual(2);
    const cabbage = aggregated.messages.filter((m) => m.includes("キャベツ"));
    expect(cabbage.length).toBe(1);
  });
});
