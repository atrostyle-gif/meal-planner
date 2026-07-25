import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import {
  DEFAULT_INGREDIENT_TYPE,
  type IngredientType,
} from "@/types/ingredient-meta";
import type { Recipe } from "@/types/recipe";

/**
 * 同じ正規化名の食材に既設定の在庫区分があれば返す。
 * 常備区分を優先し、なければ通常食材。
 */
export function findIngredientTypeByName(
  name: string,
  recipes: Recipe[],
): IngredientType {
  const key = normalizeIngredientName(name);
  if (key === "") {
    return DEFAULT_INGREDIENT_TYPE;
  }

  let found: IngredientType | null = null;

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      if (normalizeIngredientName(ingredient.name) !== key) {
        continue;
      }
      if (ingredient.ingredientType !== "normal") {
        return ingredient.ingredientType;
      }
      found = ingredient.ingredientType;
    }
  }

  return found ?? DEFAULT_INGREDIENT_TYPE;
}
