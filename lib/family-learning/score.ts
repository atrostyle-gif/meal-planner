/**
 * 家庭学習プロファイルによる献立スコア加点（100%従わない）。
 */
import type { FamilyLearningProfile } from "@/types/family-learning";
import type { Recipe } from "@/types/recipe";
import type { SelectionReason } from "@/types/weekly-meal-plan";
import { DAYS_OF_WEEK } from "@/types/weekly-lifestyle";

export type FamilyLearningScoreResult = {
  delta: number;
  reasons: SelectionReason[];
};

/**
 * 学習結果をスコアへ控えめに反映する。
 */
export function scoreFamilyLearning(
  recipe: Recipe,
  profile: FamilyLearningProfile | null | undefined,
  options?: {
    dayIndex?: number;
    cookMemberId?: string | null;
  },
): FamilyLearningScoreResult {
  if (!profile || profile.sampleCount < 2) {
    return { delta: 0, reasons: [] };
  }

  let delta = 0;
  const reasons: SelectionReason[] = [];
  const dayIndex = options?.dayIndex ?? 0;
  const dayKey = DAYS_OF_WEEK[dayIndex];
  const cookMemberId = options?.cookMemberId ?? null;
  const haystack = `${recipe.name} ${recipe.tags.join(" ")} ${recipe.category}`;

  // カテゴリ好み
  const cuisine = profile.favoriteCuisine.find(
    (c) => c.name === recipe.category && c.count >= 2 && c.avgRating >= 4,
  );
  if (cuisine) {
    delta += Math.min(10, 4 + cuisine.count);
    reasons.push({
      detail: `この家庭では${cuisine.name}の評価が高い`,
    });
  }

  // 調理時間帯
  if (
    profile.favoriteCookingTime &&
    recipe.cookingTimeMinutes != null &&
    recipe.cookingTimeMinutes <= profile.favoriteCookingTime.maxMinutes
  ) {
    delta += 6;
    reasons.push({
      detail: `この家庭では${profile.favoriteCookingTime.maxMinutes}分以内が好評`,
    });
  }

  // 難易度傾向
  if (
    profile.favoriteDifficulty === "easy" &&
    recipe.cookingTimeMinutes != null &&
    recipe.cookingTimeMinutes <= 25
  ) {
    delta += 5;
    reasons.push({ detail: "この家庭は簡単な料理が好まれます" });
  }
  if (
    profile.favoriteDifficulty === "elaborate" &&
    recipe.cookingTimeMinutes != null &&
    recipe.cookingTimeMinutes >= 40
  ) {
    delta += 4;
  }

  // 食材
  for (const ing of profile.favoriteIngredients.slice(0, 6)) {
    if (recipe.ingredients.some((i) => i.name.includes(ing.name))) {
      delta += 4;
      reasons.push({ detail: `好みの食材（${ing.name}）を使えます` });
      break;
    }
  }

  // 曜日パターン
  if (dayKey) {
    const weekday = profile.favoriteWeekday.find((w) => w.day === dayKey);
    if (
      weekday &&
      weekday.preferredMaxMinutes != null &&
      recipe.cookingTimeMinutes != null &&
      recipe.cookingTimeMinutes <= weekday.preferredMaxMinutes + 5
    ) {
      delta += 7;
      reasons.push({
        detail: `${weekday.label}曜は${weekday.preferredMaxMinutes}分以内が好評`,
      });
    }
  }

  // 担当者学習
  if (cookMemberId) {
    const member = profile.memberLearning.find(
      (m) => m.memberId === cookMemberId,
    );
    if (member) {
      if (member.successfulRecipeIds.includes(recipe.id)) {
        delta += 10;
        reasons.push({
          detail: `${member.memberName}担当の日は成功率が高い料理です`,
        });
      } else if (
        member.preferEasy &&
        recipe.cookingTimeMinutes != null &&
        recipe.cookingTimeMinutes <=
          (member.preferredMaxCookingMinutes ?? 25)
      ) {
        delta += 8;
        reasons.push({
          detail:
            member.insight ??
            `${member.memberName}担当の日は簡単料理を優先`,
        });
      } else if (
        member.acceptElaborate &&
        recipe.cookingTimeMinutes != null &&
        recipe.cookingTimeMinutes >= 35
      ) {
        delta += 5;
        reasons.push({
          detail: `${member.memberName}担当なので手間料理もOK`,
        });
      }
      // パスタパターン
      const pastaPattern = profile.successfulPatterns.find(
        (p) =>
          p.cookMemberId === cookMemberId && p.tagIds?.includes("pasta"),
      );
      if (
        pastaPattern &&
        /パスタ|スパゲティ|うどん|麺/.test(haystack)
      ) {
        delta += 7;
        reasons.push({ detail: pastaPattern.label });
      }
    }
  }

  // 成功パターン（カテゴリ）
  for (const pattern of profile.successfulPatterns.slice(0, 4)) {
    if (pattern.cuisine && pattern.cuisine === recipe.category) {
      delta += Math.min(6, pattern.weight / 2);
      if (!reasons.some((r) => r.detail.includes(pattern.cuisine!))) {
        reasons.push({ detail: pattern.label });
      }
    }
  }

  // 回避
  for (const avoided of profile.avoidedPatterns) {
    if (
      avoided.cuisine === "揚げ物" &&
      /揚げ|フライ|天ぷら|唐揚/.test(haystack)
    ) {
      delta -= 8;
      reasons.push({ detail: `この家庭では${avoided.label}の評価が低い` });
    }
  }

  // 変更で外されがち
  if (profile.changeAwayRecipeIds.includes(recipe.id)) {
    delta -= 6;
    reasons.push({ detail: "以前変更されやすかった料理です" });
  }

  // 全体の高評価傾向メッセージ
  if (
    (recipe.averageRating ?? 0) >= 4.3 &&
    (recipe.cookCount ?? 0) >= 2
  ) {
    delta += 3;
    if (!reasons.some((r) => r.detail.includes("この家庭では評価"))) {
      reasons.push({ detail: "この家庭では評価が高い料理です" });
    }
  }

  // 振れ幅を抑える
  delta = Math.max(-16, Math.min(22, Math.round(delta)));
  return { delta, reasons: reasons.slice(0, 4) };
}
