import { describe, expect, it, vi } from "vitest";
import { extractYoutubeVideoId } from "@/lib/recipe-import/youtube-url";
import { assessYoutubeDescriptionRichness } from "@/lib/recipe-import/youtube-provider";
import { validateAiExtraction } from "@/lib/recipe-import/validate-draft";
import {
  filterLikelyPromotionalIngredients,
} from "@/lib/recipe-import/youtube-pipeline";
import {
  ensureYoutubeRecipeNamePrefix,
  hasYoutubeRecipeNamePrefix,
  isYoutubeRecipe,
  isYoutubeRecipeSource,
  YOUTUBE_RECIPE_NAME_PREFIX,
} from "@/lib/recipe-import/youtube-recipe";
import { recipeDraftToRecipeInput } from "@/lib/recipe-import/draft-to-recipe";
import type { RecipeDraft } from "@/types/recipe-import";

describe("YouTube recipe name prefix", () => {
  it("未付与の名前に【YouTube】を付ける", () => {
    expect(ensureYoutubeRecipeNamePrefix("暗殺者のパスタ")).toBe(
      "【YouTube】暗殺者のパスタ",
    );
  });

  it("すでに付いている場合は二重に付けない", () => {
    expect(ensureYoutubeRecipeNamePrefix("【YouTube】暗殺者のパスタ")).toBe(
      "【YouTube】暗殺者のパスタ",
    );
    expect(
      ensureYoutubeRecipeNamePrefix("【YouTube】【YouTube】暗殺者のパスタ"),
    ).toBe("【YouTube】暗殺者のパスタ");
  });

  it("空名は無題のレシピにする", () => {
    expect(ensureYoutubeRecipeNamePrefix("")).toBe("【YouTube】無題のレシピ");
    expect(ensureYoutubeRecipeNamePrefix("【YouTube】")).toBe(
      "【YouTube】無題のレシピ",
    );
  });

  it("hasYoutubeRecipeNamePrefix が判定できる", () => {
    expect(hasYoutubeRecipeNamePrefix("【YouTube】テスト")).toBe(true);
    expect(hasYoutubeRecipeNamePrefix("テスト")).toBe(false);
    expect(YOUTUBE_RECIPE_NAME_PREFIX).toBe("【YouTube】");
  });
});

describe("extractYoutubeVideoId", () => {
  it("youtube.com/watch?v= から抽出する", () => {
    const result = extractYoutubeVideoId(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    }
  });

  it("youtu.be/ から抽出する", () => {
    const result = extractYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    }
  });

  it("shorts URL から抽出する", () => {
    const result = extractYoutubeVideoId(
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    }
  });

  it("不正URLを拒否する", () => {
    expect(extractYoutubeVideoId("not a url").ok).toBe(false);
    expect(extractYoutubeVideoId("https://example.com/x").ok).toBe(false);
  });
});

describe("assessYoutubeDescriptionRichness", () => {
  it("材料セクションがある説明文は sparse ではない", () => {
    const result = assessYoutubeDescriptionRichness(
      [
        "材料（2人分）",
        "キャベツ 1/2玉",
        "塩 少々",
        "作り方は動画を見てね",
        "よろしくお願いします",
      ].join("\n"),
    );
    expect(result.sparse).toBe(false);
  });

  it("短い説明文は sparse", () => {
    const result = assessYoutubeDescriptionRichness("今日の料理！");
    expect(result.sparse).toBe(true);
  });
});

describe("youtube ingredients-only validation", () => {
  it("説明欄の材料抽出結果を steps 空の youtube 下書きにする", () => {
    const validated = validateAiExtraction(
      {
        documentType: "recipe_page",
        title: "キャベツ炒め",
        description: null,
        servings: 2,
        servingsText: "2人分",
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        totalTimeMinutes: null,
        ingredients: [
          {
            groupName: "材料",
            rawText: "キャベツ 1/2玉",
            name: "キャベツ",
            alternativeNames: [],
            quantity: 0.5,
            quantityText: "1/2",
            unit: "玉",
            note: null,
            confidence: "high",
          },
        ],
        steps: [
          {
            order: 1,
            sectionName: null,
            text: "これは無視されるべき工程",
            temperatureCelsius: null,
            durationMinutes: null,
            confidence: "low",
          },
        ],
        cuisine: "japanese",
        mealRole: "side",
        stapleType: "unknown",
        mealStyle: "unknown",
        cookingMethods: [],
        flavorProfiles: [],
        tags: [],
        sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        warnings: [],
      },
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      {
        importMethod: "youtube",
        importSource: "youtube_description",
        sourceAuthor: "料理ch",
        imageUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        ingredientsOnly: true,
      },
    );

    expect(validated.ok).toBe(true);
    expect(validated.draft?.importMethod).toBe("youtube");
    expect(validated.draft?.steps).toEqual([]);
    expect(validated.draft?.ingredients).toHaveLength(1);
  });

  it("材料なしは不足として扱う", () => {
    const validated = validateAiExtraction(
      {
        documentType: "partial_recipe",
        title: "なんとなく料理",
        description: null,
        servings: null,
        servingsText: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        totalTimeMinutes: null,
        ingredients: [],
        steps: [],
        cuisine: "unknown",
        mealRole: "unknown",
        stapleType: "unknown",
        mealStyle: "unknown",
        cookingMethods: [],
        flavorProfiles: [],
        tags: [],
        sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        warnings: [],
      },
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      { importMethod: "youtube", ingredientsOnly: true },
    );
    expect(validated.ok).toBe(false);
  });
});

