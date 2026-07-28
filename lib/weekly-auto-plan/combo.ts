import type { Recipe } from "@/types/recipe";
import type { DayMeal } from "@/types/meal-plan";
import type { SelectionReason } from "@/types/weekly-meal-plan";
import type { WeeklyAutoCourse } from "@/types/weekly-meal-plan";
import {
  getGenreKey,
  isFishRecipe,
  isMeatRecipe,
} from "@/lib/weekly-auto-plan/recipe-features";

export type ComboEvalResult = {
  delta: number;
  reasons: SelectionReason[];
  /** false のとき UI で打ち消し線や非推奨表示に使える */
  compatible: boolean;
};

function looksWestern(recipe: Recipe): boolean {
  return (
    recipe.category === "洋食" ||
    /パスタ|サラダ|スープ|グラタン|ドレッシング|チーズ/.test(
      `${recipe.name} ${recipe.tags.join(" ")}`,
    )
  );
}

function looksJapanese(recipe: Recipe): boolean {
  return (
    recipe.category === "和食" ||
    /味噌|煮物|和え|漬け|ごはん|ご飯|納豆/.test(
      `${recipe.name} ${recipe.tags.join(" ")}`,
    )
  );
}

/**
 * 候補を「その日の既存献立との組み合わせ」で評価する。
 */
export function evaluateDayCombo(
  candidate: Recipe,
  day: DayMeal,
  recipesById: Map<string, Recipe>,
  targetCourse: WeeklyAutoCourse,
): ComboEvalResult {
  const existing: Recipe[] = [];
  for (const item of day.items) {
    if (!item.recipeId) continue;
    if (item.course === targetCourse) continue; // 差し替え対象は除外
    const recipe = recipesById.get(item.recipeId);
    if (recipe) existing.push(recipe);
  }

  let delta = 0;
  const reasons: SelectionReason[] = [];
  let compatible = true;

  const hasMain = existing.some(
    (r) => r.course === "主菜" || r.mealAffinity?.mealRole === "main",
  );
  const hasSide = existing.some(
    (r) => r.course === "副菜" || r.mealAffinity?.mealRole === "side",
  );
  const hasSoup = existing.some(
    (r) => r.course === "汁物" || r.mealAffinity?.mealRole === "soup",
  );
  const main = existing.find(
    (r) => r.course === "主菜" || r.mealAffinity?.mealRole === "main",
  );
  const staple = existing.find((r) => r.course === "主食");

  if (targetCourse === "主菜" && !hasMain) {
    delta += 14;
    reasons.push({ detail: "主菜が不足しています" });
  }
  if (targetCourse === "副菜" && !hasSide) {
    delta += 10;
    reasons.push({ detail: "副菜を足すとバランスが良くなります" });
  }
  if (targetCourse === "汁物" && !hasSoup) {
    delta += 10;
    reasons.push({ detail: "汁物があると献立が整います" });
  }

  if (main) {
    const mainGenre = getGenreKey(main);
    const candGenre = getGenreKey(candidate);

    if (
      looksWestern(main) ||
      /パスタ|カルボナーラ|スパゲティ/.test(main.name)
    ) {
      if (looksWestern(candidate) || candidate.course === "汁物") {
        delta += 16;
        reasons.push({ detail: "パスタなので洋風副菜を優先" });
      }
      if (isMeatRecipe(candidate) && candidate.course === "主菜") {
        delta -= 22;
        compatible = false;
        reasons.push({ detail: "主菜がすでにあり、肉の重ねは避けます" });
      }
      if (isFishRecipe(candidate) && candidate.course === "主菜") {
        delta -= 18;
        compatible = false;
        reasons.push({ detail: "主菜がすでにあります" });
      }
    }

    if (looksJapanese(main) && looksJapanese(candidate)) {
      delta += 10;
      reasons.push({ detail: "和食の主菜と相性が良い" });
    }

    if (mainGenre === candGenre && targetCourse !== "汁物") {
      delta += 6;
      reasons.push({ detail: `${mainGenre}の組み合わせでまとまります` });
    }

    if (
      isMeatRecipe(main) &&
      isMeatRecipe(candidate) &&
      targetCourse === "主菜"
    ) {
      delta -= 25;
      compatible = false;
      reasons.push({ detail: "主菜の肉料理が重複しやすい" });
    }

    if (
      isFishRecipe(main) &&
      isFishRecipe(candidate) &&
      targetCourse === "主菜"
    ) {
      delta -= 20;
      compatible = false;
      reasons.push({ detail: "魚の主菜が重複しやすい" });
    }

    if (
      !isFishRecipe(main) &&
      isFishRecipe(candidate) &&
      targetCourse !== "主菜"
    ) {
      // 副菜で魚は稀だが栄養バランス文言
    }
  }

  if (
    staple &&
    (/パスタ|うどん|そば|ラーメン|カルボナーラ|スパゲティ/.test(staple.name) ||
      looksWestern(staple))
  ) {
    if (looksWestern(candidate) || candidate.category === "洋食") {
      delta += 12;
      reasons.push({ detail: "パスタなので洋風副菜を優先" });
    }
    if (isMeatRecipe(candidate) && candidate.course === "主菜") {
      delta -= 15;
      compatible = false;
      reasons.push({ detail: "主食がしっかりしているので重い主菜は控えめに" });
    }
  }

  const weekFishHint =
    !existing.some(isFishRecipe) &&
    isFishRecipe(candidate) &&
    targetCourse === "主菜";
  if (weekFishHint) {
    delta += 12;
    reasons.push({
      detail: "魚料理を追加すると栄養バランスが良くなります",
    });
  }

  if (
    existing.some(isMeatRecipe) &&
    isMeatRecipe(candidate) &&
    targetCourse === "主菜"
  ) {
    delta -= 18;
    compatible = false;
    reasons.push({ detail: "この日はすでに肉料理があります" });
  }

  return {
    delta: Math.max(-30, Math.min(28, delta)),
    reasons: reasons.slice(0, 4),
    compatible,
  };
}
