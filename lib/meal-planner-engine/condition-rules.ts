/**
 * 体調・状況に応じた加点/減点ルール（調整しやすい純粋関数）
 */
import { isFriedDish, isNoodleDish } from "@/lib/recipe-nutrition";
import type { DailyConditionOption } from "@/types/daily-condition";
import type { Recipe } from "@/types/recipe";

export type ConditionScoreDelta = {
  points: number;
  reason: string;
};

export function scoreRecipeForConditions(
  recipe: Recipe,
  conditions: DailyConditionOption[],
): ConditionScoreDelta[] {
  const deltas: ConditionScoreDelta[] = [];
  const unique = [...new Set(conditions)];

  for (const condition of unique) {
    switch (condition) {
      case "胃腸にやさしく":
        if (isFriedDish(recipe) || (recipe.fat ?? 0) >= 25) {
          deltas.push({ points: -25, reason: "胃腸に配慮して揚げ物・高脂質を控えめに" });
        }
        if (
          /おかゆ|おじや|うどん|煮物|スープ|味噌汁/.test(recipe.name) ||
          recipe.category === "スープ" ||
          recipe.category === "鍋"
        ) {
          deltas.push({ points: 25, reason: "胃腸にやさしい料理を優先" });
        }
        break;
      case "食欲がない":
        if (recipe.category === "サラダ" || recipe.category === "スープ" || /冷やし|サラダ|スープ/.test(recipe.name)) {
          deltas.push({ points: 18, reason: "食欲がない日に合うさっぱり・汁物" });
        }
        if ((recipe.cookingTimeMinutes ?? 99) <= 20) {
          deltas.push({ points: 8, reason: "食欲がない日でも作りやすい時短" });
        }
        break;
      case "風邪気味":
        if (recipe.category === "鍋" || recipe.category === "スープ") {
          deltas.push({ points: 20, reason: "風邪気味の日に温かい料理" });
        }
        break;
      case "疲れている":
      case "忙しい":
      case "帰宅が遅い":
        if ((recipe.cookingTimeMinutes ?? 99) <= 25) {
          deltas.push({ points: 18, reason: "忙しい・疲れている日の時短メニュー" });
        }
        if ((recipe.difficulty ?? 5) <= 2) {
          deltas.push({ points: 10, reason: "工程が少なめの料理" });
        }
        break;
      case "運動した日":
      case "部活動・体育の日":
        if ((recipe.protein ?? 0) >= 20 || recipe.proteinType === "鶏" || recipe.proteinType === "魚") {
          deltas.push({ points: 18, reason: "運動した日のたんぱく質補給" });
        }
        if (recipe.category === "丼物" || recipe.category === "麺類") {
          deltas.push({ points: 8, reason: "炭水化物の補給" });
        }
        break;
      case "暑さで食欲低下":
        if (recipe.season === "夏" || recipe.category === "サラダ" || isNoodleDish(recipe)) {
          deltas.push({ points: 15, reason: "暑い日に合うさっぱりメニュー" });
        }
        if (isFriedDish(recipe)) {
          deltas.push({ points: -12, reason: "暑い日は揚げ物を控えめ" });
        }
        break;
      case "寒い":
        if (recipe.season === "冬" || recipe.category === "鍋" || recipe.category === "カレー") {
          deltas.push({ points: 15, reason: "寒い日に合う温かい料理" });
        }
        break;
      default:
        break;
    }
  }

  return deltas;
}