describe("filterLikelyPromotionalIngredients", () => {
  it("おすすめ食材一覧を材料に混入しない", () => {
    const filtered = filterLikelyPromotionalIngredients([
      {
        rawText: "キャベツ 1玉",
        name: "キャベツ",
        quantity: 1,
        unit: "玉",
        groupName: "材料",
      },
      {
        rawText: "おすすめフライパン",
        name: "おすすめフライパン",
        quantity: null,
        unit: null,
        groupName: "おすすめグッズ",
      },
      {
        rawText: "Amazon特集の塩",
        name: "Amazon特集の塩",
        quantity: null,
        unit: null,
        groupName: null,
      },
    ]);
    expect(filtered.map((item) => item.name)).toEqual(["キャベツ"]);
  });
});

describe("youtube source display helpers", () => {
  it("sourceType youtube を判定できる", () => {
    expect(isYoutubeRecipeSource({ type: "youtube" })).toBe(true);
    expect(isYoutubeRecipeSource({ type: "url" }, "youtube")).toBe(true);
    expect(isYoutubeRecipeSource({ type: "url" })).toBe(false);
    expect(
      isYoutubeRecipe({
        importMethod: "youtube",
        source: {
          type: "youtube",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      }),
    ).toBe(true);
  });
});

describe("youtube draft save without steps", () => {
  it("stepsなしでもレシピ保存用入力を作れる", () => {
    const draft: RecipeDraft = {
      title: "牛乳プリン",
      servings: 2,
      ingredients: [
        {
          rawText: "牛乳 200ml",
          name: "牛乳",
          quantity: 200,
          unit: "ml",
        },
      ],
      steps: [],
      importMethod: "youtube",
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      sourceTitle: "牛乳プリンの作り方",
      sourceAuthor: "デザートch",
      imageUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    };
    const input = recipeDraftToRecipeInput(draft);
    expect(input.steps).toEqual([]);
    expect(input.importMethod).toBe("youtube");
    expect(input.source?.type).toBe("youtube");
    expect(input.source?.url).toContain("youtube.com");
    expect(input.source?.thumbnail).toContain("ytimg");
    expect(input.source?.author).toBe("デザートch");
    expect(input.name).toBe("【YouTube】牛乳プリン");
  });

  it("手入力・URL取込には【YouTube】を付けない", () => {
    const urlDraft: RecipeDraft = {
      title: "カレー",
      servings: 2,
      ingredients: [{ rawText: "肉", name: "肉", quantity: 1, unit: "枚" }],
      steps: [{ order: 1, text: "炒める" }],
      importMethod: "url",
      sourceUrl: "https://example.com/curry",
    };
    expect(recipeDraftToRecipeInput(urlDraft).name).toBe("カレー");

    const manualDraft: RecipeDraft = {
      ...urlDraft,
      importMethod: "manual",
      sourceUrl: null,
    };
    expect(recipeDraftToRecipeInput(manualDraft).name).toBe("カレー");
  });

  it("確認画面でプレフィックスを消しても保存入力で復元する", () => {
    const draft: RecipeDraft = {
      title: "暗殺者のパスタ",
      servings: 2,
      ingredients: [{ rawText: "麺", name: "麺", quantity: 1, unit: "玉" }],
      steps: [],
      importMethod: "youtube",
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    };
    expect(recipeDraftToRecipeInput(draft).name).toBe(
      "【YouTube】暗殺者のパスタ",
    );
  });
});

describe("runYoutubeImportPipeline sparse gate", () => {
  it("極短説明は sparse_description で失敗する", async () => {
    vi.resetModules();
    vi.doMock("@/lib/recipe-import/youtube-api", () => ({
      fetchYoutubeVideoSnippet: async () => ({
        ok: true,
        snippet: {
          videoId: "dQw4w9WgXcQ",
          title: "今日の料理",
          description: "短い",
          channelTitle: "ch",
          publishedAt: null,
          thumbnailUrl: null,
          canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      }),
    }));
    const { runYoutubeImportPipeline } = await import(
      "@/lib/recipe-import/youtube-pipeline"
    );
    const result = await runYoutubeImportPipeline(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("sparse_description");
    }
    vi.doUnmock("@/lib/recipe-import/youtube-api");
  });
});
