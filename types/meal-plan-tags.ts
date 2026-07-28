/**
 * 献立作成タグ（今週の献立を作る・おすすめ候補の共通）。
 */
export const MEAL_PLAN_TAG_DEFS = [
  { id: "weight_loss", label: "減量" },
  { id: "high_protein", label: "高たんぱく" },
  { id: "more_veg", label: "野菜多め" },
  { id: "more_fish", label: "魚多め" },
  { id: "more_meat", label: "肉多め" },
  { id: "budget", label: "節約" },
  { id: "quick", label: "時短" },
  { id: "makeahead", label: "作り置き" },
  { id: "freezer", label: "冷凍活用" },
  { id: "kid_friendly", label: "子ども向け" },
  { id: "diabetes", label: "糖尿病配慮" },
  { id: "low_salt", label: "塩分控えめ" },
  { id: "entertaining", label: "おもてなし" },
  { id: "more_pasta", label: "パスタ多め" },
  { id: "washoku", label: "和食中心" },
  { id: "yoshoku", label: "洋食中心" },
  { id: "chinese", label: "中華多め" },
  { id: "korean", label: "韓国料理" },
] as const;

export type MealPlanTagId = (typeof MEAL_PLAN_TAG_DEFS)[number]["id"];

export function isMealPlanTagId(value: string): value is MealPlanTagId {
  return MEAL_PLAN_TAG_DEFS.some((tag) => tag.id === value);
}
