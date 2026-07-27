import { loadCookingHistory } from "@/lib/cooking-history";
import { getFeedbacksForRecipe } from "@/lib/recipe-learning/cooking-feedbacks";
import { loadRecipes, replaceRecipes } from "@/lib/recipes";
import {
  getImprovementTagById,
  type RecipeLearningStats,
} from "@/types/recipe-learning";
import type { Recipe } from "@/types/recipe";

/**
 * 履歴・フィードバックから学習統計を算出する。
 */
export function computeRecipeLearningStats(
  recipeId: string,
): RecipeLearningStats {
  const histories = loadCookingHistory().filter((h) => h.recipeId === recipeId);
  const feedbacks = getFeedbacksForRecipe(recipeId);

  // 評価は Feedback を優先（History との二重計上を避ける）
  const ratings: number[] = [];
  const historyIdsWithFeedback = new Set(feedbacks.map((f) => f.historyId));
  for (const feedback of feedbacks) {
    if (feedback.overallRating != null) ratings.push(feedback.overallRating);
    for (const member of feedback.memberRatings) {
      ratings.push(member.rating);
    }
  }
  for (const history of histories) {
    if (historyIdsWithFeedback.has(history.id)) continue;
    if (history.successRating != null) ratings.push(history.successRating);
  }

  const averageRating =
    ratings.length > 0
      ? Math.round(
          (ratings.reduce((sum, n) => sum + n, 0) / ratings.length) * 10,
        ) / 10
      : null;

  const sortedHistories = [...histories].sort((a, b) =>
    b.cookedAt.localeCompare(a.cookedAt),
  );
  const lastCookedAt = sortedHistories[0]?.cookedAt ?? null;

  let wantAgainYes = 0;
  let wantAgainNo = 0;
  for (const feedback of feedbacks) {
    if (feedback.wantAgain === true) wantAgainYes += 1;
    if (feedback.wantAgain === false) wantAgainNo += 1;
  }
  for (const history of histories) {
    if (historyIdsWithFeedback.has(history.id)) continue;
    if (history.wantAgain === true) wantAgainYes += 1;
    if (history.wantAgain === false) wantAgainNo += 1;
  }

  const favoriteByUsers = [
    ...new Set(
      feedbacks.flatMap((feedback) =>
        feedback.memberRatings
          .filter((r) => r.rating >= 4)
          .map((r) => r.memberId),
      ),
    ),
  ];

  const improvementCount = feedbacks.reduce(
    (sum, feedback) =>
      sum +
      feedback.improvementTags.length +
      feedback.adjustments.length +
      feedback.seasoningAdjustments.length,
    0,
  );

  const wantAgainRate =
    wantAgainYes + wantAgainNo > 0
      ? Math.round((wantAgainYes / (wantAgainYes + wantAgainNo)) * 100) / 100
      : null;

  // 家族人気: 平均評価とまた作りたい比率から 0〜5
  let familyFavoriteScore: number | null = null;
  if (averageRating != null || wantAgainRate != null) {
    const wantRatio = wantAgainRate ?? 0.5;
    const base = averageRating ?? 3;
    familyFavoriteScore =
      Math.round(Math.min(5, Math.max(0, base * 0.7 + wantRatio * 5 * 0.3)) * 10) /
      10;
  }

  const tagCounts = new Map<string, number>();
  for (const feedback of feedbacks) {
    for (const tagId of feedback.improvementTags) {
      tagCounts.set(tagId, (tagCounts.get(tagId) ?? 0) + 1);
    }
  }
  const popularTagIds = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => id);

  const recentImprovementLabels: string[] = [];
  for (const feedback of feedbacks.slice(0, 5)) {
    for (const tagId of feedback.improvementTags) {
      const label = getImprovementTagById(tagId)?.label ?? tagId;
      if (!recentImprovementLabels.includes(label)) {
        recentImprovementLabels.push(label);
      }
    }
    for (const adj of feedback.adjustments) {
      const label = `${adj.ingredientName}${
        adj.afterValue ? ` ${adj.afterValue}` : ""
      }`.trim();
      if (label && !recentImprovementLabels.includes(label)) {
        recentImprovementLabels.push(label);
      }
    }
    for (const sea of feedback.seasoningAdjustments) {
      const label = `${sea.seasoning}${
        sea.afterAmount ? ` ${sea.afterAmount}` : ""
      }`.trim();
      if (label && !recentImprovementLabels.includes(label)) {
        recentImprovementLabels.push(label);
      }
    }
    if (recentImprovementLabels.length >= 6) break;
  }

  const memberScore = new Map<string, { sum: number; count: number }>();
  for (const feedback of feedbacks) {
    for (const member of feedback.memberRatings) {
      const prev = memberScore.get(member.memberId) ?? { sum: 0, count: 0 };
      prev.sum += member.rating;
      prev.count += 1;
      memberScore.set(member.memberId, prev);
    }
  }
  const popularMemberIds = [...memberScore.entries()]
    .map(([id, value]) => ({
      id,
      avg: value.sum / value.count,
    }))
    .filter((row) => row.avg >= 4)
    .sort((a, b) => b.avg - a.avg)
    .map((row) => row.id);

  return {
    averageRating,
    cookCount: histories.length,
    lastCookedAt,
    familyFavoriteScore,
    improvementCount,
    favoriteByUsers,
    popularMemberIds,
    wantAgainYes,
    wantAgainNo,
    wantAgainRate,
    popularTagIds,
    recentImprovementLabels: recentImprovementLabels.slice(0, 6),
  };
}

/** 1レシピの学習統計を Recipe へ書き戻す */
export function applyLearningStatsToRecipe(recipe: Recipe): Recipe {
  const stats = computeRecipeLearningStats(recipe.id);
  return {
    ...recipe,
    averageRating: stats.averageRating,
    cookCount: stats.cookCount,
    lastCookedAt: stats.lastCookedAt,
    familyFavoriteScore: stats.familyFavoriteScore,
    improvementCount: stats.improvementCount,
    favoriteByUsers: stats.favoriteByUsers,
    wantAgainYes: stats.wantAgainYes,
    wantAgainNo: stats.wantAgainNo,
    // 手動 favoriteScore が無いとき学習値で補完（上書きはしない）
    favoriteScore:
      recipe.favoriteScore != null
        ? recipe.favoriteScore
        : stats.familyFavoriteScore != null
          ? Math.round(stats.familyFavoriteScore)
          : recipe.favoriteScore,
    updatedAt: new Date().toISOString(),
  };
}

/** 指定レシピ（または全件）の学習統計を更新して保存 */
export function refreshRecipeLearningStats(recipeId?: string): void {
  const recipes = loadRecipes();
  const next = recipes.map((recipe) => {
    if (recipeId && recipe.id !== recipeId) return recipe;
    return applyLearningStatsToRecipe(recipe);
  });
  replaceRecipes(next);
}
