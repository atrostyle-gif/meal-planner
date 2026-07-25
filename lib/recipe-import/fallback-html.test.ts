import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeHtmlWithAi, parseAiJson } from "@/lib/recipe-import/ai-html";
import { extractOpenGraph, loadCleanDom } from "@/lib/recipe-import/html/dom";
import { extractByHtmlRules, extractMicrodata } from "@/lib/recipe-import/html/rules";
import { runUrlImportPipeline } from "@/lib/recipe-import/pipeline";
import { MockRecipeUrlImportProvider } from "@/lib/recipe-import/url-provider";
import type { AIRecipeExtractionResult } from "@/lib/recipe-import/ai-schema";

function fixture(name: string): string {
  return readFileSync(
    path.join(process.cwd(), "lib/recipe-import/fixtures", name),
    "utf8",
  );
}

function mockAi(partial?: Partial<AIRecipeExtractionResult>): MockRecipeUrlImportProvider {
  const base: AIRecipeExtractionResult = {
    documentType: "recipe_page",
    title: "鶏むね肉のやわらか低温調理",
    description: null,
    servings: 4,
    servingsText: "4人分",
    prepTimeMinutes: null,
    cookTimeMinutes: null,
    totalTimeMinutes: 40,
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
    ...partial,
  };
  return new MockRecipeUrlImportProvider(base);
}

