import { describe, expect, it } from "vitest";
import { checkRecipeAllergies, evaluateRecipeHardConstraints } from "@/lib/allergy/check";
import { normalizeIngredientName, canonicalizeIngredientLabel } from "@/lib/food-master/normalize";
import { convertQuantityToGrams } from "@/lib/food-master/unit-convert";
import { createSampleFoodMasters } from "@/lib/food-master/sample-data";
import { findFoodMaster } from "@/lib/food-master/match";
import {
  calculateRecipeNutritionFromIngredients,
} from "@/lib/nutrition/calculate";
import { evaluateMealCombination } from "@/lib/meal-planner-engine/v3";
import { scoreRecipeForConditions } from "@/lib/meal-planner-engine/condition-rules";
import type { Ingredient, Recipe } from "@/types/recipe";
import { emptyNutritionAmount } from "@/types/food-master";

function recipeStub(partial: Partial<Recipe> & Pick<Recipe, "name">): Recipe {
  return {
    id: "r1",
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

describe("normalize", () => {
  it("normalizes width and spaces", () => {
    expect(normalizeIngredientName("　玉　葱　")).toBe("玉葱");
  });
  it("canonicalizes aliases", () => {
    expect(canonicalizeIngredientLabel("たまねぎ")).toBe("玉ねぎ");
  });
});

describe("unit convert", () => {
  const masters = createSampleFoodMasters();
  const onion = masters.find((m) => m.id === "fm-onion")!;
  const oil = masters.find((m) => m.id === "fm-oil")!;

  it("converts g and kg", () => {
    expect(convertQuantityToGrams(100, "g", null)).toMatchObject({ ok: true, grams: 100 });
    expect(convertQuantityToGrams(1, "kg", null)).toMatchObject({ ok: true, grams: 1000 });
  });

  it("converts ml and L", () => {
    expect(convertQuantityToGrams(200, "ml", null)).toMatchObject({ ok: true, grams: 200 });
    expect(convertQuantityToGrams(1, "L", null)).toMatchObject({ ok: true, grams: 1000 });
  });

  it("converts pieces with gramsPerUnit", () => {
    expect(convertQuantityToGrams(2, "個", onion)).toMatchObject({ ok: true, grams: 400 });
  });

  it("converts tablespoon", () => {
    expect(convertQuantityToGrams(1, "大さじ", oil)).toMatchObject({ ok: true, grams: 12 });
  });

  it("does not treat 適量 as 0", () => {
    const result = convertQuantityToGrams(null, "適量", null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("optional_amount");
    }
  });
});

describe("food master match", () => {
  const masters = createSampleFoodMasters();
  it("resolves alias", () => {
    const match = findFoodMaster("たまねぎ", masters);
    expect(match.master?.canonicalName).toBe("玉ねぎ");
  });
});

describe("nutrition calculate", () => {
  const masters = createSampleFoodMasters();
  it("sums recipe nutrition and per serving", () => {
    const ingredients: Ingredient[] = [
      {
        id: "1",
        name: "玉ねぎ",
        quantity: 1,
        unit: "個",
        note: "",
        ingredientType: "normal",
      },
      {
        id: "2",
        name: "鶏もも肉",
        quantity: 200,
        unit: "g",
        note: "",
        ingredientType: "normal",
      },
    ];
    const result = calculateRecipeNutritionFromIngredients(ingredients, 2, {
      masters,
    });
    expect(result.calculatedIngredientCount).toBe(2);
    expect(result.total.calories).toBeGreaterThan(0);
    expect(result.perServing.calories).toBeCloseTo(result.total.calories / 2, 5);
    expect(result.uncalculatedIngredientCount).toBe(0);
  });

  it("does not invent 0 for unknown ingredients", () => {
    const ingredients: Ingredient[] = [
      {
        id: "1",
        name: "謎の粉XYZ",
        quantity: 10,
        unit: "g",
        note: "",
        ingredientType: "normal",
      },
    ];
    const result = calculateRecipeNutritionFromIngredients(ingredients, 1, {
      masters,
    });
    expect(result.uncalculatedIngredientCount).toBe(1);
    expect(result.total).toEqual(emptyNutritionAmount());
  });
});

describe("allergy", () => {
  it("excludes egg recipes", () => {
    const recipe = recipeStub({
      name: "卵焼き",
      ingredients: [
        {
          id: "1",
          name: "卵",
          quantity: 2,
          unit: "個",
          note: "",
          ingredientType: "normal",
        },
      ],
      proteinType: "卵",
    });
    const hits = checkRecipeAllergies(recipe, ["卵"]);
    expect(hits.length).toBeGreaterThan(0);
    const hard = evaluateRecipeHardConstraints(recipe, ["卵"], []);
    expect(hard.blocked).toBe(true);
  });

  it("blocks meat for vegetarian", () => {
    const recipe = recipeStub({
      name: "生姜焼き",
      proteinType: "豚",
      ingredients: [
        {
          id: "1",
          name: "豚バラ肉",
          quantity: 200,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
      ],
    });
    const hard = evaluateRecipeHardConstraints(recipe, [], ["ベジタリアン"]);
    expect(hard.blocked).toBe(true);
  });
});

describe("condition and combination", () => {
  it("scores gentle stomach conditions", () => {
    const recipe = recipeStub({
      name: "おかゆ",
      category: "和食",
      course: "主食",
    });
    const deltas = scoreRecipeForConditions(recipe, ["胃腸にやさしく"]);
    expect(deltas.some((d) => d.points > 0)).toBe(true);
  });

  it("penalizes carb-heavy combinations", () => {
    const evalResult = evaluateMealCombination(
      [
        recipeStub({ name: "カレーライス", category: "カレー", course: "主食" }),
        recipeStub({ name: "肉じゃが", category: "和食", course: "主菜" }),
        recipeStub({ name: "ポテトサラダ", category: "サラダ", course: "副菜" }),
      ],
      { conditions: ["通常"], mode: "バランス重視" },
    );
    expect(evalResult.warnings.some((w) => w.includes("偏り"))).toBe(true);
  });
});
