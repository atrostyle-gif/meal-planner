import {
  hasNonStarchyVegetables,
  isStapleHeavyDish,
  isSweetDessertOrSugaryDrink,
  resolveRecipeMealNutrition,
  recipeHasUsableNutrition,
} from "@/lib/diabetes-meal-support/recipe-nutrition";
import { resolveEffectiveCarbTargets } from "@/lib/diabetes-meal-support/resolve-targets";
import type { DiabetesMealSupportSettings } from "@/types/diabetes-meal-support";
import type { SelectionReason } from "@/types/weekly-meal-plan";
import type { Recipe, RecipeCourse } from "@/types/recipe";

export type DiabetesScoreContext = {
  settings: DiabetesMealSupportSettings;
  /** 同じ日に既に選ばれたコース */
  dayCoursesSoFar: RecipeCourse[];
  /** 前日のレシピ（連続判定） */
  previousDayRecipes: Recipe[];
  /** 候補レシピ単体の1食アンカーとして評価するか（主菜など） */
  evaluateAsMealCarbAnchor: boolean;
};

export type DiabetesScoreDelta = {
  scoreDelta: number;
  reasons: SelectionReason[];
  nutritionMissing: boolean;
};

export type HealthScoreContext = DiabetesScoreContext;
export type HealthScoreDelta = DiabetesScoreDelta;

function mealCalorieBand(settings: DiabetesMealSupportSettings): {
  min: number | null;
  max: number | null;
} {
  const dayMin = settings.referenceCaloriesMin ?? null;
  const dayMax = settings.referenceCaloriesMax ?? null;
  if (dayMin == null && dayMax == null) {
    return { min: null, max: null };
  }
  // 1日参考エネルギーを3食目安に配分（家庭向けのざっくり目安）
  return {
    min: dayMin != null ? Math.round(dayMin / 3) : null,
    max: dayMax != null ? Math.round(dayMax / 3) : null,
  };
}

/**
 * 健康的な体重管理を支援する採点。
 *
 * 優先順位:
 * 1. 適正体重・BMI・活動量に基づくエネルギーバランス
 * 2. 栄養バランス（たんぱく質・野菜・食物繊維・塩分など）
 * 3. 糖尿病配慮（補助。極端な糖質制限ではなく過不足回避）
 *
 * モードOFF時は影響なし。null 栄養は推測しない。
 */
