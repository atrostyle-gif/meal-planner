import type { ProteinType } from "@/types/recipe-nutrition";
import type { Recipe } from "@/types/recipe";
import type { InventoryItem } from "@/types/inventory";

/** 主食材キー（連続禁止の判定用） */
export function getMainIngredientKey(recipe: Recipe): string {
  if (recipe.proteinType && recipe.proteinType !== "なし") {
    return `protein:${recipe.proteinType}`;
  }
  const first = recipe.ingredients.find((item) => item.name.trim() !== "");
  if (first) {
    return `ing:${first.name.trim().toLowerCase()}`;
  }
  return `recipe:${recipe.id}`;
}

export function isFishRecipe(recipe: Recipe): boolean {
  if (recipe.proteinType === "魚") return true;
  return recipe.ingredients.some((item) =>
    /魚|鮭|サーモン|まぐろ|マグロ|さば|サバ|あじ|アジ|いわし|カツオ|かつお|たら|タラ|えび|エビ|いか|イカ|たこ|タコ|ホタテ|ほたて/.test(
      item.name,
    ),
  );
}

export function isMeatRecipe(recipe: Recipe): boolean {
  const meat: ProteinType[] = ["牛", "豚", "鶏"];
  if (recipe.proteinType && meat.includes(recipe.proteinType)) return true;
  return recipe.ingredients.some((item) =>
    /牛肉|豚肉|鶏肉|豚ばら|牛もも|鶏むね|ひき肉|挽き肉/.test(item.name),
  );
}

/** ジャンル（連続禁止用） */
export function getGenreKey(recipe: Recipe): string {
  return recipe.category || "その他";
}

/** 主な食材名（表示用・最大3） */
export function getMainIngredientNames(recipe: Recipe, limit = 3): string[] {
  const names: string[] = [];
  if (recipe.proteinType && recipe.proteinType !== "なし") {
    names.push(recipe.proteinType);
  }
  for (const ingredient of recipe.ingredients) {
    const name = ingredient.name.trim();
    if (!name) continue;
    if (names.some((n) => n === name || n.includes(name) || name.includes(n))) {
      continue;
    }
    names.push(name);
    if (names.length >= limit) break;
  }
  return names.slice(0, limit);
}

/** 在庫名と材料名のゆるい一致 */
export function recipeUsesInventory(
  recipe: Recipe,
  inventory: InventoryItem[],
): { matched: string[] } {
  if (inventory.length === 0) return { matched: [] };
  const matched: string[] = [];
  for (const inv of inventory) {
    const invName = inv.name.trim().toLowerCase();
    if (!invName) continue;
    const hit = recipe.ingredients.some((ingredient) => {
      const name = ingredient.name.trim().toLowerCase();
      return name.includes(invName) || invName.includes(name);
    });
    if (hit) matched.push(inv.name);
  }
  return { matched };
}

export function isWeekdayIndex(dayIndex: number): boolean {
  // 0=月 … 4=金, 5=土, 6=日
  return dayIndex >= 0 && dayIndex <= 4;
}

export const WEEKDAY_TIME_LIMIT_MINUTES = 30;
