import { describe, expect, it } from "vitest";
import {
  detectCuisineFamily,
  detectFlavorProfiles,
  evaluateCandidateAgainstMealSet,
  evaluateMealSetCompatibility,
} from "@/lib/meal-planner-engine/meal-set";
import { evaluateMealCombination } from "@/lib/meal-planner-engine/v3";
import type { Recipe } from "@/types/recipe";

function recipeStub(partial: Partial<Recipe> & Pick<Recipe, "id" | "name">): Recipe {
  return {
    ingredients: [],
    steps: [],
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

describe("meal set compatibility", () => {
  it("detects italian and japanese cuisines", () => {
    expect(
      detectCuisineFamily(
        recipeStub({ id: "1", name: "カルボナーラ", category: "イタリアン", course: "主食" }),
      ),
    ).toBe("italian");
    expect(
      detectCuisineFamily(
        recipeStub({ id: "2", name: "ブリの照り焼き", category: "和食", course: "主菜" }),
      ),
    ).toBe("japanese");
  });

  it("detects cream and ginger flavors", () => {
    expect(
      detectFlavorProfiles(
        recipeStub({ id: "1", name: "カルボナーラ", category: "イタリアン", course: "主食" }),
      ),
    ).toContain("cream");
    expect(
      detectFlavorProfiles(
        recipeStub({ id: "2", name: "生姜焼き", category: "和食", course: "主菜" }),
      ),
    ).toContain("ginger");
  });

  it("heavily penalizes carbonara + buri teriyaki", () => {
    const pasta = recipeStub({
      id: "p",
      name: "カルボナーラ",
      category: "イタリアン",
      course: "主食",
    });
    const fish = recipeStub({
      id: "f",
      name: "ブリの照り焼き",
      category: "和食",
      course: "主菜",
      proteinType: "魚",
    });
    const result = evaluateCandidateAgainstMealSet([pasta], fish);
    expect(result.incompatible).toBe(true);
    expect(result.points).toBeLessThan(-30);
  });

  it("heavily penalizes peperoncino + ginger pork", () => {
    const pasta = recipeStub({
      id: "p",
      name: "ペペロンチーノ",
      category: "イタリアン",
      course: "主食",
    });
    const pork = recipeStub({
      id: "m",
      name: "生姜焼き",
      category: "和食",
      course: "主菜",
      proteinType: "豚",
    });
    const result = evaluateMealSetCompatibility([pasta, pork]);
    expect(result.incompatible).toBe(true);
    expect(result.points).toBeLessThan(-30);
  });

  it("prefers Japanese teishoku style", () => {
    const set = evaluateMealSetCompatibility([
      recipeStub({ id: "r", name: "ごはん", category: "和食", course: "主食" }),
      recipeStub({ id: "m", name: "鯖の味噌煮", category: "和食", course: "主菜" }),
      recipeStub({ id: "s", name: "ほうれん草のおひたし", category: "和食", course: "副菜" }),
      recipeStub({ id: "u", name: "味噌汁", category: "和食", course: "汁物" }),
    ]);
    expect(set.incompatible).toBe(false);
    expect(set.points).toBeGreaterThan(0);
    expect(set.reasons.some((reason) => reason.includes("定食"))).toBe(true);
  });

  it("allows pasta with light salad", () => {
    const result = evaluateCandidateAgainstMealSet(
      [
        recipeStub({
          id: "p",
          name: "ペペロンチーノ",
          category: "イタリアン",
          course: "主食",
        }),
      ],
      recipeStub({
        id: "s",
        name: "グリーンサラダ",
        category: "サラダ",
        course: "副菜",
      }),
    );
    expect(result.incompatible).toBe(false);
    expect(result.points).toBeGreaterThan(0);
  });

  it("feeds into evaluateMealCombination warnings", () => {
    const evaluation = evaluateMealCombination(
      [
        recipeStub({
          id: "p",
          name: "カルボナーラ",
          category: "イタリアン",
          course: "主食",
        }),
        recipeStub({
          id: "f",
          name: "ブリの照り焼き",
          category: "和食",
          course: "主菜",
        }),
      ],
      { conditions: ["通常"], mode: "バランス重視" },
    );
    expect(evaluation.score).toBeLessThan(40);
    expect(evaluation.warnings.length).toBeGreaterThan(0);
  });
});
