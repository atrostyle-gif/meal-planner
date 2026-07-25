import { getIngredientAmountText } from "@/lib/ingredient";
import type { InventoryItem } from "@/types/inventory";
import type { Recipe } from "@/types/recipe";

/** 照合用に前後空白を除去する */
export function normalizeFoodName(name: string): string {
  return name.trim();
}

/**
 * 冷蔵庫の食材名とレシピ材料名の単純一致。
 * 例: 在庫「キャベツ」と材料名「キャベツ」+分量「1/4玉」、
 * または材料名に「キャベツ」が含まれる場合も一致とみなす。
 */
export function isFoodNameMatch(
  inventoryName: string,
  ingredientName: string,
  ingredientAmount: string = "",
): boolean {
  const inventory = normalizeFoodName(inventoryName);
  const ingredient = normalizeFoodName(ingredientName);

  if (inventory === "" || ingredient === "") {
    return false;
  }

  if (inventory === ingredient) {
    return true;
  }

  // 「キャベツ 1/4玉」のような一塊の材料名にも対応
  if (ingredient.includes(inventory) || inventory.includes(ingredient)) {
    return true;
  }

  const combined = normalizeFoodName(`${ingredient} ${ingredientAmount}`);
  return combined.includes(inventory);
}

/** 優先ONの在庫一覧 */
export function getPriorityInventoryItems(
  inventory: InventoryItem[],
): InventoryItem[] {
  return inventory.filter(
    (item) => item.priority && normalizeFoodName(item.name) !== "",
  );
}

/**
 * レシピが含む優先食材の件数（スコア）。
 * 同じ優先食材は1レシピ内で1回だけ数える。
 */
export function countPriorityIngredientMatches(
  recipe: Recipe,
  priorityItems: InventoryItem[],
): number {
  if (priorityItems.length === 0) {
    return 0;
  }

  let score = 0;

  for (const item of priorityItems) {
    const matched = recipe.ingredients.some((ingredient) =>
      isFoodNameMatch(
        item.name,
        ingredient.name,
        getIngredientAmountText(ingredient),
      ),
    );
    if (matched) {
      score += 1;
    }
  }

  return score;
}
