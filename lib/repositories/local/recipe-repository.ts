import {
  createRecipe,
  deleteRecipe,
  getRecipeById,
  loadRecipes,
  removeSampleRecipes,
  replaceRecipes,
  resetSampleRecipes,
  updateRecipe,
} from "@/lib/recipes";
import type { RecipeRepository } from "@/lib/repositories/types";
import type { Recipe } from "@/types/recipe";

export function createLocalRecipeRepository(): RecipeRepository {
  return {
    async list() {
      return loadRecipes();
    },
    async getById(id) {
      return getRecipeById(id);
    },
    async create(input, options) {
      const created = createRecipe(input);
      if (!options?.isSample && !options?.id) {
        return created;
      }

      const recipes = loadRecipes().filter((item) => item.id !== created.id);
      const recipe: Recipe = {
        ...created,
        id: options.id ?? created.id,
        isSample: options.isSample === true,
      };
      replaceRecipes([recipe, ...recipes]);
      return recipe;
    },
    async update(id, input) {
      const updated = updateRecipe(id, input);
      if (!updated) {
        throw new Error("レシピが見つかりません");
      }
      return updated;
    },
    async delete(id) {
      return deleteRecipe(id);
    },
    async removeSamples() {
      return removeSampleRecipes();
    },
    async importRecipes(recipes) {
      const current = loadRecipes();
      const byId = new Set(current.map((item) => item.id));
      const bySampleName = new Set(
        current.filter((item) => item.isSample).map((item) => item.name),
      );
      let imported = 0;
      let skipped = 0;
      const next = [...current];

      for (const recipe of recipes) {
        if (byId.has(recipe.id)) {
          skipped += 1;
          continue;
        }
        if (recipe.isSample && bySampleName.has(recipe.name)) {
          skipped += 1;
          continue;
        }
        next.unshift(recipe);
        byId.add(recipe.id);
        if (recipe.isSample) {
          bySampleName.add(recipe.name);
        }
        imported += 1;
      }

      replaceRecipes(next);
      return { imported, skipped };
    },
  };
}

export async function resetLocalSampleRecipes(): Promise<number> {
  return resetSampleRecipes();
}
