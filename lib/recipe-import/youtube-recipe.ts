/**
 * YouTubeレシピ判定・料理名プレフィックスヘルパー
 */
import type { Recipe } from "@/types/recipe";
import type { RecipeDraft, RecipeSource } from "@/types/recipe-import";

/** YouTube取込レシピの料理名先頭に付ける識別子 */
export const YOUTUBE_RECIPE_NAME_PREFIX = "【YouTube】";

export function isYoutubeRecipeSource(
  source: RecipeSource | null | undefined,
  importMethod?: string | null,
): boolean {
  if (importMethod === "youtube") return true;
  return source?.type === "youtube";
}

export function isYoutubeRecipe(recipe: Pick<Recipe, "importMethod" | "source">): boolean {
  return isYoutubeRecipeSource(recipe.source, recipe.importMethod);
}

export function isYoutubeDraft(draft: Pick<RecipeDraft, "importMethod">): boolean {
  return draft.importMethod === "youtube";
}

/** すでに【YouTube】が先頭にあるか */
export function hasYoutubeRecipeNamePrefix(name: string): boolean {
  return name.trimStart().startsWith(YOUTUBE_RECIPE_NAME_PREFIX);
}

/**
 * YouTubeレシピ名に【YouTube】を1回だけ付与する。
 * 二重付与を避け、空名は「無題のレシピ」にする。
 */
export function ensureYoutubeRecipeNamePrefix(name: string): string {
  let without = name.trim();
  while (without.startsWith(YOUTUBE_RECIPE_NAME_PREFIX)) {
    without = without.slice(YOUTUBE_RECIPE_NAME_PREFIX.length).trimStart();
  }
  const base = without || "無題のレシピ";
  return `${YOUTUBE_RECIPE_NAME_PREFIX}${base}`;
}

/**
 * YouTube由来ならプレフィックスを補完し、それ以外はそのまま返す。
 */
export function applyYoutubeRecipeNamePrefixIfNeeded(
  name: string,
  source: RecipeSource | null | undefined,
  importMethod?: string | null,
): string {
  if (!isYoutubeRecipeSource(source, importMethod)) {
    return name;
  }
  return ensureYoutubeRecipeNamePrefix(name);
}

/** モバイルでも開ける標準の視聴URL */
export function getYoutubeWatchUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  return trimmed || null;
}
