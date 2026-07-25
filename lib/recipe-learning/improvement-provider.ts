import type { CookingFeedback, RecipeVariant } from "@/types/recipe-learning";
import type { Recipe } from "@/types/recipe";

export type RecipeImprovementSuggestion = {
  summary: string;
  proposedChanges: string[];
  confidence: "low" | "medium" | "high";
};

/**
 * 将来、改善履歴から我が家版レシピ案を生成する Provider。
 * v1 では OpenAI を呼ばない。
 */
export type RecipeImprovementProvider = {
  suggestVariant(input: {
    parent: Recipe;
    feedbacks: CookingFeedback[];
    existingVariants: RecipeVariant[];
  }): Promise<RecipeImprovementSuggestion>;
};

export class MockRecipeImprovementProvider implements RecipeImprovementProvider {
  async suggestVariant(input: {
    parent: Recipe;
    feedbacks: CookingFeedback[];
    existingVariants: RecipeVariant[];
  }): Promise<RecipeImprovementSuggestion> {
    const tags = [
      ...new Set(input.feedbacks.flatMap((f) => f.improvementTags)),
    ];
    const proposedChanges =
      tags.length > 0
        ? tags.slice(0, 8).map((tag) => `タグ反映: ${tag}`)
        : ["味付けを家庭の好みに寄せる", "分量を家族人数に合わせる"];
    return {
      summary: `${input.parent.name} の我が家版案（モック）`,
      proposedChanges,
      confidence: tags.length >= 3 ? "high" : "medium",
    };
  }
}

export class NoOpRecipeImprovementProvider implements RecipeImprovementProvider {
  async suggestVariant(): Promise<RecipeImprovementSuggestion> {
    return {
      summary: "",
      proposedChanges: [],
      confidence: "low",
    };
  }
}

export function createDefaultRecipeImprovementProvider(): RecipeImprovementProvider {
  return new MockRecipeImprovementProvider();
}
