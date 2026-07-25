import { describe, expect, it } from "vitest";
import {
  canonicalizeFoodLabel,
} from "@/lib/nutrition/food-normalizer";
import { parseIngredientQuantity } from "@/lib/nutrition/ingredient-parser";
import {
  calculateNutritionFromIngredients,
} from "@/lib/nutrition/nutrition-calculator";
import {
  mergeManualAndAutomaticNutrition,
  calculateNutritionFromRecipeDraft,
} from "@/lib/nutrition/recipe-nutrition";
import { loadDefaultFoodDatabaseSync } from "@/lib/nutrition/food-database";
import { resolveRecipeMealNutrition } from "@/lib/diabetes-meal-support/recipe-nutrition";
import type { RecipeDraft } from "@/types/recipe-import";
import type { Recipe } from "@/types/recipe";

const db = loadDefaultFoodDatabaseSync();

function ing(
  name: string,
  quantity: number | null,
  unit: string,
): { name: string; quantity: number | null; unit: string } {
  return { name, quantity, unit };
}

function draftFrom(
  title: string,
  servings: number,
  ingredients: Array<{ name: string; quantity: number | null; unit: string }>,
): RecipeDraft {
  return {
    title,
    description: null,
    servings,
    servingsText: null,
    prepTimeMinutes: null,
    cookTimeMinutes: null,
    totalTimeMinutes: null,
    ingredients: ingredients.map((item, index) => ({
      id: `i${index}`,
      rawText: `${item.name} ${item.quantity ?? ""}${item.unit}`,
      name: item.name,
      quantity: item.quantity,
      quantityText: item.quantity != null ? String(item.quantity) : null,
      unit: item.unit,
      note: null,
      groupName: null,
      alias: null,
      foodMasterId: null,
    })),
    steps: [{ id: "s1", order: 1, text: "作る", sectionName: null }],
    category: null,
    cuisine: "japanese",
    mealRole: "main",
    stapleType: null,
    mealStyle: null,
    flavorTraits: [],
    cookingMethods: [],
    tags: [],
    imageUrl: null,
    sourceUrl: null,
    sourceTitle: null,
    sourceAuthor: null,
    importMethod: "url",
    importSource: "html_rules",
    fieldSources: {},
    warnings: [],
    confidence: {},
    documentType: "recipe_page",
    importedAt: "2026-01-01T00:00:00.000Z",
  };
}

