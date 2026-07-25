import type { Recipe } from "@/types/recipe";
import type { InventoryItem } from "@/types/inventory";
import type {
  SelectionReason,
  SelectionReasonBadge,
} from "@/types/weekly-meal-plan";
import {
  WEEKDAY_TIME_LIMIT_MINUTES,
  getGenreKey,
  getMainIngredientKey,
  isFishRecipe,
  isMeatRecipe,
  isWeekdayIndex,
  recipeUsesInventory,
} from "@/lib/weekly-auto-plan/recipe-features";
import { scoreDiabetesMealSupport } from "@/lib/diabetes-meal-support/score";
import type { DiabetesMealSupportSettings } from "@/types/diabetes-meal-support";
import {
  DEFAULT_DIABETES_MEAL_SUPPORT_SETTINGS,
} from "@/types/diabetes-meal-support";
import type { RecipeCourse } from "@/types/recipe";

export type ScoreContext = {
  dayIndex: number;
  usedRecipeIds: Set<string>;
  previousMainIngredientKey: string | null;
  previousGenreKey: string | null;
  previousWasFish: boolean | null;
  previousWasMeat: boolean | null;
  weekHasFish: boolean;
  recentRecipeIds: Set<string>;
  inventory: InventoryItem[];
  /** 糖尿病配慮（OFF時は影響なし） */
  diabetesSettings?: DiabetesMealSupportSettings;
  dayCoursesSoFar?: RecipeCourse[];
  previousDayRecipes?: Recipe[];
  /** 採点対象コース（主菜を1食糖質のアンカーにする） */
  targetCourse?: RecipeCourse;
};

export type ScoredCandidate = {
  recipe: Recipe;
  score: number;
  reasons: SelectionReason[];
  badges: SelectionReasonBadge[];
};

/**
 * ルールベース採点。高いほど優先。
 */
