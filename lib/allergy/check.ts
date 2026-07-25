import { normalizeIngredientName } from "@/lib/food-master/normalize";
import type { DietaryRestriction } from "@/types/family-member-profile";
import type { Recipe } from "@/types/recipe";

export type AllergyHit = {
  allergen: string;
  ingredientName: string;
  confidence: "exact" | "partial" | "needs_review";
};

export type AllergyCheckResult = {
  blocked: boolean;
  hits: AllergyHit[];
  restrictionHits: string[];
};

/** アレルギー語 → 関連キーワード */
const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  卵: ["卵", "たまご", "玉子", "マヨネーズ", "オムレツ"],
  乳: ["牛乳", "ミルク", "バター", "チーズ", "生クリーム", "ヨーグルト"],
  小麦: ["小麦", "薄力粉", "中力粉", "強力粉", "パン", "うどん", "パスタ", "ラーメン", "餃子"],
  そば: ["そば", "蕎麦"],
  落花生: ["落花生", "ピーナッツ", "ピーナツ"],
  えび: ["えび", "エビ", "海老"],
  かに: ["かに", "カニ", "蟹"],
  くるみ: ["くるみ", "クルミ"],
  大豆: ["大豆", "豆腐", "納豆", "豆乳", "油揚げ", "醤油", "しょうゆ", "味噌"],
};

function ingredientBlob(recipe: Recipe): string {
  return [
    recipe.name,
    ...recipe.ingredients.map((item) => item.name),
    ...recipe.tags,
  ]
    .map((item) => normalizeIngredientName(item))
    .join("|");
}

export function checkRecipeAllergies(
  recipe: Recipe,
  allergies: string[],
): AllergyHit[] {
  const hits: AllergyHit[] = [];
  const blob = ingredientBlob(recipe);

  for (const allergen of allergies) {
    const key = allergen.trim();
    if (key === "") {
      continue;
    }
    const keywords = ALLERGEN_KEYWORDS[key] ?? [key];
    for (const ingredient of recipe.ingredients) {
      const nameKey = normalizeIngredientName(ingredient.name);
      for (const keyword of keywords) {
        const k = normalizeIngredientName(keyword);
        if (nameKey === k) {
          hits.push({
            allergen: key,
            ingredientName: ingredient.name,
            confidence: "exact",
          });
        } else if (nameKey.includes(k) || k.includes(nameKey)) {
          hits.push({
            allergen: key,
            ingredientName: ingredient.name,
            confidence: nameKey.length <= 1 || k.length <= 1 ? "needs_review" : "partial",
          });
        }
      }
    }
    // レシピ名にもヒット
    if (keywords.some((keyword) => blob.includes(normalizeIngredientName(keyword)))) {
      if (!hits.some((hit) => hit.allergen === key)) {
        hits.push({
          allergen: key,
          ingredientName: recipe.name,
          confidence: "needs_review",
        });
      }
    }
  }

  return hits;
}

export function checkDietaryRestrictions(
  recipe: Recipe,
  restrictions: DietaryRestriction[],
): string[] {
  const hits: string[] = [];
  const blob = ingredientBlob(recipe);
  const protein = recipe.proteinType;

  for (const restriction of restrictions) {
    if (restriction === "なし" || restriction === "その他") {
      continue;
    }
    if (restriction === "卵なし" && (protein === "卵" || blob.includes("卵") || blob.includes("たまご"))) {
      hits.push("卵なし");
    }
    if (
      restriction === "乳製品なし" &&
      (blob.includes("牛乳") || blob.includes("バター") || blob.includes("チーズ"))
    ) {
      hits.push("乳製品なし");
    }
    if (
      restriction === "魚介なし" &&
      (protein === "魚" ||
        blob.includes("魚") ||
        blob.includes("えび") ||
        blob.includes("かに") ||
        blob.includes("鮭") ||
        blob.includes("さば"))
    ) {
      hits.push("魚介なし");
    }
    if (
      restriction === "肉なし" &&
      (protein === "牛" ||
        protein === "豚" ||
        protein === "鶏" ||
        blob.includes("肉") ||
        blob.includes("豚") ||
        blob.includes("鶏") ||
        blob.includes("牛"))
    ) {
      hits.push("肉なし");
    }
    if (
      restriction === "ベジタリアン" &&
      (protein === "牛" ||
        protein === "豚" ||
        protein === "鶏" ||
        protein === "魚" ||
        blob.includes("肉") ||
        blob.includes("魚"))
    ) {
      hits.push("ベジタリアン");
    }
  }

  return hits;
}

export function evaluateRecipeHardConstraints(
  recipe: Recipe,
  allergies: string[],
  restrictions: DietaryRestriction[],
): AllergyCheckResult {
  const hits = checkRecipeAllergies(recipe, allergies);
  const restrictionHits = checkDietaryRestrictions(recipe, restrictions);
  const blocked =
    hits.some((hit) => hit.confidence === "exact" || hit.confidence === "partial") ||
    restrictionHits.length > 0;

  return { blocked, hits, restrictionHits };
}
