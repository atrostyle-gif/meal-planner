/**
 * レビュー・履歴・変更・担当から家庭学習プロファイルを計算する。
 */
import { WEEKDAY_LABELS, parseDate } from "@/lib/date";
import { loadMealChangeEvents } from "@/lib/family-learning/meal-change-events";
import { loadCookingHistory } from "@/lib/cooking-history";
import { loadCookingFeedbacks } from "@/lib/recipe-learning/cooking-feedbacks";
import { loadFamilyMemberProfiles } from "@/lib/family-member-profiles";
import { loadRecipes } from "@/lib/recipes";
import { loadWeeklyCookingSchedules } from "@/lib/weekly-cooking-schedules";
import {
  EMPTY_FAMILY_LEARNING_PROFILE,
  type AvoidedPattern,
  type FamilyLearningProfile,
  type FavoriteCuisineStat,
  type FavoriteIngredientStat,
  type FavoriteWeekdayStat,
  type MemberCookLearning,
  type SuccessfulPattern,
} from "@/types/family-learning";
import type { CookingFeedback } from "@/types/recipe-learning";
import type { Recipe } from "@/types/recipe";
import type { CookingHistory } from "@/types/weekly-lifestyle";
import { DAYS_OF_WEEK, type DayOfWeek } from "@/types/weekly-lifestyle";

type RatedCook = {
  recipeId: string;
  recipe: Recipe | null;
  rating: number | null;
  wantAgain: boolean | null;
  tags: string[];
  cookedAt: string;
  cookMemberId: string | null;
  durationMinutes: number | null;
  servings: number | null;
};

function dayKeyFromDate(dateText: string): DayOfWeek | null {
  try {
    const d = parseDate(dateText.slice(0, 10));
    const js = d.getDay(); // 0=日
    const index = js === 0 ? 6 : js - 1;
    return DAYS_OF_WEEK[index] ?? null;
  } catch {
    return null;
  }
}

