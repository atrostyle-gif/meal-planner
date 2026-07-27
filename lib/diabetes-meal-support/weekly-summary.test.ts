import { describe, expect, it } from "vitest";
import { aggregateImprovementSuggestions } from "@/lib/diabetes-meal-support/weekly-summary";

describe("aggregateImprovementSuggestions", () => {
  it("同種の提案を日数でまとめる", () => {
    const result = aggregateImprovementSuggestions([
      {
        id: "1",
        date: "2026-07-20",
        title: "野菜の副菜を追加",
        detail: "a",
        autoApply: false,
      },
      {
        id: "2",
        date: "2026-07-21",
        title: "野菜の副菜を追加",
        detail: "b",
        autoApply: false,
      },
      {
        id: "3",
        date: "2026-07-22",
        title: "魚料理を増やす",
        detail: "c",
        autoApply: false,
      },
    ]);

    const veg = result.find((item) => item.key === "veg");
    expect(veg?.countLabel).toBe("あと2日");
    const fish = result.find((item) => item.key === "fish");
    expect(fish?.countLabel).toBe("あと1日");
  });
});
