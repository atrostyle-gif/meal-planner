import { describe, expect, it } from "vitest";
import { recipeDraftToRecipeInput } from "@/lib/recipe-import/draft-to-recipe";
import { parseIso8601DurationToMinutes } from "@/lib/recipe-import/duration";
import { findDuplicateCandidates } from "@/lib/recipe-import/duplicate";
import { jsonLdRecipeToDraft } from "@/lib/recipe-import/json-ld";
import { parseIngredientLine } from "@/lib/recipe-import/parse-ingredient";
import { MockRecipeImportProvider } from "@/lib/recipe-import/provider";
import { SafeFetchError, assertSafeUrl } from "@/lib/recipe-import/safe-fetch";
import type { Recipe } from "@/types/recipe";

describe("レシピ取り込みユーティリティ", () => {
  it("ISO 8601 の時間を分へ変換する", () => {
    expect(parseIso8601DurationToMinutes("PT30M")).toBe(30);
    expect(parseIso8601DurationToMinutes("PT1H20M")).toBe(80);
  });

  it("材料の数量と数量なし表記を解析する", () => {
    expect(parseIngredientLine("豚肉 300g").quantity).toBe(300);
    expect(parseIngredientLine("砂糖 1/2カップ").quantity).toBe(0.5);
    expect(parseIngredientLine("塩 少々").quantity).toBeNull();
    expect(parseIngredientLine("こしょう 適量").quantity).toBeNull();
  });

  it("HowToStep と HowToSection をレシピ下書きへ変換する", () => {
    const draft = jsonLdRecipeToDraft(
      {
        "@type": ["Thing", "Recipe"],
        name: "テスト料理",
        recipeIngredient: ["豚肉 300g"],
        recipeInstructions: {
          "@type": "HowToSection",
          itemListElement: [{ "@type": "HowToStep", text: "焼く" }],
        },
      },
      "https://example.com/recipe",
    );
    expect(draft.ingredients[0]?.quantity).toBe(300);
    expect(draft.steps[0]?.text).toBe("焼く");
  });

  it("ローカルURLを拒否する", async () => {
    await expect(assertSafeUrl("http://localhost/test")).rejects.toBeInstanceOf(SafeFetchError);
    await expect(assertSafeUrl("http://127.0.0.1/test")).rejects.toBeInstanceOf(SafeFetchError);
    await expect(assertSafeUrl("file:///tmp/test")).rejects.toBeInstanceOf(SafeFetchError);
  });

  it("下書きを既存のフォーム入力に変換する", () => {
    const input = recipeDraftToRecipeInput({
      title: "テスト料理",
      ingredients: [{ rawText: "豚肉 300g", name: "豚肉", quantity: 300, unit: "g" }],
      steps: [{ order: 1, text: "焼く" }],
      importMethod: "url",
    });
    expect(input.name).toBe("テスト料理");
    expect(input.ingredients[0]?.quantity).toBe(300);
    expect(input.importMethod).toBe("url");
  });

  it("完成料理写真では材料を推測しない", async () => {
    const draft = await new MockRecipeImportProvider().importFromImage([
      { order: 0, mimeType: "image/jpeg", base64: "", photoKindHint: "finished_dish" },
    ]);
    expect(draft.ingredients).toEqual([]);
    expect(draft.steps).toEqual([]);
  });

  it("同じ出典URLを重複候補にする", () => {
    const recipe = {
      id: "recipe-1",
      name: "既存料理",
      ingredients: [],
      steps: [],
      category: "その他",
      course: "主菜",
      tags: [],
      servings: 4,
      cookingTimeMinutes: null,
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
      source: { type: "url", url: "https://example.com/recipe" },
      isSample: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies Recipe;
    const candidates = findDuplicateCandidates(
      { ingredients: [], steps: [], importMethod: "url", sourceUrl: "https://example.com/recipe" },
      [recipe],
    );
    expect(candidates[0]?.reasons).toContain("同じ出典URL");
  });

  it("JSON-LDなし / Recipeノードなしを区別する", async () => {
    const { diagnoseJsonLd } = await import("@/lib/recipe-import/url-import-debug");
    expect(diagnoseJsonLd("<html><body>no ld</body></html>").failureReason).toBe(
      "no_json_ld",
    );
    expect(
      diagnoseJsonLd(
        `<html><script type="application/ld+json">{"@type":"WebSite","name":"x"}</script></html>`,
      ).failureReason,
    ).toBe("no_recipe_node");
    expect(
      diagnoseJsonLd(
        `<html><script type="application/ld+json">{not-json</script></html>`,
      ).failureReason,
    ).toBe("json_ld_parse_failed");
  });
});