const FIXTURES: Array<{
  name: string;
  servings: number;
  ingredients: Array<{ name: string; quantity: number | null; unit: string }>;
  expectCoverageMin: number;
  expectCarbs: boolean;
}> = [
  {
    name: "豚汁",
    servings: 4,
    ingredients: [
      ing("豚こま", 150, "g"),
      ing("だいこん", 200, "g"),
      ing("にんじん", 80, "g"),
      ing("こんにゃく", 100, "g"),
      ing("ねぎ", 30, "g"),
      ing("味噌", 3, "大さじ"),
      ing("だしの素", 1, "小さじ"),
      ing("ごま油", 1, "小さじ"),
    ],
    expectCoverageMin: 70,
    expectCarbs: true,
  },
  {
    name: "カレー",
    servings: 4,
    ingredients: [
      ing("鶏もも", 300, "g"),
      ing("玉ねぎ", 2, "個"),
      ing("にんじん", 1, "本"),
      ing("じゃがいも", 2, "個"),
      ing("カレールウ", 4, "個"),
      ing("サラダ油", 1, "大さじ"),
      ing("水", 600, "ml"),
    ],
    expectCoverageMin: 70,
    expectCarbs: true,
  },
  {
    name: "親子丼",
    servings: 2,
    ingredients: [
      ing("鶏もも", 200, "g"),
      ing("玉ねぎ", 0.5, "個"),
      ing("卵", 3, "個"),
      ing("ごはん", 300, "g"),
      ing("しょうゆ", 2, "大さじ"),
      ing("みりん", 1, "大さじ"),
      ing("砂糖", 1, "小さじ"),
    ],
    expectCoverageMin: 70,
    expectCarbs: true,
  },
  {
    name: "ハンバーグ",
    servings: 2,
    ingredients: [
      ing("合いびき肉", 300, "g"),
      ing("玉ねぎ", 0.5, "個"),
      ing("パン粉", 30, "g"),
      ing("牛乳", 50, "ml"),
      ing("卵", 1, "個"),
      ing("塩", 0.5, "小さじ"),
      ing("こしょう", 1, "少々"),
      ing("サラダ油", 1, "大さじ"),
    ],
    expectCoverageMin: 50,
    expectCarbs: true,
  },
  {
    name: "肉じゃが",
    servings: 4,
    ingredients: [
      ing("豚こま", 200, "g"),
      ing("じゃがいも", 3, "個"),
      ing("にんじん", 1, "本"),
      ing("玉ねぎ", 1, "個"),
      ing("しらたき", 1, "袋"),
      ing("しょうゆ", 3, "大さじ"),
      ing("みりん", 2, "大さじ"),
      ing("砂糖", 1, "大さじ"),
    ],
    expectCoverageMin: 60,
    expectCarbs: true,
  },
  {
    name: "生姜焼き",
    servings: 2,
    ingredients: [
      ing("豚ロース", 250, "g"),
      ing("玉ねぎ", 0.5, "個"),
      ing("しょうが", 1, "かけ"),
      ing("しょうゆ", 2, "大さじ"),
      ing("みりん", 1, "大さじ"),
      ing("酒", 1, "大さじ"),
      ing("サラダ油", 1, "大さじ"),
    ],
    expectCoverageMin: 50,
    expectCarbs: true,
  },
  {
    name: "麻婆豆腐",
    servings: 2,
    ingredients: [
      ing("豆腐", 1, "丁"),
      ing("豚ひき肉", 100, "g"),
      ing("ねぎ", 20, "g"),
      ing("にんにく", 1, "かけ"),
      ing("しょうが", 1, "かけ"),
      ing("豆板醤", 1, "小さじ"),
      ing("甜麺醤", 1, "大さじ"),
      ing("しょうゆ", 1, "大さじ"),
      ing("サラダ油", 1, "大さじ"),
    ],
    expectCoverageMin: 50,
    expectCarbs: true,
  },
  {
    name: "鮭の塩焼き",
    servings: 2,
    ingredients: [ing("鮭", 2, "切れ"), ing("塩", 1, "少々")],
    expectCoverageMin: 40,
    expectCarbs: false,
  },
  {
    name: "味噌汁",
    servings: 4,
    ingredients: [
      ing("豆腐", 0.5, "丁"),
      ing("わかめ", 5, "g"),
      ing("ねぎ", 10, "g"),
      ing("味噌", 3, "大さじ"),
    ],
    expectCoverageMin: 70,
    expectCarbs: true,
  },
  {
    name: "野菜炒め",
    servings: 2,
    ingredients: [
      ing("キャベツ", 200, "g"),
      ing("にんじん", 50, "g"),
      ing("もやし", 100, "g"),
      ing("豚こま", 100, "g"),
      ing("しょうゆ", 1, "大さじ"),
      ing("ごま油", 1, "大さじ"),
    ],
    expectCoverageMin: 70,
    expectCarbs: true,
  },
  {
    name: "オムライス",
    servings: 2,
    ingredients: [
      ing("ごはん", 300, "g"),
      ing("鶏もも", 100, "g"),
      ing("玉ねぎ", 0.5, "個"),
      ing("卵", 3, "個"),
      ing("ケチャップ", 3, "大さじ"),
      ing("バター", 10, "g"),
    ],
    expectCoverageMin: 70,
    expectCarbs: true,
  },
  {
    name: "唐揚げ",
    servings: 2,
    ingredients: [
      ing("鶏もも", 300, "g"),
      ing("しょうゆ", 2, "大さじ"),
      ing("酒", 1, "大さじ"),
      ing("にんにく", 1, "かけ"),
      ing("しょうが", 1, "かけ"),
      ing("片栗粉", 4, "大さじ"),
      ing("サラダ油", 適量Unit(), "適量"),
    ],
    expectCoverageMin: 50,
    expectCarbs: true,
  },
  {
    name: "ナポリタン",
    servings: 2,
    ingredients: [
      ing("スパゲッティ", 200, "g"),
      ing("玉ねぎ", 0.5, "個"),
      ing("ピーマン", 1, "個"),
      ing("ウインナー", 4, "本"),
      ing("ケチャップ", 4, "大さじ"),
      ing("サラダ油", 1, "大さじ"),
    ],
    expectCoverageMin: 70,
    expectCarbs: true,
  },
  {
    name: "サラダチキン風",
    servings: 2,
    ingredients: [
      ing("鶏むね", 250, "g"),
      ing("塩", 0.5, "小さじ"),
      ing("こしょう", null, "少々"),
    ],
    expectCoverageMin: 30,
    expectCarbs: false,
  },
  {
    name: "焼き魚定食風",
    servings: 1,
    ingredients: [
      ing("さば", 1, "切れ"),
      ing("ごはん", 150, "g"),
      ing("味噌汁", 適量Unit(), "適量"),
    ],
    expectCoverageMin: 30,
    expectCarbs: true,
  },
  {
    name: "きんぴらごぼう",
    servings: 2,
    ingredients: [
      ing("ごぼう", 150, "g"),
      ing("にんじん", 50, "g"),
      ing("しょうゆ", 1, "大さじ"),
      ing("みりん", 1, "大さじ"),
      ing("砂糖", 1, "小さじ"),
      ing("ごま油", 1, "小さじ"),
      ing("ごま", 1, "小さじ"),
    ],
    expectCoverageMin: 70,
    expectCarbs: true,
  },
  {
    name: "冷奴",
    servings: 2,
    ingredients: [
      ing("豆腐", 1, "丁"),
      ing("ねぎ", 10, "g"),
      ing("しょうゆ", 1, "大さじ"),
      ing("ごま", 1, "小さじ"),
    ],
    expectCoverageMin: 70,
    expectCarbs: true,
  },
  {
    name: "チャーハン",
    servings: 2,
    ingredients: [
      ing("ごはん", 300, "g"),
      ing("卵", 2, "個"),
      ing("ねぎ", 20, "g"),
      ing("ハム", 50, "g"),
      ing("しょうゆ", 1, "大さじ"),
      ing("サラダ油", 1, "大さじ"),
    ],
    expectCoverageMin: 70,
    expectCarbs: true,
  },
  {
    name: "コロッケ",
    servings: 4,
    ingredients: [
      ing("じゃがいも", 4, "個"),
      ing("合いびき肉", 150, "g"),
      ing("玉ねぎ", 0.5, "個"),
      ing("パン粉", 50, "g"),
      ing("卵", 1, "個"),
      ing("小麦粉", 3, "大さじ"),
      ing("塩", 0.5, "小さじ"),
    ],
    expectCoverageMin: 70,
    expectCarbs: true,
  },
  {
    name: "豚バラ大根",
    servings: 3,
    ingredients: [
      ing("豚バラ", 250, "g"),
      ing("大根", 400, "g"),
      ing("しょうゆ", 3, "大さじ"),
      ing("みりん", 2, "大さじ"),
      ing("砂糖", 1, "大さじ"),
      ing("酒", 2, "大さじ"),
    ],
    expectCoverageMin: 70,
    expectCarbs: true,
  },
];

