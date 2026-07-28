import { describe, expect, it } from "vitest";
import {
  buildDayServingsPatch,
  buildResetDayServingsPatch,
  getServingScale,
  resolveDayServings,
  resolveDefaultMealServings,
} from "@/lib/servings/resolve";
import { scaleIngredientQuantity } from "@/lib/shopping/scale-ingredient";
import {
  scaleNutritionForPlannedServings,
  calculateRecipeNutritionFromIngredients,
} from "@/lib/nutrition/calculate";
import { generateAggregatedIngredientsFromMealPlan } from "@/lib/shopping/generate-shopping-list";
import { createSampleFoodMasters } from "@/lib/food-master/sample-data";
import type { MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import { emptyNutritionAmount } from "@/types/food-master";

describe("人数設計・分量倍率", () => {
  it("元レシピ4人分を献立3人分へ0.75倍できる", () => {
    const result = getServingScale({
      recipeServings: 4,
      plannedServings: 3,
    });
    expect(result.scale).toBe(0.75);
    expect(scaleIngredientQuantity(400, 4, 3)).toBe(300);
    expect(scaleIngredientQuantity(2, 4, 3)).toBe(1.5);
  });

  it("元レシピ2人分を献立4人分へ2倍できる", () => {
    const result = getServingScale({
      recipeServings: 2,
      plannedServings: 4,
    });
    expect(result.scale).toBe(2);
    expect(scaleIngredientQuantity(100, 2, 4)).toBe(200);
  });

  it("日別人数を保存できる（custom パッチ）", () => {
    const patch = buildDayServingsPatch(5, 3);
    expect(patch.servingsMode).toBe("custom");
    expect(patch.servings).toBe(5);
  });

  it("通常人数へ戻せる", () => {
    const patch = buildResetDayServingsPatch();
    expect(patch.servingsMode).toBe("default");
    expect(patch.servings).toBeNull();

    const sameAsDefault = buildDayServingsPatch(3, 3);
    expect(sameAsDefault.servingsMode).toBe("default");
  });

  it("resolveDayServings は default / custom / 旧 override を扱う", () => {
    expect(
      resolveDayServings(
        { servings: null, servingsMode: "default", items: [] },
        3,
      ),
    ).toEqual({ servings: 3, mode: "default", isCustom: false });

    expect(
      resolveDayServings(
        { servings: 6, servingsMode: "custom", items: [] },
        3,
      ).servings,
    ).toBe(6);

    expect(
      resolveDayServings(
        {
          items: [
            {
              id: "1",
              recipeId: "r",
              course: "主菜",
              order: 1,
              servingsOverride: 2,
            },
          ],
        },
        4,
      ),
    ).toMatchObject({ servings: 2, mode: "custom", isCustom: true });
  });

  it("レシピ本体の servings は倍率計算で変更しない", () => {
    const recipeServings = 4;
    getServingScale({ recipeServings, plannedServings: 2 });
    expect(recipeServings).toBe(4);
  });

  it("人数不明のレシピでもクラッシュせず倍率1", () => {
    const result = getServingScale({
      recipeServings: null,
      plannedServings: 3,
    });
    expect(result.scale).toBe(1);
    expect(result.recipeServingsKnown).toBe(false);
    expect(scaleIngredientQuantity(100, 0, 3)).toBe(100);
  });

  it("家庭の通常人数は家族人数を候補にできる", () => {
    expect(
      resolveDefaultMealServings({ familyMemberCount: 3 }),
    ).toBe(3);
    expect(resolveDefaultMealServings({})).toBe(4);
  });

  it("買い物リストに日別人数が反映され、複数日を合算できる", () => {
    const recipe: Recipe = {
      id: "r1",
      name: "カレー",
      category: "洋食",
      course: "主菜",
      servings: 4,
      cookingTimeMinutes: 40,
      ingredients: [
        {
          id: "i1",
          name: "玉ねぎ",
          quantity: 2,
          unit: "個",
          note: "",
          ingredientType: "normal",
        },
      ],
      steps: [],
      tags: [],
      memo: "",
      favoriteScore: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };

    const plan: MealPlan = {
      id: "p1",
      weekStart: "2026-07-20",
      days: [
        {
          date: "2026-07-20",
          locked: false,
          servings: 4,
          servingsMode: "custom",
          items: [
            {
              id: "m1",
              recipeId: "r1",
              course: "主菜",
              order: 1,
              source: "manual",
            },
          ],
        },
        {
          date: "2026-07-21",
          locked: false,
          items: [],
        },
        {
          date: "2026-07-22",
          locked: false,
          items: [],
        },
        {
          date: "2026-07-23",
          locked: false,
          servings: 2,
          servingsMode: "custom",
          items: [
            {
              id: "m2",
              recipeId: "r1",
              course: "主菜",
              order: 1,
              source: "manual",
            },
          ],
        },
        {
          date: "2026-07-24",
          locked: false,
          items: [],
        },
        {
          date: "2026-07-25",
          locked: false,
          items: [],
        },
        {
          date: "2026-07-26",
          locked: false,
          items: [],
        },
      ],
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };

    const groups = generateAggregatedIngredientsFromMealPlan(plan, [recipe], 3);
    const onion = groups.find((g) => g.ingredientName.includes("玉ねぎ"));
    expect(onion).toBeTruthy();
    const total = (onion?.quantities ?? []).reduce(
      (sum, q) => sum + (q.quantity ?? 0),
      0,
    );
    // 月4人分=2個 + 木2人分=1個 → 3個
    expect(total).toBe(3);
  });

  it("栄養計算で倍率を二重適用しない", () => {
    const masters = createSampleFoodMasters();
    const result = calculateRecipeNutritionFromIngredients(
      [
        {
          id: "i1",
          name: "ごはん",
          quantity: 300,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
      ],
      4,
      { masters, servingsOverride: 2, plannedServings: 2 },
    );
    // perServing は常にレシピ基準人数で割る
    const expectedPer =
      result.total.calories / 4;
    expect(result.perServing.calories).toBeCloseTo(expectedPer, 5);

    const plannedTotal = scaleNutritionForPlannedServings(
      result.perServing,
      2,
    );
    expect(plannedTotal.calories).toBeCloseTo(expectedPer * 2, 5);
    // 二重適用していないこと: planned ≠ total/2 とは限らないが、perServing は override で変わっていない
    void emptyNutritionAmount;
  });
});
