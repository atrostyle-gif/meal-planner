import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractOpenGraph, loadCleanDom } from "@/lib/recipe-import/html/dom";
import { extractByHtmlRules } from "@/lib/recipe-import/html/rules";
import { parseIngredientLine } from "@/lib/recipe-import/parse-ingredient";
import { runUrlImportPipeline } from "@/lib/recipe-import/pipeline";
import { MockRecipeUrlImportProvider } from "@/lib/recipe-import/url-provider";
import type { AIRecipeExtractionResult } from "@/lib/recipe-import/ai-schema";

function fixture(name: string): string {
  return readFileSync(
    path.join(process.cwd(), "lib/recipe-import/fixtures", name),
    "utf8",
  );
}

function providerForBoniq(): MockRecipeUrlImportProvider {
  const raw: AIRecipeExtractionResult = {
    documentType: "recipe_page",
    title: "鶏むね肉のやわらか低温調理",
    description: null,
    servings: 4,
    servingsText: "4人分",
    prepTimeMinutes: null,
    cookTimeMinutes: null,
    totalTimeMinutes: null,
    ingredients: [
      {
        groupName: "BONIQする材料",
        rawText: "豚ばら肉500g",
        name: "豚ばら肉",
        alternativeNames: [],
        quantity: 500,
        quantityText: "500",
        unit: "g",
        note: null,
        confidence: "high",
      },
      {
        groupName: "BONIQ後、袋に入れる調味料",
        rawText: "塩",
        name: "塩",
        alternativeNames: [],
        quantity: null,
        quantityText: null,
        unit: null,
        note: null,
        confidence: "medium",
      },
    ],
    steps: [
      {
        order: 1,
        sectionName: null,
        text: "豚肉に塩を振る。",
        temperatureCelsius: null,
        durationMinutes: null,
        confidence: "high",
      },
      {
        order: 2,
        sectionName: null,
        text: "袋に調味料と入れて低温調理する。",
        temperatureCelsius: null,
        durationMinutes: null,
        confidence: "high",
      },
    ],
    cuisine: "japanese",
    mealRole: "main",
    stapleType: "none",
    mealStyle: "standalone",
    cookingMethods: [],
    flavorProfiles: [],
    tags: [],
    sourceTitle: null,
    sourceAuthor: null,
    sourceUrl: "https://example.com",
    warnings: [],
  };
  return new MockRecipeUrlImportProvider(raw);
}

describe("HTML解析品質改善", () => {
  it("人数をservingsへ変換できる", async () => {
    const result = await runUrlImportPipeline(
      fixture("boniq-like-no-recipe-jsonld.html"),
      "https://example.com/servings",
      { provider: providerForBoniq(), skipCache: true },
    );
    expect(result.draft?.servings).toBe(4);
    expect(
      result.draft?.ingredients.every(
        (i) => !/人分|人前/.test(i.name) && !/人分|人前/.test(i.rawText),
      ),
    ).toBe(true);
  });

  it("材料グループを保持できる", () => {
    const $ = loadCleanDom(fixture("boniq-like-no-recipe-jsonld.html"));
    const extracted = extractByHtmlRules($, "https://example.com", extractOpenGraph($));
    const groups = new Set(
      extracted.draft.ingredients.map((i) => i.groupName).filter(Boolean),
    );
    expect(groups.has("BONIQする材料")).toBe(true);
    expect(groups.has("BONIQ後、袋に入れる調味料")).toBe(true);
    expect(
      extracted.draft.ingredients.some((i) => i.name.includes("BONIQする材料")),
    ).toBe(false);
  });

  it("材料のgroupNameを保持できる", () => {
    const $ = loadCleanDom(fixture("boniq-like-no-recipe-jsonld.html"));
    const extracted = extractByHtmlRules($, "https://example.com", extractOpenGraph($));
    const salt = extracted.draft.ingredients.find((i) => i.name === "塩");
    expect(salt?.groupName).toBe("BONIQ後、袋に入れる調味料");
    const pork = extracted.draft.ingredients.find((i) => i.name.includes("豚ばら"));
    expect(pork?.groupName).toBe("BONIQする材料");
  });

  it("関連記事を除外できる", () => {
    const $ = loadCleanDom(fixture("steps-with-related.html"));
    expect($.text()).not.toContain("これは手順ではない関連タイトル");
  });

  it("おすすめレシピを手順へ入れない", async () => {
    const result = await runUrlImportPipeline(
      fixture("boniq-like-no-recipe-jsonld.html"),
      "https://example.com/no-reco",
      { provider: providerForBoniq(), skipCache: true },
    );
    expect(
      result.draft?.steps.every(
        (s) => !/おすすめ|人気レシピ|関連|別の人気/.test(s.text),
      ),
    ).toBe(true);
  });

  it("広告を除外できる", () => {
    const $ = loadCleanDom(fixture("ad-noise.html"));
    const extracted = extractByHtmlRules($, "https://example.com", extractOpenGraph($));
    expect($(".ad").length).toBe(0);
    expect(
      extracted.draft.steps.every((s) => !/広告|Amazon|シェア/.test(s.text)),
    ).toBe(true);
  });

  it("手順抽出が途中で終わらない", () => {
    const $ = loadCleanDom(fixture("steps-with-related.html"));
    const extracted = extractByHtmlRules($, "https://example.com", extractOpenGraph($));
    expect(extracted.draft.steps.length).toBeGreaterThanOrEqual(3);
    expect(extracted.draft.steps.map((s) => s.text).join("")).toContain("完成");
  });

  it("関連記事開始で終了する", () => {
    const $ = loadCleanDom(`<!DOCTYPE html><html><body>
      <h1>テスト</h1>
      <h2>作り方</h2>
      <ol><li>切る</li><li>焼く</li></ol>
      <h2>関連記事</h2>
      <p>関連の記事タイトルXYZ</p>
      <p>さらに関連</p>
    </body></html>`);
    const extracted = extractByHtmlRules($, "https://example.com", extractOpenGraph($));
    expect(extracted.draft.steps.every((s) => !/関連/.test(s.text))).toBe(true);
    expect(extracted.draft.steps.length).toBeGreaterThanOrEqual(1);
  });

  it("材料の別名と分量を分解できる", () => {
    const parsed = parseIngredientLine("サニーレタス（または、サンチュ）20枚");
    expect(parsed.name).toBe("サニーレタス");
    expect(parsed.alias).toBe("サンチュ");
    expect(parsed.quantity).toBe(20);
    expect(parsed.unit).toBe("枚");
  });

  it("既存JSON-LD解析は壊さない", async () => {
    const result = await runUrlImportPipeline(
      fixture("jsonld-recipe-priority.html"),
      "https://example.com/jsonld",
      { skipCache: true },
    );
    expect(result.diagnostics.successfulMethod).toBe("json_ld");
    expect(result.draft?.title).toBe("JSON-LDのカレー");
    expect(result.draft?.ingredients).toHaveLength(2);
    expect(result.draft?.steps).toHaveLength(2);
  });
});