export function scoreRecipeForSlot(
  recipe: Recipe,
  ctx: ScoreContext,
): ScoredCandidate {
  let score = 50;
  const reasons: SelectionReason[] = [];
  const badges: SelectionReasonBadge[] = [];

  // 重複禁止（選ばせない）
  if (ctx.usedRecipeIds.has(recipe.id)) {
    return { recipe, score: -10_000, reasons: [], badges: [] };
  }

  const time = recipe.cookingTimeMinutes;
  const weekday = isWeekdayIndex(ctx.dayIndex);

  if (weekday) {
    if (time != null && time <= WEEKDAY_TIME_LIMIT_MINUTES) {
      score += 25;
      reasons.push({
        detail: `平日のため${WEEKDAY_TIME_LIMIT_MINUTES}分以内`,
        badge: "時短",
      });
      badges.push("時短");
    } else if (time != null && time > 45) {
      score -= 20;
      reasons.push({ detail: "平日にはやや時間がかかる" });
    } else if (time == null) {
      score -= 2;
    }
  } else {
    if (time != null && time > 45) {
      score += 8;
      reasons.push({ detail: "週末なのでしっかりめの料理もOK" });
    } else if (time != null && time <= WEEKDAY_TIME_LIMIT_MINUTES) {
      score += 5;
      reasons.push({ detail: "週末でも時短で余裕がある", badge: "時短" });
      badges.push("時短");
    }
  }

  const mainKey = getMainIngredientKey(recipe);
  if (ctx.previousMainIngredientKey && mainKey === ctx.previousMainIngredientKey) {
    score -= 40;
    reasons.push({ detail: "前日と主食材が重複しやすい" });
  } else if (ctx.previousMainIngredientKey) {
    score += 12;
    reasons.push({ detail: "前日と主食材が重複しない" });
  }

  const genre = getGenreKey(recipe);
  if (ctx.previousGenreKey && genre === ctx.previousGenreKey) {
    score -= 25;
    reasons.push({ detail: "前日と同じジャンルが連続する" });
  } else if (ctx.previousGenreKey) {
    score += 8;
    reasons.push({ detail: "ジャンルが分散している" });
  }

  const fish = isFishRecipe(recipe);
  const meat = isMeatRecipe(recipe);

  if (fish) {
    if (!ctx.weekHasFish) {
      score += 22;
      reasons.push({
        detail: "今週まだ魚料理がない",
        badge: "魚の日",
      });
      badges.push("魚の日");
    } else {
      score += 4;
    }
    if (ctx.previousWasFish === true) {
      score -= 30;
      reasons.push({ detail: "魚料理が連続しやすい" });
    }
  }

  if (meat && ctx.previousWasMeat === true) {
    score -= 18;
    reasons.push({ detail: "肉料理が連続しやすい" });
  }
  if (meat && ctx.previousWasFish === true) {
    score += 10;
    reasons.push({ detail: "肉と魚が分散する" });
  }
  if (fish && ctx.previousWasMeat === true) {
    score += 10;
    reasons.push({ detail: "肉と魚が分散する" });
  }

  if (recipe.favoriteScore != null && recipe.favoriteScore >= 4) {
    score += 18;
    reasons.push({
      detail: "家族のお気に入りレシピ",
      badge: "家族のお気に入り",
    });
    badges.push("家族のお気に入り");
  } else if (recipe.favoriteScore != null && recipe.favoriteScore >= 3) {
    score += 8;
  }

  // 学習統計（フィードバック蓄積）
  if (recipe.familyFavoriteScore != null && recipe.familyFavoriteScore >= 4) {
    score += 14;
    reasons.push({
      detail: "家族人気が高い",
      badge: "家族のお気に入り",
    });
    badges.push("家族のお気に入り");
  } else if (recipe.averageRating != null && recipe.averageRating >= 4) {
    score += 12;
    reasons.push({ detail: "高評価のレシピ" });
  }
  if (recipe.averageRating != null && recipe.averageRating <= 2) {
    score -= 22;
    reasons.push({ detail: "低評価が続いている" });
  }
  const wantNo = recipe.wantAgainNo ?? 0;
  const wantYes = recipe.wantAgainYes ?? 0;
  if (wantNo >= 2 && wantNo > wantYes) {
    score -= 25;
    reasons.push({ detail: "また作る=No が続いている" });
  }
  if (recipe.lastCookedAt) {
    const last = new Date(recipe.lastCookedAt).getTime();
    if (!Number.isNaN(last)) {
      const days = (Date.now() - last) / (1000 * 60 * 60 * 24);
      if (days >= 14) {
        score += 10;
        reasons.push({ detail: "最近作っていないので久しぶり" });
      } else if (days <= 3) {
        score -= 12;
        reasons.push({ detail: "つい最近作った料理" });
      }
    }
  } else if ((recipe.cookCount ?? 0) === 0 && recipe.averageRating == null) {
    // 未調理は中立
  }

  if (ctx.recentRecipeIds.has(recipe.id)) {
    score -= 15;
    reasons.push({ detail: "最近食べた料理のため減点" });
  }

  const { matched } = recipeUsesInventory(recipe, ctx.inventory);
  if (matched.length > 0) {
    score += 15 + Math.min(10, matched.length * 3);
    reasons.push({
      detail: `冷蔵庫の食材を活用（${matched.slice(0, 2).join("・")}）`,
      badge: "冷蔵庫消費",
    });
    badges.push("冷蔵庫消費");
    if (matched.length >= 2) {
      badges.push("食材使い切り");
      reasons.push({
        detail: "複数の在庫食材を使い切れる",
        badge: "食材使い切り",
      });
    }
  }

  if (
    recipe.tags.some((tag) => /作り置き|冷凍|保存/.test(tag)) ||
    /作り置き/.test(recipe.name)
  ) {
    score += 10;
    reasons.push({
      detail: "作り置きに向いている",
      badge: "作り置き活用",
    });
    badges.push("作り置き活用");
  }

  const diabetesSettings =
    ctx.diabetesSettings ?? {
      ...DEFAULT_DIABETES_MEAL_SUPPORT_SETTINGS,
      updatedAt: "",
    };
  const diabetes = scoreDiabetesMealSupport(recipe, {
    settings: diabetesSettings,
    dayCoursesSoFar: ctx.dayCoursesSoFar ?? [],
    previousDayRecipes: ctx.previousDayRecipes ?? [],
    evaluateAsMealCarbAnchor: ctx.targetCourse === "主菜",
  });
  score += diabetes.scoreDelta;
  reasons.push(...diabetes.reasons);

  // バッジ重複除去
  const uniqueBadges = [...new Set(badges)];
  const uniqueReasons = dedupeReasons(reasons);

  return {
    recipe,
    score,
    reasons: uniqueReasons,
    badges: uniqueBadges,
  };
}

function dedupeReasons(reasons: SelectionReason[]): SelectionReason[] {
  const seen = new Set<string>();
  const result: SelectionReason[] = [];
  for (const reason of reasons) {
    if (seen.has(reason.detail)) continue;
    seen.add(reason.detail);
    result.push(reason);
  }
  return result;
}

export function pickBestCandidate(
  candidates: ScoredCandidate[],
): ScoredCandidate | null {
  const viable = candidates
    .filter((c) => c.score > -1000)
    .sort((a, b) => b.score - a.score);
  return viable[0] ?? null;
}