export function scoreHealthMealSupport(
  recipe: Recipe,
  ctx: HealthScoreContext,
): HealthScoreDelta {
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

  // ——— 1. エネルギーバランス（最優先） ———
  if (ctx.evaluateAsMealCarbAnchor) {
    const band = mealCalorieBand(settings);
    const kcal = nutrition.caloriesKcal;
    if (band.min != null || band.max != null) {
      if (kcal == null) {
        reasons.push({ detail: "栄養情報不足（エネルギーを判定できない）" });
        scoreDelta -= 4;
      } else {
        const inRange =
          (band.min == null || kcal >= band.min) &&
          (band.max == null || kcal <= band.max);
        if (inRange) {
          scoreDelta += 22;
          reasons.push({ detail: "1食のエネルギーが参考範囲内（体重管理）" });
        } else if (band.max != null && kcal > band.max) {
          scoreDelta -= 16;
          reasons.push({ detail: "1食のエネルギーが参考上限を超えやすい" });
        } else if (band.min != null && kcal < band.min) {
          scoreDelta -= 10;
          reasons.push({ detail: "1食のエネルギーが参考下限を下回りやすい" });
        }
      }
    }
  }

  // ——— 2. 栄養バランス ———
  if (nutrition.proteinG != null && nutrition.proteinG > 0) {
    scoreDelta += Math.min(12, Math.round(nutrition.proteinG / 3));
    reasons.push({ detail: "たんぱく質を含む" });
  }

  const hasVeg =
    hasNonStarchyVegetables(recipe) ||
    (nutrition.dietaryFiberG != null && nutrition.dietaryFiberG >= 3);
  if (hasVeg || settings.prioritizeNonStarchyVegetables) {
    if (hasNonStarchyVegetables(recipe)) {
      scoreDelta += settings.prioritizeNonStarchyVegetables ? 12 : 8;
      reasons.push({ detail: "野菜（非でんぷん野菜）を含む" });
    }
  }

  if (nutrition.dietaryFiberG != null && nutrition.dietaryFiberG > 0) {
    const fiberBonus = Math.min(
      settings.prioritizeFiber ? 14 : 10,
      Math.round(nutrition.dietaryFiberG * (settings.prioritizeFiber ? 2 : 1.5)),
    );
    scoreDelta += fiberBonus;
    reasons.push({ detail: "食物繊維を含む" });
  } else if (settings.prioritizeFiber) {
    reasons.push({ detail: "栄養情報不足（食物繊維）" });
  }

  // 主食・主菜・野菜の組み合わせ
  const courses = new Set([...ctx.dayCoursesSoFar, recipe.course]);
  const hasMain = courses.has("主菜");
  const hasSideOrVeg =
    courses.has("副菜") || hasNonStarchyVegetables(recipe);
  const hasStaple = courses.has("主食") || isStapleHeavyDish(recipe);
  if (hasMain && hasSideOrVeg && (hasStaple || courses.has("汁物"))) {
    scoreDelta += 12;
    reasons.push({ detail: "主菜と野菜（副菜）のバランスがよい" });
  }

  // 塩分・飽和脂肪（固定の医学閾値ではなく相対評価）
  if (settings.limitSodium) {
    const salt = nutrition.saltEquivalentG;
    if (salt == null && nutrition.sodiumMg == null) {
      reasons.push({ detail: "栄養情報不足（塩分）" });
    } else {
      const saltG =
        salt ??
        (nutrition.sodiumMg != null ? (nutrition.sodiumMg / 1000) * 2.54 : null);
      if (saltG != null) {
        scoreDelta -= Math.min(10, Math.round(saltG * 2.5));
        reasons.push({ detail: "塩分を抑えめに評価" });
      }
    }
  }

  if (settings.limitSaturatedFat) {
    if (nutrition.saturatedFatG == null) {
      reasons.push({ detail: "栄養情報不足（飽和脂肪）" });
    } else {
      scoreDelta -= Math.min(10, Math.round(nutrition.saturatedFatG));
      reasons.push({ detail: "飽和脂肪を抑えめに評価" });
    }
  }

  // ——— 3. 糖尿病配慮（補助。極端な制限ではなく過不足回避） ———
  const effective = resolveEffectiveCarbTargets(settings);
  if (
    ctx.evaluateAsMealCarbAnchor &&
    nutrition.carbohydratesG != null &&
    (effective.mealMin != null || effective.mealMax != null)
  ) {
    const carbs = nutrition.carbohydratesG;
    const min = effective.mealMin;
    const max = effective.mealMax;
    const inRange =
      (min == null || carbs >= min) && (max == null || carbs <= max);
    if (inRange) {
      scoreDelta += 8;
      reasons.push({ detail: "糖質の過不足が少ない（補助）" });
    } else if (max != null && carbs > max) {
      // 極端な減点はしない（補助評価）
      scoreDelta -= 10;
      reasons.push({ detail: "糖質が多めになりやすい（補助）" });
    } else if (min != null && carbs < min) {
      scoreDelta -= 4;
      reasons.push({ detail: "糖質が少なめになりやすい（補助）" });
    }
  } else if (
    ctx.evaluateAsMealCarbAnchor &&
    nutrition.carbohydratesG == null &&
    (effective.mealMin != null || effective.mealMax != null)
  ) {
    reasons.push({ detail: "栄養情報不足（糖質を判定できない）" });
    scoreDelta -= 3;
  }

  // 主食量の連続（適正な主食分散の補助）
  if (isStapleHeavyDish(recipe)) {
    const prevHeavy = ctx.previousDayRecipes.some(isStapleHeavyDish);
    if (prevHeavy) {
      scoreDelta -= 8;
      reasons.push({ detail: "主食が重めの献立が連続しやすい（補助）" });
    }
  }

  // 甘いデザート連続（補助）
  if (isSweetDessertOrSugaryDrink(recipe)) {
    const prevSweet = ctx.previousDayRecipes.some(isSweetDessertOrSugaryDrink);
    if (prevSweet) {
      scoreDelta -= 10;
      reasons.push({ detail: "甘いデザート／飲料が連続しやすい（補助）" });
    } else {
      scoreDelta -= 4;
      reasons.push({ detail: "甘いデザート／飲料を含む（補助）" });
    }
  }

  // 希望主食量がある場合、主食寄りの料理に軽い整合ボーナス
  if (
    settings.preferredStaplePortionGrams != null &&
    settings.preferredStaplePortionGrams > 0 &&
    isStapleHeavyDish(recipe)
  ) {
    scoreDelta += 3;
    reasons.push({ detail: "希望する主食量の目安に沿った候補（補助）" });
  }

  return { scoreDelta, reasons, nutritionMissing: false };
}

/** @deprecated 互換用。scoreHealthMealSupport を使う */
export function scoreDiabetesMealSupport(
  recipe: Recipe,
  ctx: DiabetesScoreContext,
): DiabetesScoreDelta {
  return scoreHealthMealSupport(recipe, ctx);
}
