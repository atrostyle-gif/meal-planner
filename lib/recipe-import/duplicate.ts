import type { Recipe } from "@/types/recipe";
import type { RecipeDraft } from "@/types/recipe-import";

function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/[\s　]/g, "");
}

export function findDuplicateCandidates(
  draft: RecipeDraft,
  recipes: Recipe[],
): { recipe: Recipe; reasons: string[] }[] {
  const normalizedDraftName = normalizeName(draft.title ?? "");

  return recipes
    .map((recipe) => {
      const reasons: string[] = [];
      if (
        draft.sourceUrl &&
        recipe.source?.url &&
        draft.sourceUrl === recipe.source.url
      ) {
        reasons.push("同じ出典URL");
      }
      if (
        normalizedDraftName !== "" &&
        normalizedDraftName === normalizeName(recipe.name)
      ) {
        reasons.push("同じ料理名");
      }
      return { recipe, reasons };
    })
    .filter((candidate) => candidate.reasons.length > 0);
}
