/**
 * YouTubeレシピ判定ヘルパー
 */
import type { Recipe } from "@/types/recipe";
import type { RecipeDraft, RecipeSource } from "@/types/recipe-import";

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

/** モバイルでも開ける標準の視聴URL */
export function getYoutubeWatchUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  return trimmed || null;
}
