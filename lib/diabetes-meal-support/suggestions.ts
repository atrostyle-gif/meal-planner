import {
  evaluateCarbTargetStatus,
  mealNutritionTotalsForDay,
} from "@/lib/diabetes-meal-support/aggregate";
import {
  hasNonStarchyVegetables,
  isStapleHeavyDish,
  isSweetDessertOrSugaryDrink,
  resolveRecipeMealNutrition,
} from "@/lib/diabetes-meal-support/recipe-nutrition";
import type {
  DiabetesImprovementSuggestion,
  DiabetesMealSupportSettings,
} from "@/types/diabetes-meal-support";
import type { DayMeal, MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";

/**
 * 改善候補を生成する（提案のみ。献立へは自動適用しない）。
 */
export function buildDiabetesImprovementSuggestions(
  plan: MealPlan,
  recipes: Recipe[],
  settings: DiabetesMealSupportSettings,
): DiabetesImprovementSuggestion[] {
  if (!settings.diabetesMealSupportEnabled) return [];

  const suggestions: DiabetesImprovementSuggestion[] = [];
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));

  for (const day of plan.days) {
    const dayRecipes = day.items
      .map((item) => (item.recipeId ? recipeMap.get(item.recipeId) : null))
      .filter((r): r is Recipe => Boolean(r));

    const totals = mealNutritionTotalsForDay(day, recipes);
    const mealStatus = evaluateCarbTargetStatus(
      totals.carbohydratesG,
      settings,
      "meal",
    );

    if (mealStatus === "over") {
      suggestions.push({
        id: `${day.date}-reduce-staple`,
        date: day.date,
        title: "主食量を少なくする",
        detail:
          "推定糖質が目標上限を超えています。主食の量を減らすか、小盛りに変更することを検討してください（自動変更しません）。",
        autoApply: false,
      });
      if (dayRecipes.some(isStapleHeavyDish)) {
        suggestions.push({
          id: `${day.date}-split-don`,
          date: day.date,
          title: "丼物を主菜と小盛り主食に分ける",
          detail:
            "丼・麺中心の料理を、主菜と主食に分けて量を調整しやすくできます（提案のみ）。",
          autoApply: false,
        });
      }
      suggestions.push({
        id: `${day.date}-brown-rice`,
        date: day.date,
        title: "白米を雑穀・玄米候補へ変更",
        detail:
          "主食の種類を雑穀米や玄米などに変える候補です。糖質総量や食後の感じ方は個人差があるため、専門家の案内を優先してください。",
        autoApply: false,
      });
    }

    const hasVeg = dayRecipes.some(hasNonStarchyVegetables);
    if (!hasVeg) {
      suggestions.push({
        id: `${day.date}-add-veg`,
        date: day.date,
        title: "野菜の副菜を追加",
        detail: "野菜の副菜を足す候補です。献立には自動追加しません。",
        autoApply: false,
      });
    }

    if (dayRecipes.some(isSweetDessertOrSugaryDrink)) {
      suggestions.push({
        id: `${day.date}-unsweet-drink`,
        date: day.date,
        title: "甘い飲料を無糖飲料へ変更",
        detail:
          "砂糖入りの飲料や甘いデザートがある日です。無糖のお茶や水への変更を検討できます（提案のみ）。",
        autoApply: false,
      });
    }

    if (
      settings.preferredStaplePortionGrams != null &&
      dayRecipes.some((r) => r.course === "主食" || isStapleHeavyDish(r))
    ) {
      suggestions.push({
        id: `${day.date}-staple-portion`,
        date: day.date,
        title: "主食量の目安を確認",
        detail: `設定中の主食量の目安は ${settings.preferredStaplePortionGrams}g です。必要に応じて量を調整してください（自動変更なし）。`,
        autoApply: false,
      });
    }

    // 栄養不足の明示
    for (const recipe of dayRecipes) {
      const n = resolveRecipeMealNutrition(recipe);
      if (n.carbohydratesG == null) {
        suggestions.push({
          id: `${day.date}-missing-${recipe.id}`,
          date: day.date,
          title: "栄養情報の入力を検討",
          detail: `「${recipe.name}」の糖質情報が不足しているため判定できません。レシピに栄養値を入力すると精度が上がります。`,
          autoApply: false,
        });
      }
    }
  }

  // 重複タイトルを日付単位で抑制
  const seen = new Set<string>();
  return suggestions.filter((item) => {
    const key = `${item.date}:${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 提案を献立へ適用しないことを保証する（テスト用） */
export function assertSuggestionsAreProposalsOnly(
  suggestions: DiabetesImprovementSuggestion[],
): boolean {
  return suggestions.every((item) => item.autoApply === false);
}

export function dayHasVegetables(day: DayMeal, recipes: Recipe[]): boolean {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  return day.items.some((item) => {
    if (!item.recipeId) return false;
    const recipe = recipeMap.get(item.recipeId);
    return recipe ? hasNonStarchyVegetables(recipe) : false;
  });
}
