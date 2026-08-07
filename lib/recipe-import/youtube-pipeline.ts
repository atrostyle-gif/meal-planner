/**
 * YouTube URL → Data API → 材料AI解析 → RecipeDraft（工程なし）
 */
import { fetchYoutubeVideoSnippet } from "@/lib/recipe-import/youtube-api";
import {
  assessYoutubeDescriptionRichness,
  extractRecipeFromYoutubeSnippet,
} from "@/lib/recipe-import/youtube-provider";
import { validateAiExtraction } from "@/lib/recipe-import/validate-draft";
import { ensureYoutubeRecipeNamePrefix } from "@/lib/recipe-import/youtube-recipe";
import { extractYoutubeVideoId } from "@/lib/recipe-import/youtube-url";
import type { RecipeDraft, RecipeDraftIngredient } from "@/types/recipe-import";

export type YoutubeImportErrorCode =
  | "empty"
  | "invalid_url"
  | "not_youtube"
  | "missing_video_id"
  | "missing_api_key"
  | "invalid_video_id"
  | "not_found"
  | "private_or_unavailable"
  | "api_quota"
  | "api_failed"
  | "sparse_description"
  | "ai_unavailable"
  | "ai_failed"
  | "ai_timeout"
  | "not_recipe"
  | "insufficient_recipe";

export type YoutubeImportResult =
  | {
      ok: true;
      draft: RecipeDraft;
      warnings: string[];
      message: string;
      video: {
        videoId: string;
        title: string;
        channelTitle: string;
        thumbnailUrl: string | null;
        canonicalUrl: string;
      };
    }
  | {
      ok: false;
      code: YoutubeImportErrorCode;
      error: string;
      warnings?: string[];
    };

function mapAiError(error: string | null): {
  code: YoutubeImportErrorCode;
  message: string;
} {
  if (!error || error === "ai_unavailable") {
    return {
      code: "ai_unavailable",
      message:
        "AI解析が利用できません。サーバーに OPENAI_API_KEY が設定されているか確認してください",
    };
  }
  if (error === "ai_timeout") {
    return {
      code: "ai_timeout",
      message: "AI解析がタイムアウトしました。しばらくしてから再試行してください",
    };
  }
  return {
    code: "ai_failed",
    message: "AIによる材料の読み取りに失敗しました。説明文の内容をご確認ください",
  };
}

const WATCH_VIDEO_NOTE = "工程は動画を見ながら調理します";

/** おすすめ商品・宣伝っぽい材料行を除外する */
export function filterLikelyPromotionalIngredients(
  ingredients: RecipeDraftIngredient[],
): RecipeDraftIngredient[] {
  return ingredients.filter((item) => {
    const group = item.groupName ?? "";
    const name = `${item.name} ${item.rawText}`;
    if (
      /おすすめ|紹介|商品|グッズ|アフィリエイト|PR|スポンサー|楽天|Amazon/i.test(
        group,
      )
    ) {
      return false;
    }
    if (
      /おすすめ|関連商品|アフィリエイト|楽天|Amazon|グッズ/i.test(name)
    ) {
      return false;
    }
    return true;
  });
}

/**
 * YouTube URL からレシピ下書き（材料のみ）を作成する。
 */
export async function runYoutubeImportPipeline(
  rawUrl: string,
): Promise<YoutubeImportResult> {
  const parsed = extractYoutubeVideoId(rawUrl);
  if (!parsed.ok) {
    return {
      ok: false,
      code: parsed.code,
      error: parsed.message,
    };
  }

  const api = await fetchYoutubeVideoSnippet(parsed.videoId);
  if (!api.ok) {
    return {
      ok: false,
      code: api.code,
      error: api.message,
    };
  }

  const snippet = api.snippet;
  const richness = assessYoutubeDescriptionRichness(snippet.description);
  const preWarnings = [...richness.warnings];

  if (richness.sparse && snippet.description.trim().length < 20) {
    return {
      ok: false,
      code: "sparse_description",
      error:
        "説明欄に材料情報がほとんどないため取り込めませんでした。材料が説明欄にある動画を選ぶか、手入力で登録してください",
      warnings: preWarnings,
    };
  }

  const ai = await extractRecipeFromYoutubeSnippet(snippet);
  if (ai.error || ai.raw == null) {
    const mapped = mapAiError(ai.error);
    return {
      ok: false,
      code: mapped.code,
      error: mapped.message,
      warnings: preWarnings,
    };
  }

  const validated = validateAiExtraction(ai.raw, snippet.canonicalUrl, {
    importMethod: "youtube",
    importSource: "youtube_description",
    sourceAuthor: snippet.channelTitle || null,
    imageUrl: snippet.thumbnailUrl,
    extraWarnings: preWarnings,
    ingredientsOnly: true,
  });

  if (validated.documentType === "not_recipe") {
    return {
      ok: false,
      code: "not_recipe",
      error:
        "この動画の説明欄からは材料を読み取れませんでした。「材料」の記載があるか確認してください",
      warnings: [...preWarnings, ...validated.warnings],
    };
  }

  if (!validated.ok || !validated.draft) {
    const reason =
      validated.errors[0] ??
      "料理名と材料が不足しているため取り込めませんでした";
    return {
      ok: false,
      code: "insufficient_recipe",
      error: reason,
      warnings: [...preWarnings, ...validated.warnings],
    };
  }

  const draft = validated.draft;
  draft.sourceTitle = snippet.title;
  draft.sourceAuthor = snippet.channelTitle || draft.sourceAuthor;
  draft.sourceUrl = snippet.canonicalUrl;
  draft.imageUrl = snippet.thumbnailUrl;
  draft.importMethod = "youtube";
  draft.importSource = "youtube_description";
  draft.steps = [];
  if (!draft.title) {
    draft.title = snippet.title;
  }
  // 確認画面・保存名の先頭に【YouTube】を付ける（二重付与なし）
  draft.title = ensureYoutubeRecipeNamePrefix(draft.title ?? snippet.title);

  const quantityMissing = draft.ingredients.some(
    (item) => item.quantity == null && !item.quantityText,
  );
  if (quantityMissing) {
    const note = "分量が動画説明欄に記載されていません";
    if (!(draft.warnings ?? []).includes(note)) {
      draft.warnings = [...(draft.warnings ?? []), note];
    }
  }

  draft.ingredients = filterLikelyPromotionalIngredients(draft.ingredients);

  if (!(draft.warnings ?? []).includes(WATCH_VIDEO_NOTE)) {
    draft.warnings = [...(draft.warnings ?? []), WATCH_VIDEO_NOTE];
  }

  return {
    ok: true,
    draft,
    warnings: draft.warnings ?? [],
    message: "材料を確認してください。作り方は動画を見ながら調理します",
    video: {
      videoId: snippet.videoId,
      title: snippet.title,
      channelTitle: snippet.channelTitle,
      thumbnailUrl: snippet.thumbnailUrl,
      canonicalUrl: snippet.canonicalUrl,
    },
  };
}
