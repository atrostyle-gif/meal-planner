import { describe, expect, it } from "vitest";
import { getWeekDates } from "@/lib/date";
import { generateAggregatedIngredientsFromMealPlan } from "@/lib/shopping/generate-shopping-list";
import { classifyShoppingCategory } from "@/lib/shopping/classify-category";
import {
  generateWeeklyMealPlan,
  isFishRecipe,
} from "@/lib/weekly-auto-plan";
import type { DayMeal, MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import { WEEKLY_AUTO_COURSES } from "@/types/weekly-meal-plan";
import { MockWeeklyPlanAiProvider } from "@/lib/weekly-auto-plan/ai-provider";

function recipeStub(
  partial: Partial<Recipe> & Pick<Recipe, "id" | "name" | "course">,
): Recipe {
  return {
    ingredients: [
      {
        id: "i1",
        name: "玉ねぎ",
        quantity: 1,
        unit: "個",
        note: "",
        ingredientType: "normal",
      },
    ],
    steps: [{ id: "s1", order: 1, text: "切る" }],
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

function emptyDays(weekStart: string): DayMeal[] {
  return getWeekDates(weekStart).map((date) => ({
    date,
    locked: false,
    items: [],
  }));
}

function buildRichRecipes(): Recipe[] {
  const mains: Recipe[] = [
    recipeStub({
      id: "m1",
      name: "鶏の照り焼き",
      course: "主菜",
      proteinType: "鶏",
      category: "和食",
      cookingTimeMinutes: 25,
      favoriteScore: 5,
      ingredients: [
        {
          id: "a",
          name: "鶏もも肉",
          quantity: 300,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
        {
          id: "b",
          name: "しょうゆ",
          quantity: 2,
          unit: "大さじ",
          note: "",
          ingredientType: "pantrySeasoning",
        },
      ],
    }),
    recipeStub({
      id: "m2",
      name: "鮭のムニエル",
      course: "主菜",
      proteinType: "魚",
      category: "洋食",
      cookingTimeMinutes: 20,
      ingredients: [
        {
          id: "a",
          name: "鮭",
          quantity: 2,
          unit: "切れ",
          note: "",
          ingredientType: "normal",
        },
      ],
    }),
    recipeStub({
      id: "m3",
      name: "豚の生姜焼き",
      course: "主菜",
      proteinType: "豚",
      category: "和食",
      cookingTimeMinutes: 20,
      ingredients: [
        {
          id: "a",
          name: "豚ロース",
          quantity: 250,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
      ],
    }),
    recipeStub({
      id: "m4",
      name: "ハンバーグ",
      course: "主菜",
      proteinType: "牛",
      category: "洋食",
      cookingTimeMinutes: 40,
      ingredients: [
        {
          id: "a",
          name: "合いびき肉",
          quantity: 300,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
      ],
    }),
    recipeStub({
      id: "m5",
      name: "麻婆豆腐",
      course: "主菜",
      proteinType: "豚",
      category: "中華",
      cookingTimeMinutes: 25,
      ingredients: [
        {
          id: "a",
          name: "ひき肉",
          quantity: 150,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
        {
          id: "b",
          name: "豆腐",
          quantity: 1,
          unit: "丁",
          note: "",
          ingredientType: "normal",
        },
      ],
    }),
    recipeStub({
      id: "m6",
      name: "鯖の味噌煮",
      course: "主菜",
      proteinType: "魚",
      category: "和食",
      cookingTimeMinutes: 30,
      ingredients: [
        {
          id: "a",
          name: "さば",
          quantity: 2,
          unit: "切れ",
          note: "",
          ingredientType: "normal",
        },
      ],
    }),
    recipeStub({
      id: "m7",
      name: "カレー",
      course: "主菜",
      proteinType: "鶏",
      category: "カレー",
      cookingTimeMinutes: 50,
      tags: ["作り置き"],
      ingredients: [
        {
          id: "a",
          name: "鶏肉",
          quantity: 300,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
        {
          id: "b",
          name: "にんじん",
          quantity: 1,
          unit: "本",
          note: "",
          ingredientType: "normal",
        },
      ],
    }),
  ];

  const sides: Recipe[] = Array.from({ length: 8 }, (_, i) =>
    recipeStub({
      id: `s${i + 1}`,
      name: `副菜${i + 1}`,
      course: "副菜",
      category: i % 2 === 0 ? "和食" : "サラダ",
      cookingTimeMinutes: 10 + i,
      proteinType: "なし",
      ingredients: [
        {
          id: "v",
          name: i % 2 === 0 ? "キャベツ" : "きゅうり",
          quantity: 0.5,
          unit: "個",
          note: "",
          ingredientType: "normal",
        },
      ],
    }),
  );

  const soups: Recipe[] = Array.from({ length: 8 }, (_, i) =>
    recipeStub({
      id: `u${i + 1}`,
      name: `汁物${i + 1}`,
      course: "汁物",
      category: "スープ",
      cookingTimeMinutes: 15,
      proteinType: "なし",
      ingredients: [
        {
          id: "w",
          name: "わかめ",
          quantity: 5,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
        {
          id: "t",
          name: "豆腐",
          quantity: 0.5,
          unit: "丁",
          note: "",
          ingredientType: "normal",
        },
      ],
    }),
  );

  return [...mains, ...sides, ...soups];
}

describe("週間献立自動編成", () => {
  const weekStart = "2026-07-20"; // 月曜

  it("7日分（主菜・副菜・汁物）を生成できる", () => {
    const recipes = buildRichRecipes();
    const result = generateWeeklyMealPlan({
      weekStart,
      days: emptyDays(weekStart),
      recipes,
    });

    expect(result.days).toHaveLength(7);
    for (const day of result.days) {
      for (const course of WEEKLY_AUTO_COURSES) {
        const slot = day.items.find((item) => item.course === course);
        expect(slot?.recipeId).toBeTruthy();
      }
    }
    expect(result.filledCount).toBe(21);
    expect(result.emptySlotCount).toBe(0);
  });

  it("同じレシピが重複しない", () => {
    const recipes = buildRichRecipes();
    const result = generateWeeklyMealPlan({
      weekStart,
      days: emptyDays(weekStart),
      recipes,
    });
    const ids = result.days.flatMap((day) =>
      day.items.map((item) => item.recipeId).filter(Boolean),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("主食材が連続しにくい", () => {
    const recipes = buildRichRecipes();
    const result = generateWeeklyMealPlan({
      weekStart,
      days: emptyDays(weekStart),
      recipes,
    });
    const mainProteins: Array<string | null> = [];
    for (const day of result.days) {
      const main = day.items.find((item) => item.course === "主菜");
      const recipe = recipes.find((r) => r.id === main?.recipeId);
      mainProteins.push(recipe?.proteinType ?? null);
    }
    let consecutive = 0;
    for (let i = 1; i < mainProteins.length; i += 1) {
      if (
        mainProteins[i] &&
        mainProteins[i] === mainProteins[i - 1] &&
        mainProteins[i] !== "なし"
      ) {
        consecutive += 1;
      }
    }
    // 完全ゼロは保証しないが、大半は分散する
    expect(consecutive).toBeLessThanOrEqual(2);
  });

  it("魚料理が適度に含まれる", () => {
    const recipes = buildRichRecipes();
    const result = generateWeeklyMealPlan({
      weekStart,
      days: emptyDays(weekStart),
      recipes,
    });
    const fishCount = result.days.filter((day) => {
      const main = day.items.find((item) => item.course === "主菜");
      const recipe = recipes.find((r) => r.id === main?.recipeId);
      return recipe ? isFishRecipe(recipe) : false;
    }).length;
    expect(fishCount).toBeGreaterThanOrEqual(1);
  });

  it("ロックした枠が再生成で変わらない", () => {
    const recipes = buildRichRecipes();
    const first = generateWeeklyMealPlan({
      weekStart,
      days: emptyDays(weekStart),
      recipes,
    });
    const lockedDay = first.days[0];
    const lockedMain = lockedDay.items.find((item) => item.course === "主菜");
    expect(lockedMain).toBeTruthy();
    const lockedId = lockedMain!.recipeId;

    const daysWithLock = first.days.map((day, index) =>
      index === 0
        ? {
            ...day,
            items: day.items.map((item) =>
              item.course === "主菜" ? { ...item, slotLocked: true } : item,
            ),
          }
        : { ...day, items: [] },
    );

    const second = generateWeeklyMealPlan({
      weekStart,
      days: daysWithLock,
      recipes,
      scope: { type: "week" },
    });
    const still = second.days[0].items.find((item) => item.course === "主菜");
    expect(still?.recipeId).toBe(lockedId);
    expect(still?.slotLocked).toBe(true);
  });

  it("特定曜日だけ再生成できる", () => {
    const recipes = buildRichRecipes();
    const first = generateWeeklyMealPlan({
      weekStart,
      days: emptyDays(weekStart),
      recipes,
    });
    const targetDate = first.days[2].date;
    const beforeOther = first.days[0].items.map((item) => item.recipeId);

    const second = generateWeeklyMealPlan({
      weekStart,
      days: first.days,
      recipes,
      scope: { type: "day", date: targetDate },
    });

    expect(second.days[0].items.map((item) => item.recipeId)).toEqual(
      beforeOther,
    );
    expect(second.days[2].items.length).toBeGreaterThan(0);
  });

  it("候補不足でもクラッシュしない", () => {
    const recipes = [
      recipeStub({ id: "only1", name: "唯一の主菜", course: "主菜" }),
    ];
    const result = generateWeeklyMealPlan({
      weekStart,
      days: emptyDays(weekStart),
      recipes,
    });
    expect(result.days).toHaveLength(7);
    expect(result.emptySlotCount).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("材料を集計でき、同じ材料が合算される", () => {
    const recipes = buildRichRecipes();
    const generated = generateWeeklyMealPlan({
      weekStart,
      days: emptyDays(weekStart),
      recipes,
    });
    const plan: MealPlan = {
      id: "p1",
      weekStart,
      days: generated.days,
      createdAt: "",
      updatedAt: "",
    };
    const aggregated = generateAggregatedIngredientsFromMealPlan(plan, recipes);
    expect(aggregated.length).toBeGreaterThan(0);

    // 豆腐は汁物で複数日使われやすい → 合算される
    const tofu = aggregated.find((g) => g.ingredientName.includes("豆腐"));
    if (tofu) {
      const gQty = tofu.quantities.find((q) => q.unit === "丁" && q.quantity != null);
      if (gQty?.quantity != null) {
        expect(gQty.quantity).toBeGreaterThan(0.5);
      }
      expect(tofu.sources.length).toBeGreaterThan(0);
    }

    expect(classifyShoppingCategory("鶏もも肉")).toBe("肉");
    expect(classifyShoppingCategory("鮭")).toBe("魚");
    expect(classifyShoppingCategory("キャベツ")).toBe("野菜");
    expect(classifyShoppingCategory("しょうゆ", "pantrySeasoning")).toBe("調味料");
  });

  it("AI Provider モックは実APIを呼ばない", async () => {
    const provider = new MockWeeklyPlanAiProvider({
      notes: ["test"],
      preferredRecipeIds: ["m1"],
    });
    const suggestion = await provider.suggestImprovements({
      plan: {
        id: "x",
        weekStart,
        days: emptyDays(weekStart),
        createdAt: "",
        updatedAt: "",
      },
      recipes: buildRichRecipes(),
    });
    expect(suggestion.notes).toEqual(["test"]);
  });
});
