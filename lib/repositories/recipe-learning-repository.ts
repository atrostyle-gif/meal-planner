import {
  addCookingHistory,
  loadCookingHistory,
  replaceCookingHistory,
} from "@/lib/cooking-history";
import {
  loadCookingFeedbacks,
  replaceCookingFeedbacks,
  saveCookingFeedback,
  getFeedbacksForRecipe,
} from "@/lib/recipe-learning/cooking-feedbacks";
import {
  loadRecipeVariants,
  replaceRecipeVariants,
  saveRecipeVariant,
  getVariantsForParent,
} from "@/lib/recipe-learning/recipe-variants";
import type { CookingHistory } from "@/types/weekly-lifestyle";
import type { CookingFeedback, RecipeVariant } from "@/types/recipe-learning";

/** 既存 cooking-history を包む Repository */
export type CookingHistoryRepository = {
  list(): Promise<CookingHistory[]>;
  add(
    entry: Parameters<typeof addCookingHistory>[0],
  ): Promise<CookingHistory>;
  replace(list: CookingHistory[]): Promise<void>;
};

export type CookingFeedbackRepository = {
  list(): Promise<CookingFeedback[]>;
  listByRecipe(recipeId: string): Promise<CookingFeedback[]>;
  save(feedback: CookingFeedback): Promise<CookingFeedback>;
  replace(list: CookingFeedback[]): Promise<void>;
};

export type RecipeVariantRepository = {
  list(): Promise<RecipeVariant[]>;
  listByParent(parentRecipeId: string): Promise<RecipeVariant[]>;
  save(variant: RecipeVariant): Promise<RecipeVariant>;
  replace(list: RecipeVariant[]): Promise<void>;
};

export function createLocalCookingHistoryRepository(): CookingHistoryRepository {
  return {
    async list() {
      return loadCookingHistory();
    },
    async add(entry) {
      return addCookingHistory(entry);
    },
    async replace(list) {
      replaceCookingHistory(list);
    },
  };
}

export function createLocalCookingFeedbackRepository(): CookingFeedbackRepository {
  return {
    async list() {
      return loadCookingFeedbacks();
    },
    async listByRecipe(recipeId) {
      return getFeedbacksForRecipe(recipeId);
    },
    async save(feedback) {
      return saveCookingFeedback(feedback);
    },
    async replace(list) {
      replaceCookingFeedbacks(list);
    },
  };
}

export function createLocalRecipeVariantRepository(): RecipeVariantRepository {
  return {
    async list() {
      return loadRecipeVariants();
    },
    async listByParent(parentRecipeId) {
      return getVariantsForParent(parentRecipeId);
    },
    async save(variant) {
      return saveRecipeVariant(variant);
    },
    async replace(list) {
      replaceRecipeVariants(list);
    },
  };
}
