import { classifyShoppingCategory } from "@/lib/shopping/classify-category";
import {
  SHOPPING_CATEGORIES,
  type ShoppingCategory,
} from "@/types/shopping-category";
import type { ShoppingListItem } from "@/types/shopping-list";

export function resolveItemShoppingCategory(
  item: ShoppingListItem,
): ShoppingCategory {
  return (
    item.shoppingCategory ??
    classifyShoppingCategory(item.ingredientName, item.ingredientType)
  );
}

/** カテゴリ順でグループ化（空カテゴリは省略） */
export function groupShoppingItemsByCategory(
  items: ShoppingListItem[],
): Array<{ category: ShoppingCategory; items: ShoppingListItem[] }> {
  const map = new Map<ShoppingCategory, ShoppingListItem[]>();
  for (const category of SHOPPING_CATEGORIES) {
    map.set(category, []);
  }
  for (const item of items) {
    const category = resolveItemShoppingCategory(item);
    map.get(category)?.push(item);
  }
  return SHOPPING_CATEGORIES.map((category) => ({
    category,
    items: map.get(category) ?? [],
  })).filter((group) => group.items.length > 0);
}