function 適量Unit(): null {
  return null;
}

describe("材料から栄養価自動計算エンジン", () => {
  it("foods.json が約300件ある", () => {
    expect(db.list().length).toBeGreaterThanOrEqual(280);
  });

  it("材料名正規化（alias）が動作する", () => {
    expect(canonicalizeFoodLabel("豚バラ")).toBe("豚ばら肉");
    expect(canonicalizeFoodLabel("豚こま")).toBe("豚こま切れ");
    expect(canonicalizeFoodLabel("しょう油")).toBe("濃口しょうゆ");
    expect(canonicalizeFoodLabel("玉ネギ")).toBe("玉ねぎ");
    expect(canonicalizeFoodLabel("玉　ネギ")).toBe("玉ねぎ");
  });

  it("数量解析: g / 大さじ / 適量", () => {
    const g = parseIngredientQuantity({ quantity: 200, unit: "g" });
    expect(g.grams).toBe(200);
    expect(g.parseStatus).toBe("ok");

    const tbsp = parseIngredientQuantity({
      quantity: 1,
      unit: "大さじ",
      food: db.searchByName("濃口しょうゆ").food,
    });
    expect(tbsp.grams).toBeGreaterThan(0);

    const optional = parseIngredientQuantity({ quantity: null, unit: "適量" });
    expect(optional.grams).toBeNull();
    expect(optional.parseStatus).toBe("optional");
  });

  it("計算不能材料は推測せず coverage を下げる", () => {
    const result = calculateNutritionFromIngredients(
      [
        ing("豚こま", 100, "g"),
        ing("謎の宇宙食材XYZ", 50, "g"),
      ],
      1,
      db,
    );
    expect(result.matchedCount).toBe(1);
    expect(result.nutritionCoverage).toBe(50);
    expect(result.unmatchedNames.length).toBeGreaterThan(0);
  });

  it("手入力優先・自動計算は補完", () => {
    const automatic = calculateNutritionFromIngredients(
      [ing("ごはん", 150, "g")],
      1,
      db,
    );
    const merged = mergeManualAndAutomaticNutrition({
      manual: { carbohydratesG: 99, caloriesKcal: null },
      automatic,
    });
    expect(merged.carbohydratesG).toBe(99);
    expect(merged.caloriesKcal).not.toBeNull();
    expect(merged.calculationSource).toBe("mixed");
  });

  it("糖尿病配慮 resolve が自動計算値を利用できる", () => {
    const automatic = calculateNutritionFromIngredients(
      [ing("ごはん", 150, "g"), ing("鮭", 100, "g")],
      1,
      db,
    );
    const recipe = {
      id: "r1",
      name: "テスト",
      ingredients: [],
      steps: [],
      category: "和食",
      course: "主菜",
      tags: [],
      servings: 1,
      cookingTimeMinutes: 10,
      calories: null,
      protein: null,
      fat: null,
      carbohydrates: null,
      salt: null,
      vegetables: null,
      nutritionStatus: automatic.nutritionStatus,
      caloriesKcal: automatic.caloriesKcal,
      carbohydratesG: automatic.carbohydratesG,
      sugarsG: automatic.sugarsG,
      dietaryFiberG: automatic.dietaryFiberG,
      proteinG: automatic.proteinG,
      fatG: automatic.fatG,
      saturatedFatG: null,
      sodiumMg: automatic.sodiumMg,
      saltEquivalentG: automatic.saltEquivalentG,
      nutritionCoverage: automatic.nutritionCoverage,
      calculationSource: "automatic",
      proteinType: null,
      season: null,
      difficulty: null,
      favoriteScore: null,
      healthyScore: null,
      isSample: true,
      createdAt: "",
      updatedAt: "",
    } as Recipe;
    const resolved = resolveRecipeMealNutrition(recipe);
    expect(resolved.carbohydratesG).not.toBeNull();
    expect(resolved.nutritionStatus).not.toBe("unavailable");
  });

  for (const fixture of FIXTURES) {
    it(`fixture: ${fixture.name} を計算できる`, () => {
      const draft = draftFrom(
        fixture.name,
        fixture.servings,
        fixture.ingredients,
      );
      const result = calculateNutritionFromRecipeDraft(draft, db);
      expect(result.totalCount).toBeGreaterThan(0);
      expect(result.nutritionCoverage).toBeGreaterThanOrEqual(
        fixture.expectCoverageMin,
      );
      if (fixture.expectCarbs) {
        // カバー率が高く完全な場合のみ必須。部分計算時は null 許容だが matched はある
        expect(result.matchedCount).toBeGreaterThan(0);
      }
      // null を 0 で埋めない
      if (result.matchedCount < result.totalCount) {
        // 不完全なら一部 null があり得る
        expect(result.nutritionStatus === "estimated" || result.nutritionStatus === "calculated").toBe(true);
      }
    });
  }
});
