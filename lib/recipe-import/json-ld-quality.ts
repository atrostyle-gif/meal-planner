/**
 * JSON-LD Recipe の品質判定（存在するだけでは十分としない）
 */
import { htmlToRecipeDraft } from "@/lib/recipe-import/json-ld";
import type { RecipeDraft } from "@/types/recipe-import";

export type JsonLdQuality = {
  hasRecipeNode: boolean;
  draft: RecipeDraft | null;
  sufficient: boolean;
  reasons: string[];
  missing: string[];
  ingredientCount: number;
  stepCount: number;
};

function looksLikeNoiseTitle(title: string): boolean {
  return /関連|おすすめ|ランキング|広告|人気レシピ一覧/.test(title);
}

/**
 * title あり・材料2+・手順1+ かつ広告系タイトルでない場合に十分とみなす
 */
export function assessJsonLdQuality(html: string, sourceUrl: string): JsonLdQuality {
  const result = htmlToRecipeDraft(html, sourceUrl);
  const draft = result.draft;
  if (!draft) {
    return {
      hasRecipeNode: false,
      draft: null,
      sufficient: false,
      reasons: [result.warnings[0] ?? "Recipe JSON-LD なし"],
      missing: ["recipe_node"],
      ingredientCount: 0,
      stepCount: 0,
    };
  }

  const ingredients = draft.ingredients ?? [];
  const steps = draft.steps ?? [];
  const missing: string[] = [];
  if (!draft.title?.trim()) missing.push("title");
  if (ingredients.length < 1) missing.push("ingredients");
  if (steps.length < 1) missing.push("steps");

  const sufficient =
    Boolean(draft.title?.trim()) &&
    ingredients.length >= 2 &&
    steps.length >= 1 &&
    !looksLikeNoiseTitle(draft.title ?? "");

  const reasons: string[] = [];
  if (sufficient) {
    reasons.push("title・材料2件以上・手順1件以上を満たす");
  } else {
    if (!draft.title?.trim()) reasons.push("タイトル不足");
    if (ingredients.length < 2) reasons.push(`材料が不足（${ingredients.length}件）`);
    if (steps.length < 1) reasons.push("手順が不足");
    if (looksLikeNoiseTitle(draft.title ?? "")) reasons.push("タイトルが広告・関連系");
  }

  return {
    hasRecipeNode: true,
    draft: {
      ...draft,
      importSource: "json_ld",
      fieldSources: {
        title: "json_ld",
        ingredients: ingredients.length ? "json_ld" : undefined,
        steps: steps.length ? "json_ld" : undefined,
        servings: draft.servings != null ? "json_ld" : undefined,
        imageUrl: draft.imageUrl ? "json_ld" : undefined,
        times:
          draft.totalTimeMinutes != null || draft.cookTimeMinutes != null
            ? "json_ld"
            : undefined,
      },
    },
    sufficient,
    reasons,
    missing,
    ingredientCount: ingredients.length,
    stepCount: steps.length,
  };
}

export function shouldRunAiForJsonLd(quality: JsonLdQuality): boolean {
  return !quality.sufficient;
}
