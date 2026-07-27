import { classifyShoppingCategory } from "@/lib/shopping/classify-category";
import type { FoodExpenseCategory } from "@/types/food-expense";

const HOUSEHOLD_NON_FOOD =
  /洗剤|ラップ|ティッシュ|トイレットペーパー|スポンジ|ゴミ袋|石鹸|シャンプー|歯磨き粉|日用品|キッチンペーパー|アルミホイル/;

/**
 * 商品名から食費カテゴリを推定。
 * 日用品は household_mixed（初期除外候補）。
 */
export function classifyFoodExpenseCategory(
  name: string,
): FoodExpenseCategory {
  const text = name.trim();
  if (!text) return "unclassified";

  if (HOUSEHOLD_NON_FOOD.test(text)) {
    return "household_mixed";
  }

  const shopping = classifyShoppingCategory(text);
  switch (shopping) {
    case "肉":
      return "meat";
    case "魚":
      return "seafood";
    case "野菜":
      return /りんご|バナナ|みかん|いちご|果物|フルーツ|ぶどう|梨/.test(text)
        ? "fruits"
        : "vegetables";
    case "卵／乳製品":
      return "dairy_eggs";
    case "乾物":
      return "grains_noodles";
    case "調味料":
      return "seasonings";
    default:
      break;
  }

  if (/惣菜|弁当|サラダ|揚げ物|寿司|サンド/.test(text)) return "prepared_food";
  if (/冷凍/.test(text)) return "frozen_food";
  if (/ジュース|お茶|コーヒー|水|飲料|ビール|酒/.test(text)) return "beverages";
  if (/チョコ|菓子|スナック|クッキー|ガム/.test(text)) return "snacks";
  if (/米|パン|麺|パスタ|うどん|そば/.test(text)) return "grains_noodles";
  if (/りんご|バナナ|みかん|いちご|果物|フルーツ/.test(text)) return "fruits";

  return "unclassified";
}

/** 日用品など、初期状態で食費除外にするか */
export function defaultFoodExpenseExcluded(category: FoodExpenseCategory): boolean {
  return category === "household_mixed";
}
