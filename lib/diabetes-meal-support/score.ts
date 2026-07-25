import {
  hasNonStarchyVegetables,
  isStapleHeavyDish,
  isSweetDessertOrSugaryDrink,
  resolveRecipeMealNutrition,
  recipeHasUsableNutrition,
} from "@/lib/diabetes-meal-support/recipe-nutrition";
import type { DiabetesMealSupportSettings } from "@/types/diabetes-meal-support";
import type { SelectionReason } from "@/types/weekly-meal-plan";
import type { Recipe, RecipeCourse } from "@/types/recipe";

export type DiabetesScoreContext = {
  settings: DiabetesMealSupportSettings;
  /** 同じ日に既に選ばれたコース */
  dayCoursesSoFar: RecipeCourse[];
  /** 前日のレシピ（連続判定） */
  previousDayRecipes: Recipe[];
  /** 候補レシピ単体の1食糖質として評価するか（主菜など） */
  evaluateAsMealCarbAnchor: boolean;
};

export type DiabetesScoreDelta = {
  scoreDelta: number;
  reasons: SelectionReason[];
  nutritionMissing: boolean;
};

/**
 * 糖尿病配慮モードがONのときだけ加点・減点する。
 * null 栄養は推測せず「栄養情報不足」として扱う。
 * 固定の医学的閾値は使わず、ユーザー設定の糖質目標のみ範囲判定に使う。
 */
export function scoreDiabetesMealSupport(
  recipe: Recipe,
  ctx: DiabetesScoreContext,
): DiabetesScoreDelta {
  const settings = ctx.settings;
  if (!settings.diabetesMealSupportEnabled) {
    return { scoreDelta: 0, reasons: [], nutritionMissing: false };
  }

  let scoreDelta = 0;
  const reasons: SelectionReason[] = [];
  const nutrition = resolveRecipeMealNutrition(recipe);
  const missing = !recipeHasUsableNutrition(recipe);

  if (missing) {
    reasons.push({ detail: "栄養情報不足（推測採点なし）" });
    return { scoreDelta: -5, reasons, nutritionMissing: true };
  }

  // 1食糖質目標（ユーザー設定がある場合のみ）
  if (
    ctx.evaluateAsMealCarbAnchor &&
    nutrition.carbohydratesG != null &&
    (settings.targetCarbsPerMealMin != null ||
      settings.targetCarbsPerMealMax != null)
  ) {
    const carbs = nutrition.carbohydratesG;
    const min = settings.targetCarbsPerMealMin;
    const max = settings.targetCarbsPerMealMax;
    const inRange =
      (min == null || carbs >= min) && (max == null || carbs <= max);
    if (inRange) {
      scoreDelta += 20;
      reasons.push({ detail: "1食の糖質が目標範囲内" });
    } else if (max != null && carbs > max) {
      scoreDelta -= 25;
      reasons.push({ detail: "1食の糖質が目標上限を超過" });
    } else if (min != null && carbs < min) {
      scoreDelta -= 8;
      reasons.push({ detail: "1食の糖質が目標下限を下回る" });
    }
  } else if (
    ctx.evaluateAsMealCarbAnchor &&
    nutrition.carbohydratesG == null &&
    (settings.targetCarbsPerMealMin != null ||
      settings.targetCarbsPerMealMax != null)
  ) {
    reasons.push({ detail: "栄養情報不足（糖質を判定できない）" });
    scoreDelta -= 5;
  }

  if (settings.prioritizeFiber) {
    if (nutrition.dietaryFiberG == null) {
      reasons.push({ detail: "栄養情報不足（食物繊維）" });
    } else if (nutrition.dietaryFiberG > 0) {
      scoreDelta += Math.min(15, nutrition.dietaryFiberG * 2);
      reasons.push({ detail: "食物繊維が多い料理を優先" });
    }
  }

  if (settings.prioritizeNonStarchyVegetables) {
    if (hasNonStarchyVegetables(recipe)) {
      scoreDelta += 12;
      reasons.push({ detail: "非でんぷん野菜を含む" });
    }
  }

  // 主食・主菜・野菜の組み合わせ
  const courses = new Set([...ctx.dayCoursesSoFar, recipe.course]);
  const hasMain = courses.has("主菜");
  const hasSideOrVeg =
    courses.has("副菜") || hasNonStarchyVegetables(recipe);
  const hasStaple = courses.has("主食") || isStapleHeavyDish(recipe);
  if (hasMain && hasSideOrVeg && (hasStaple || courses.has("汁物"))) {
    scoreDelta += 10;
    reasons.push({ detail: "主菜と野菜（副菜）の組み合わせ" });
  }

  // 麺・丼・パン中心の連続
  if (isStapleHeavyDish(recipe)) {
    const prevHeavy = ctx.previousDayRecipes.some(isStapleHeavyDish);
    if (prevHeavy) {
      scoreDelta -= 18;
      reasons.push({ detail: "麺・丼・パン中心の献立が連続" });
    }
  }

  // 甘いデザート・砂糖入り飲料の連続
  if (isSweetDessertOrSugaryDrink(recipe)) {
    const prevSweet = ctx.previousDayRecipes.some(isSweetDessertOrSugaryDrink);
    if (prevSweet) {
      scoreDelta -= 20;
      reasons.push({ detail: "甘いデザート／飲料が連続" });
    } else {
      scoreDelta -= 6;
      reasons.push({ detail: "甘いデザート／飲料を含む" });
    }
  }

  // 塩分：固定閾値なし。値が分かる場合に低い方を相対的に優先
  if (settings.limitSodium) {
    const salt = nutrition.saltEquivalentG;
    if (salt == null && nutrition.sodiumMg == null) {
      reasons.push({ detail: "栄養情報不足（塩分）" });
    } else {
      const saltG =
        salt ??
        (nutrition.sodiumMg != null ? nutrition.sodiumMg / 1000 * 2.54 : null);
      if (saltG != null) {
        // 相対的な抑えめ評価（医学的カットオフではない）
        scoreDelta -= Math.min(12, Math.round(saltG * 3));
        reasons.push({ detail: "塩分を抑えめに評価" });
      }
    }
  }

  if (settings.limitSaturatedFat) {
    if (nutrition.saturatedFatG == null) {
      reasons.push({ detail: "栄養情報不足（飽和脂肪）" });
    } else {
      scoreDelta -= Math.min(12, Math.round(nutrition.saturatedFatG));
      reasons.push({ detail: "飽和脂肪を抑えめに評価" });
    }
  }

  return { scoreDelta, reasons, nutritionMissing: false };
}
