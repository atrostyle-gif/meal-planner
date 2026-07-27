import { describe, expect, it } from "vitest";
import {
  estimateDifficultyScore,
  estimateHealthScore,
} from "@/lib/nutrition/recipe-auto-estimate";

describe("recipe-auto-estimate", () => {
  it("材料・工程・時間から難易度を推定する", () => {
    expect(
      estimateDifficultyScore({
        ingredientCount: 3,
        stepCount: 3,
        cookingTimeMinutes: 10,
      }),
    ).toBe(1);

    expect(
      estimateDifficultyScore({
        ingredientCount: 10,
        stepCount: 8,
        cookingTimeMinutes: 55,
      }),
    ).toBe(5);
  });

  it("栄養から健康スコアを自動評価する", () => {
    expect(
      estimateHealthScore({
        caloriesKcal: 450,
        proteinG: 25,
        dietaryFiberG: 5,
        saltEquivalentG: 1.5,
        vegetablesG: 120,
      }),
    ).toBeGreaterThanOrEqual(4);

    expect(
      estimateHealthScore({
        caloriesKcal: 1000,
        proteinG: 5,
        dietaryFiberG: 0,
        saltEquivalentG: 4,
        vegetablesG: 0,
      }),
    ).toBeLessThanOrEqual(2);
  });
});
