import type { FoodCategory } from "@/types/food-master";
import type { ShoppingCategory } from "@/types/shopping-category";

/** Food Master の category → 買い物カテゴリ */
export function shoppingCategoryFromFoodCategory(
  category: FoodCategory,
): ShoppingCategory {
  switch (category) {
    case "野菜":
    case "きのこ":
    case "果物":
      return "野菜";
    case "肉類":
      return "肉";
    case "魚介類":
      return "魚";
    case "卵":
    case "乳製品":
      return "卵／乳製品";
    case "調味料":
    case "油脂":
      return "調味料";
    case "穀類":
    case "豆類":
    case "海藻":
    case "加工食品":
      return "乾物";
    default:
      return "その他";
  }
}
