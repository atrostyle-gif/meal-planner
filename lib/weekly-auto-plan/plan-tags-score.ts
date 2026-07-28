import type { Recipe } from "@/types/recipe";
import type { SelectionReason } from "@/types/weekly-meal-plan";
import type { MealPlanTagId } from "@/types/meal-plan-tags";
import { isFishRecipe, isMeatRecipe } from "@/lib/weekly-auto-plan/recipe-features";

function hasTag(recipe: Recipe, ...needles: string[]): boolean {
  const tags = recipe.tags.map((t) => t.toLowerCase());
  const name = recipe.name.toLowerCase();
  return needles.some(
    (n) => tags.some((t) => t.includes(n)) || name.includes(n),
  );
}

/**
 * 献立作成タグによる加点・減点。
 * 複数タグ時も極端にならないようタグあたりの影響を抑える。
 */
export function scoreMealPlanTags(
  recipe: Recipe,
  planTags: readonly MealPlanTagId[],
): { delta: number; reasons: SelectionReason[] } {
  if (planTags.length === 0) {
    return { delta: 0, reasons: [] };
  }

  let delta = 0;
  const reasons: SelectionReason[] = [];
  const weight = Math.max(0.55, 1 - (planTags.length - 1) * 0.08);

  for (const tag of planTags) {
    let tip = 0;
    let detail: string | null = null;

    switch (tag) {
      case "weight_loss":
        if (hasTag(recipe, "ダイエット", "ヘルシー", "サラダ", "蒸し")) {
          tip += 10;
          detail = "減量向けの料理です";
        }
        if (hasTag(recipe, "揚げ", "フライ", "天ぷら", "唐揚")) {
          tip -= 12;
          detail = detail ?? "揚げ物は減量タグでは控えめに";
        }
        break;
      case "high_protein":
        if (
          isMeatRecipe(recipe) ||
          isFishRecipe(recipe) ||
          hasTag(recipe, "豆腐", "卵", "高たんぱく", "プロテイン")
        ) {
          tip += 10;
          detail = "たんぱく質を摂りやすい料理です";
        }
        break;
      case "more_veg":
        if (
          recipe.course === "副菜" ||
          hasTag(recipe, "野菜", "サラダ", "ナムル", "炒め")
        ) {
          tip += 10;
          detail = "野菜を摂りやすい候補です";
        }
        break;
      case "more_fish":
        if (isFishRecipe(recipe)) {
          tip += 14;
          detail = "魚多めの希望に合います";
        } else if (isMeatRecipe(recipe)) {
          tip -= 4;
        }
        break;
      case "more_meat":
        if (isMeatRecipe(recipe)) {
          tip += 12;
          detail = "肉多めの希望に合います";
        }
        break;
      case "budget":
        if (hasTag(recipe, "節約", "コスパ", "簡単")) {
          tip += 10;
          detail = "節約向きの料理です";
        }
        if ((recipe.favoriteScore ?? 0) >= 4) {
          // 高評価でも予算タグでは中立寄
        }
        break;
      case "quick":
        if (
          recipe.cookingTimeMinutes != null &&
          recipe.cookingTimeMinutes <= 20
        ) {
          tip += 14;
          detail = `調理時間${recipe.cookingTimeMinutes}分で時短です`;
        } else if (
          recipe.cookingTimeMinutes != null &&
          recipe.cookingTimeMinutes > 40
        ) {
          tip -= 10;
          detail = "時短希望にはやや長めです";
        }
        break;
      case "makeahead":
        if (hasTag(recipe, "作り置き", "常備菜", "保存")) {
          tip += 12;
          detail = "作り置き向きです";
        }
        break;
      case "freezer":
        if (hasTag(recipe, "冷凍", "作り置き")) {
          tip += 12;
          detail = "冷凍活用できます";
        }
        break;
      case "kid_friendly":
        if (hasTag(recipe, "子ども", "子供", "キッズ", "甘辛", "ハンバーグ")) {
          tip += 12;
          detail = "子ども向けの候補です";
        }
        if (hasTag(recipe, "辛い", "刺激", "大人")) {
          tip -= 8;
        }
        break;
      case "diabetes":
        // 詳細は diabetes スコア側。ここでは軽い誘導のみ
        if (hasTag(recipe, "減塩", "野菜", "魚", "蒸し")) {
          tip += 6;
          detail = "血糖に配慮しやすい候補です";
        }
        if (hasTag(recipe, "揚げ", "甘い", "デザート")) {
          tip -= 6;
        }
        break;
      case "low_salt":
        if (hasTag(recipe, "減塩", "薄味")) {
          tip += 12;
          detail = "塩分控えめ向きです";
        }
        if (hasTag(recipe, "塩辛", "漬物", "醤油多め")) {
          tip -= 8;
        }
        break;
      case "entertaining":
        if (hasTag(recipe, "おもてなし", "パーティー", "ごちそう")) {
          tip += 12;
          detail = "おもてなし向きです";
        }
        break;
      case "more_pasta":
        if (hasTag(recipe, "パスタ", "スパゲティ", "うどん") || recipe.course === "主食") {
          if (hasTag(recipe, "パスタ", "スパゲティ")) {
            tip += 14;
            detail = "パスタ多めの希望に合います";
          }
        }
        break;
      case "washoku":
        if (recipe.category === "和食" || hasTag(recipe, "和食", "味噌", "煮物")) {
          tip += 10;
          detail = "和食中心の希望に合います";
        }
        break;
      case "yoshoku":
        if (recipe.category === "洋食" || hasTag(recipe, "洋食", "パスタ", "サラダ")) {
          tip += 10;
          detail = "洋食中心の希望に合います";
        }
        break;
      case "chinese":
        if (recipe.category === "中華" || hasTag(recipe, "中華", "炒め")) {
          tip += 10;
          detail = "中華多めの希望に合います";
        }
        break;
      case "korean":
        if (
          recipe.category === "韓国" ||
          hasTag(recipe, "韓国", "キムチ", "チゲ", "ビビンバ")
        ) {
          tip += 12;
          detail = "韓国料理の希望に合います";
        }
        break;
      default:
        break;
    }

    if (tip !== 0) {
      delta += tip * weight;
      if (detail) {
        reasons.push({ detail });
      }
    }
  }

  // 合計の振れ幅を抑える
  delta = Math.max(-28, Math.min(36, Math.round(delta)));
  return { delta, reasons: reasons.slice(0, 3) };
}