function seasonFromDate(dateText: string): string {
  const month = parseDate(dateText.slice(0, 10)).getMonth() + 1;
  if (month >= 3 && month <= 5) return "春";
  if (month >= 6 && month <= 8) return "夏";
  if (month >= 9 && month <= 11) return "秋";
  return "冬";
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function collectRatedCooks(
  feedbacks: CookingFeedback[],
  history: CookingHistory[],
  recipes: Recipe[],
): RatedCook[] {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const byHistory = new Map(history.map((h) => [h.id, h]));
  const seen = new Set<string>();
  const result: RatedCook[] = [];

  for (const feedback of feedbacks) {
    seen.add(`${feedback.recipeId}:${feedback.cookedAt.slice(0, 10)}`);
    const hist = feedback.historyId
      ? byHistory.get(feedback.historyId)
      : undefined;
    result.push({
      recipeId: feedback.recipeId,
      recipe: recipeMap.get(feedback.recipeId) ?? null,
      rating: feedback.overallRating,
      wantAgain: feedback.wantAgain,
      tags: feedback.improvementTags,
      cookedAt: feedback.cookedAt,
      cookMemberId: hist?.cookedByMemberId ?? feedback.createdBy ?? null,
      durationMinutes:
        feedback.cookingTimeActualMinutes ?? hist?.durationMinutes ?? null,
      servings: feedback.servingsActual ?? hist?.servings ?? null,
    });
  }

  for (const h of history) {
    const key = `${h.recipeId}:${h.cookedAt.slice(0, 10)}`;
    if (seen.has(key)) continue;
    result.push({
      recipeId: h.recipeId,
      recipe: recipeMap.get(h.recipeId) ?? null,
      rating: h.successRating,
      wantAgain: h.wantAgain ?? null,
      tags: h.improvementTags ?? [],
      cookedAt: h.cookedAt,
      cookMemberId: h.cookedByMemberId,
      durationMinutes: h.cookingTimeActual ?? h.durationMinutes,
      servings: h.servings ?? null,
    });
  }

  return result;
}

function buildCuisineStats(cooks: RatedCook[]): FavoriteCuisineStat[] {
  const map = new Map<string, number[]>();
  for (const cook of cooks) {
    if (!cook.recipe || cook.rating == null) continue;
    const name = cook.recipe.category || "その他";
    const list = map.get(name) ?? [];
    list.push(cook.rating);
    map.set(name, list);
  }
  return [...map.entries()]
    .map(([name, ratings]) => ({
      name,
      avgRating: avg(ratings) ?? 0,
      count: ratings.length,
    }))
    .filter((c) => c.count >= 1)
    .sort((a, b) => b.avgRating - a.avgRating || b.count - a.count)
    .slice(0, 8);
}

function buildWeekdayStats(cooks: RatedCook[]): FavoriteWeekdayStat[] {
  const map = new Map<
    string,
    { ratings: number[]; times: number[]; label: string }
  >();
  for (const cook of cooks) {
    const day = dayKeyFromDate(cook.cookedAt);
    if (!day || cook.rating == null) continue;
    const index = DAYS_OF_WEEK.indexOf(day);
    const label = WEEKDAY_LABELS[index] ?? day;
    const entry = map.get(day) ?? { ratings: [], times: [], label };
    entry.ratings.push(cook.rating);
    if (cook.durationMinutes != null) entry.times.push(cook.durationMinutes);
    else if (cook.recipe?.cookingTimeMinutes != null) {
      entry.times.push(cook.recipe.cookingTimeMinutes);
    }
    map.set(day, entry);
  }
  return [...map.entries()]
    .map(([day, entry]) => ({
      day,
      label: entry.label,
      avgRating: avg(entry.ratings) ?? 0,
      count: entry.ratings.length,
      preferredMaxMinutes:
        entry.times.length >= 2
          ? Math.round(
              entry.times.reduce((a, b) => a + b, 0) / entry.times.length,
            )
          : entry.times[0] ?? null,
    }))
    .sort((a, b) => b.avgRating - a.avgRating);
}

function buildIngredientStats(cooks: RatedCook[]): FavoriteIngredientStat[] {
  const scores = new Map<string, { score: number; count: number }>();
  for (const cook of cooks) {
    if (!cook.recipe) continue;
    const weight =
      (cook.rating ?? 3) +
      (cook.wantAgain === true ? 1 : 0) +
      (cook.tags.includes("family_popular") ? 0.5 : 0) -
      (cook.tags.includes("cook_hard") ? 0.5 : 0);
    for (const ing of cook.recipe.ingredients.slice(0, 5)) {
      const name = ing.name.trim();
      if (!name || name.length > 12) continue;
      const prev = scores.get(name) ?? { score: 0, count: 0 };
      scores.set(name, {
        score: prev.score + weight,
        count: prev.count + 1,
      });
    }
  }
  return [...scores.entries()]
    .map(([name, v]) => ({
      name,
      score: Math.round(v.score * 10) / 10,
      count: v.count,
    }))
    .filter((i) => i.count >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

function buildMemberLearning(
  cooks: RatedCook[],
  profiles: { id: string; displayName: string }[],
): MemberCookLearning[] {
  const byMember = new Map<string, RatedCook[]>();
  for (const cook of cooks) {
    if (!cook.cookMemberId) continue;
    const list = byMember.get(cook.cookMemberId) ?? [];
    list.push(cook);
    byMember.set(cook.cookMemberId, list);
  }

  const result: MemberCookLearning[] = [];
  for (const [memberId, list] of byMember) {
    const profile = profiles.find((p) => p.id === memberId);
    const name = profile?.displayName ?? "担当者";
    const ratings = list
      .map((c) => c.rating)
      .filter((r): r is number => r != null);
    const averageRating = avg(ratings);
    const hardTags = list.filter((c) =>
      c.tags.some((t) => t === "cook_hard" || t === "other_hard"),
    ).length;
    const easySuccess = list.filter(
      (c) =>
        (c.rating ?? 0) >= 4 &&
        ((c.durationMinutes ?? c.recipe?.cookingTimeMinutes ?? 99) <= 25 ||
          c.tags.includes("other_easy") ||
          c.tags.includes("cook_faster")),
    ).length;
    const elaborateSuccess = list.filter(
      (c) =>
        (c.rating ?? 0) >= 4.5 &&
        (c.durationMinutes ?? c.recipe?.cookingTimeMinutes ?? 0) >= 40,
    ).length;
    const preferEasy =
      easySuccess >= 2 || (hardTags >= 2 && (averageRating ?? 0) < 4);
    const acceptElaborate = elaborateSuccess >= 2 && !preferEasy;
    const successTimes = list
      .filter((c) => (c.rating ?? 0) >= 4)
      .map((c) => c.durationMinutes ?? c.recipe?.cookingTimeMinutes)
      .filter((t): t is number => t != null)
      .sort((a, b) => a - b);
    const preferredMaxCookingMinutes =
      successTimes.length > 0
        ? successTimes[Math.floor(successTimes.length / 2)] ?? null
        : null;

    let insight: string | null = null;
    if (preferEasy) {
      insight = `${name}担当の日は簡単料理を優先`;
    } else if (acceptElaborate) {
      insight = `${name}担当の日は手間のある料理もOK`;
    } else if (averageRating != null && averageRating >= 4.3) {
      insight = `${name}担当の日は評価が高め`;
    }

    const successfulRecipeIds = list
      .filter((c) => (c.rating ?? 0) >= 4 || c.wantAgain === true)
      .map((c) => c.recipeId)
      .slice(0, 12);

    result.push({
      memberId,
      memberName: name,
      averageRating,
      cookCount: list.length,
      preferredMaxCookingMinutes,
      preferEasy,
      acceptElaborate,
      successfulRecipeIds: [...new Set(successfulRecipeIds)],
      insight,
    });
  }
  return result.sort((a, b) => b.cookCount - a.cookCount);
}

function buildPatterns(
  cuisine: FavoriteCuisineStat[],
  weekdays: FavoriteWeekdayStat[],
  members: MemberCookLearning[],
  cooks: RatedCook[],
): SuccessfulPattern[] {
  const patterns: SuccessfulPattern[] = [];
  for (const c of cuisine.slice(0, 3)) {
    if (c.avgRating >= 4 && c.count >= 2) {
      patterns.push({
        id: `cuisine:${c.name}`,
        label: `${c.name}は評価${c.avgRating}`,
        weight: Math.min(12, 4 + c.count),
        cuisine: c.name,
      });
    }
  }
  for (const w of weekdays) {
    if (w.avgRating >= 4 && w.count >= 2 && w.preferredMaxMinutes != null) {
      patterns.push({
        id: `weekday:${w.day}`,
        label: `${w.label}曜は${w.preferredMaxMinutes}分以内が好評`,
        weight: 8,
        weekday: w.day,
        maxCookingMinutes: w.preferredMaxMinutes,
      });
    }
  }
  for (const m of members) {
    if (m.preferEasy && m.preferredMaxCookingMinutes != null) {
      patterns.push({
        id: `member-easy:${m.memberId}`,
        label: `${m.memberName}担当は簡単料理が成功`,
        weight: 10,
        cookMemberId: m.memberId,
        maxCookingMinutes: m.preferredMaxCookingMinutes,
      });
    }
    if (m.acceptElaborate) {
      patterns.push({
        id: `member-elab:${m.memberId}`,
        label: `${m.memberName}担当は手間料理も成功`,
        weight: 8,
        cookMemberId: m.memberId,
      });
    }
  }
  // パスタ + 娘担当など: category と member の交差
  for (const m of members) {
    const memberCooks = cooks.filter(
      (c) => c.cookMemberId === m.memberId && (c.rating ?? 0) >= 4,
    );
    const pasta = memberCooks.filter(
      (c) =>
        c.recipe &&
        (/パスタ|スパゲティ|うどん|麺/.test(c.recipe.name) ||
          c.recipe.tags.some((t) => /麺|パスタ/.test(t))),
    );
    if (pasta.length >= 2) {
      patterns.push({
        id: `member-pasta:${m.memberId}`,
        label: `${m.memberName}担当はパスタの成功率が高い`,
        weight: 9,
        cookMemberId: m.memberId,
        tagIds: ["pasta"],
      });
    }
  }
  return patterns.slice(0, 12);
}

function buildAvoided(cooks: RatedCook[]): AvoidedPattern[] {
  const avoided: AvoidedPattern[] = [];
  const fried = cooks.filter(
    (c) =>
      c.recipe &&
      /揚げ|フライ|天ぷら|唐揚/.test(
        `${c.recipe.name} ${c.recipe.tags.join(" ")}`,
      ),
  );
  const friedRatings = fried
    .map((c) => c.rating)
    .filter((r): r is number => r != null);
  const friedAvg = avg(friedRatings);
  if (friedAvg != null && friedAvg <= 3.2 && friedRatings.length >= 2) {
    avoided.push({
      label: "揚げ物",
      reason: "最近評価が低い",
      weight: 10,
      cuisine: "揚げ物",
    });
  }
  const hardLow = cooks.filter(
    (c) =>
      c.tags.includes("cook_hard") &&
      c.rating != null &&
      c.rating <= 3,
  );
  if (hardLow.length >= 2) {
    avoided.push({
      label: "大変な料理",
      reason: "作るのが大変で評価が低い",
      weight: 8,
      tagIds: ["cook_hard"],
    });
  }
  return avoided;
}

function buildInsights(
  profile: Omit<FamilyLearningProfile, "insights">,
  cooks: RatedCook[],
): string[] {
  const insights: string[] = [];
  for (const c of profile.favoriteCuisine.slice(0, 2)) {
    if (c.count >= 2) {
      insights.push(`${c.name}料理は評価${c.avgRating}`);
    }
  }
  for (const w of profile.favoriteWeekday) {
    if (w.preferredMaxMinutes != null && w.count >= 2 && w.avgRating >= 4) {
      insights.push(
        `${w.label}曜日は${w.preferredMaxMinutes}分以内が好評`,
      );
    }
  }
  for (const m of profile.memberLearning) {
    if (m.insight) insights.push(m.insight);
  }
  for (const p of profile.successfulPatterns) {
    if (p.label.includes("パスタ")) insights.push(p.label);
  }
  for (const a of profile.avoidedPatterns) {
    insights.push(`${a.label}は${a.reason}`);
  }
  if (profile.tasteThickRate != null && profile.tasteThickRate >= 0.35) {
    insights.push("味が濃いという指摘が多めです");
  }
  if (profile.tasteThinRate != null && profile.tasteThinRate >= 0.35) {
    insights.push("味が薄いという指摘が多めです");
  }
  // 野菜不足: 副菜や野菜タグの比率
  const vegCooks = cooks.filter(
    (c) =>
      c.recipe &&
      (c.recipe.course === "副菜" ||
        c.recipe.tags.some((t) => /野菜|サラダ/.test(t))),
  );
  if (cooks.length >= 6 && vegCooks.length / cooks.length < 0.2) {
    insights.push("野菜料理が不足しています");
  }
  const western = cooks.filter((c) => c.recipe?.category === "洋食").length;
  if (cooks.length >= 6 && western / cooks.length >= 0.45) {
    insights.push("最近は洋食が多めです");
  }
  if (profile.cookCompletionRate != null && profile.cookCompletionRate < 0.5) {
    insights.push("調理完了まで至らない日が多めです");
  }
  return [...new Set(insights)].slice(0, 10);
}

/**
 * 現在のローカルデータから家庭学習プロファイルを再計算する。
 */
export function computeFamilyLearningProfile(
  householdId = "local",
): FamilyLearningProfile {
  const feedbacks = loadCookingFeedbacks().filter(
    (f) => f.householdId === householdId || f.householdId === "local",
  );
  const history = loadCookingHistory().filter(
    (h) => h.householdId === householdId || h.householdId === "local",
  );
  const recipes = loadRecipes();
  const profiles = loadFamilyMemberProfiles().filter(
    (p) => p.householdId === householdId || p.householdId === "local",
  );
  const changes = loadMealChangeEvents().filter(
    (e) => e.householdId === householdId || e.householdId === "local",
  );

  const cooks = collectRatedCooks(feedbacks, history, recipes);
  if (cooks.length === 0 && changes.length === 0) {
    return EMPTY_FAMILY_LEARNING_PROFILE(householdId);
  }

  const favoriteCuisine = buildCuisineStats(cooks);
  const favoriteWeekday = buildWeekdayStats(cooks);
  const favoriteIngredients = buildIngredientStats(cooks);
  const memberLearning = buildMemberLearning(
    cooks,
    profiles.map((p) => ({ id: p.id, displayName: p.displayName })),
  );

  // 成功した調理時間
  const successTimes = cooks
    .filter((c) => (c.rating ?? 0) >= 4)
    .map((c) => c.durationMinutes ?? c.recipe?.cookingTimeMinutes)
    .filter((t): t is number => t != null);
  const favoriteCookingTime =
    successTimes.length >= 2
      ? {
          maxMinutes: Math.round(
            successTimes.sort((a, b) => a - b)[
              Math.floor(successTimes.length * 0.7)
            ]!,
          ),
          avgRating: avg(
            cooks
              .filter((c) => (c.rating ?? 0) >= 4)
              .map((c) => c.rating!)
          ) ?? 4,
          count: successTimes.length,
        }
      : null;

  const easyCount = cooks.filter(
    (c) => (c.recipe?.cookingTimeMinutes ?? 99) <= 25 && (c.rating ?? 0) >= 4,
  ).length;
  const hardCount = cooks.filter(
    (c) => (c.recipe?.cookingTimeMinutes ?? 0) >= 45 && (c.rating ?? 0) >= 4,
  ).length;
  const favoriteDifficulty: FamilyLearningProfile["favoriteDifficulty"] =
    easyCount >= hardCount + 2
      ? "easy"
      : hardCount >= easyCount + 2
        ? "elaborate"
        : cooks.length >= 3
          ? "normal"
          : null;

  const seasonCounts = new Map<string, number>();
  for (const cook of cooks) {
    if ((cook.rating ?? 0) < 4) continue;
    const s = seasonFromDate(cook.cookedAt);
    seasonCounts.set(s, (seasonCounts.get(s) ?? 0) + 1);
  }
  const favoriteSeason =
    [...seasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const favoriteMealStyle = favoriteCuisine
    .filter((c) => c.avgRating >= 3.8)
    .map((c) => c.name)
    .slice(0, 4);

  const successfulPatterns = buildPatterns(
    favoriteCuisine,
    favoriteWeekday,
    memberLearning,
    cooks,
  );
  const avoidedPatterns = buildAvoided(cooks);

  const thick = cooks.filter((c) =>
    c.tags.some((t) => t.startsWith("taste_thick") || t === "taste_thick"),
  ).length;
  const thin = cooks.filter((c) =>
    c.tags.some((t) => t.startsWith("taste_thin") || t === "taste_thin"),
  ).length;
  const tagged = cooks.filter((c) => c.tags.length > 0).length || 1;

  // 変更で外されたレシピ
  const awayCounts = new Map<string, number>();
  for (const change of changes) {
    if (!change.fromRecipeId) continue;
    awayCounts.set(
      change.fromRecipeId,
      (awayCounts.get(change.fromRecipeId) ?? 0) + 1,
    );
  }
  const changeAwayRecipeIds = [...awayCounts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, 20);

  // 調理完了率: history がある日 / 献立にレシピがあったかは近似で history/feedback 比率
  // 簡易: wantAgain や rating がある = 完了とみなす。サンプル少ない場合 null
  const cookCompletionRate =
    cooks.length >= 4
      ? Math.round(
          (cooks.filter((c) => c.rating != null || c.wantAgain != null).length /
            cooks.length) *
            100,
        ) / 100
      : null;

  const base: Omit<FamilyLearningProfile, "insights"> = {
    householdId,
    updatedAt: new Date().toISOString(),
    sampleCount: cooks.length,
    favoriteCuisine,
    favoriteCookingTime,
    favoriteDifficulty,
    favoriteIngredients,
    favoriteSeason,
    favoriteWeekday,
    favoriteMealStyle,
    successfulPatterns,
    memberLearning,
    avoidedPatterns,
    cookCompletionRate,
    changeAwayRecipeIds,
    tasteThickRate: Math.round((thick / tagged) * 100) / 100,
    tasteThinRate: Math.round((thin / tagged) * 100) / 100,
  };

  return {
    ...base,
    insights: buildInsights(base, cooks),
  };
}

/** 週間スケジュールから当日の担当者IDを推定 */
export function resolveCookMemberIdForDate(
  date: string,
  householdId = "local",
): string | null {
  const day = dayKeyFromDate(date);
  if (!day) return null;
  const schedules = loadWeeklyCookingSchedules().filter(
    (s) => s.householdId === householdId || s.householdId === "local",
  );
  return (
    schedules.find((s) => s.dayOfWeek === day)?.defaultCookMemberId ?? null
  );
}