describe("URL取り込みフォールバック解析", () => {
  it("Recipe JSON-LDがある場合は従来通りJSON-LDを優先する", async () => {
    const result = await runUrlImportPipeline(
      fixture("jsonld-recipe-priority.html"),
      "https://example.com/jsonld",
      { skipCache: true },
    );
    expect(result.code).toBe("ok");
    expect(result.diagnostics.successfulMethod).toBe("json_ld");
    expect(result.draft?.title).toBe("JSON-LDのカレー");
    expect(result.draft?.ingredients.some((i) => i.name.includes("999"))).toBe(
      false,
    );
  });

  it("JSON-LD RecipeがなくてもHTMLからタイトルを取得できる", async () => {
    const result = await runUrlImportPipeline(
      fixture("boniq-like-no-recipe-jsonld.html"),
      "https://example.com/boniq-like",
      { provider: mockAi(), skipCache: true },
    );
    expect(result.code).toBe("ok");
    expect(result.draft?.title).toContain("鶏むね肉");
  });

  it("JSON-LDがないだけでは即失敗しない", async () => {
    const result = await runUrlImportPipeline(
      fixture("boniq-like-no-recipe-jsonld.html"),
      "https://example.com/boniq-like",
      { provider: mockAi(), skipCache: true },
    );
    expect(result.diagnostics.attemptedMethods.some((m) => m.method === "json_ld")).toBe(
      true,
    );
    expect(result.code).toBe("ok");
    expect(result.diagnostics.successfulMethod).not.toBeNull();
  });

  it("材料見出し以下のliを抽出できる", () => {
    const $ = loadCleanDom(fixture("boniq-like-no-recipe-jsonld.html"));
    const og = extractOpenGraph($);
    const extracted = extractByHtmlRules($, "https://example.com", og);
    expect(extracted.draft.ingredients.length).toBeGreaterThanOrEqual(3);
    expect(
      extracted.draft.ingredients.some((i) => i.name.includes("豚ばら")),
    ).toBe(true);
  });

  it("材料グループを保持できる", () => {
    const $ = loadCleanDom(fixture("boniq-like-no-recipe-jsonld.html"));
    const og = extractOpenGraph($);
    const extracted = extractByHtmlRules($, "https://example.com", og);
    const grouped = extracted.draft.ingredients.find(
      (i) => i.groupName === "BONIQ後、袋に入れる調味料",
    );
    expect(grouped).toBeTruthy();
  });

  it("材料テーブルを抽出できる", () => {
    const $ = loadCleanDom(fixture("table-and-steps.html"));
    const og = extractOpenGraph($);
    const extracted = extractByHtmlRules($, "https://example.com", og);
    expect(
      extracted.draft.ingredients.some((i) => i.name.includes("キャベツ")),
    ).toBe(true);
    expect(
      extracted.draft.ingredients.some((i) => i.name.includes("にんじん")),
    ).toBe(true);
  });

  it("作り方のol/liを抽出できる", () => {
    const $ = loadCleanDom(fixture("boniq-like-no-recipe-jsonld.html"));
    const og = extractOpenGraph($);
    const extracted = extractByHtmlRules($, "https://example.com", og);
    expect(extracted.draft.steps.length).toBeGreaterThanOrEqual(2);
  });

  it("STEP表記のdivを順番通り抽出できる", () => {
    const $ = loadCleanDom(fixture("table-and-steps.html"));
    const og = extractOpenGraph($);
    const extracted = extractByHtmlRules($, "https://example.com", og);
    expect(extracted.draft.steps[0]?.text).toContain("野菜を切る");
    expect(extracted.draft.steps[1]?.text).toContain("炒める");
  });

  it("OpenGraphでタイトルと画像を補完できる", async () => {
    const result = await runUrlImportPipeline(
      fixture("og-complement.html"),
      "https://example.com/og",
      {
        provider: mockAi({
          title: null,
          ingredients: [
            {
              groupName: null,
              rawText: "豆腐 1丁",
              name: "豆腐",
              alternativeNames: [],
              quantity: 1,
              quantityText: "1",
              unit: "丁",
              note: null,
              confidence: "medium",
            },
          ],
          steps: [
            {
              order: 1,
              sectionName: null,
              text: "切る",
              temperatureCelsius: null,
              durationMinutes: null,
              confidence: "medium",
            },
          ],
        }),
        skipCache: true,
      },
    );
    expect(result.draft?.title).toBe("OGのタイトル");
    expect(result.draft?.imageUrl).toBe("https://example.com/og.png");
  });

  it("script/style/nav/footerを除外できる", () => {
    const html = `
      <html><head><style>.x{color:red}</style><script>alert(1)</script></head>
      <body>
        <nav>ナビ</nav>
        <main><h1>本文タイトル</h1><h2>材料</h2><ul><li>塩 1g</li></ul></main>
        <footer>フッタ秘密</footer>
      </body></html>`;
    const $ = loadCleanDom(html);
    expect($("nav").length).toBe(0);
    expect($("footer").length).toBe(0);
    expect($("script").length).toBe(0);
    expect($("style").length).toBe(0);
    expect($.text()).not.toContain("フッタ秘密");
    expect($.text()).not.toContain("ナビ");
  });

  it("広告文を手順に混ぜない", () => {
    const $ = loadCleanDom(fixture("ad-noise.html"));
    const og = extractOpenGraph($);
    const extracted = extractByHtmlRules($, "https://example.com", og);
    expect(
      extracted.draft.steps.every(
        (s) => !/シェア|ツイート|関連|広告|Amazon/.test(s.text),
      ),
    ).toBe(true);
  });

  it("材料のみ取得時に警告を返す", async () => {
    const result = await runUrlImportPipeline(
      fixture("ingredients-only.html"),
      "https://example.com/ing-only",
      {
        provider: mockAi({
          title: "味噌汁",
          steps: [],
          ingredients: [
            {
              groupName: null,
              rawText: "豆腐 1/2丁",
              name: "豆腐",
              alternativeNames: [],
              quantity: 0.5,
              quantityText: "1/2",
              unit: "丁",
              note: null,
              confidence: "medium",
            },
          ],
          warnings: ["材料は読み取れましたが、作り方を確認できませんでした"],
        }),
        skipCache: true,
      },
    );
    expect(result.code).toBe("ok");
    expect(result.draft?.warnings?.some((w) => w.includes("作り方を確認"))).toBe(
      true,
    );
  });

  it("手順のみ取得時に警告を返す", async () => {
    const result = await runUrlImportPipeline(
      fixture("steps-only.html"),
      "https://example.com/steps-only",
      {
        provider: mockAi({
          title: "ゆで卵",
          ingredients: [],
          steps: [
            {
              order: 1,
              sectionName: null,
              text: "卵をゆでる",
              temperatureCelsius: null,
              durationMinutes: null,
              confidence: "medium",
            },
          ],
        }),
        skipCache: true,
      },
    );
    expect(result.code).toBe("ok");
    expect(result.draft?.warnings?.some((w) => w.includes("材料の確認"))).toBe(
      true,
    );
  });

  it("AI未設定時にルールベース結果を返す", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const result = await runUrlImportPipeline(
        fixture("ingredients-only.html"),
        "https://example.com/ai-skip",
        { skipCache: true },
      );
      expect(["ok", "ai_unavailable"]).toContain(result.code);
      expect(result.diagnostics.aiSkipped).toBe(true);
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  });

  it("AIが不正JSONを返してもクラッシュしない", () => {
    expect(parseAiJson("not json")).toBeNull();
    expect(parseAiJson("{broken")).toBeNull();
    expect(parseAiJson('{"title":"ok"}')?.title).toBe("ok");
  });

  it("analyzeHtmlWithAi は不正レスポンスでも例外を投げない", async () => {
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key-invalid";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "!!!" } }] }), {
        status: 200,
      })) as typeof fetch;
    try {
      const result = await analyzeHtmlWithAi(
        fixture("ingredients-only.html"),
        "https://example.com",
        null,
      );
      expect(result.error).toBeTruthy();
      expect(result.ran).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
      else delete process.env.OPENAI_API_KEY;
    }
  });

  it("BONIQ風fixtureからレシピを抽出できる", async () => {
    const result = await runUrlImportPipeline(
      fixture("boniq-like-no-recipe-jsonld.html"),
      "https://boniq.jp/recipe/sample",
      { provider: mockAi(), skipCache: true },
    );
    expect(result.code).toBe("ok");
    expect(result.draft?.title).toBeTruthy();
    expect(result.draft?.ingredients.length).toBeGreaterThanOrEqual(1);
    expect(result.draft?.steps.length).toBeGreaterThanOrEqual(1);
  });

  it("Microdata Recipe を抽出できる", () => {
    const $ = loadCleanDom(fixture("microdata-recipe.html"));
    const draft = extractMicrodata($, "https://example.com/md");
    expect(draft?.title).toBe("Microdataカレー");
    expect(draft?.ingredients.length).toBe(2);
    expect(draft?.steps.length).toBe(1);
  });
});
