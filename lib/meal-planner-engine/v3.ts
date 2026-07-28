import { evaluateRecipeHardConstraints } from "@/lib/allergy/check";
import { scoreRecipeForConditions } from "@/lib/meal-planner-engine/condition-rules";
import {
  buildDayRecommendation,
  createEmptyProteinCounts,
  scoreRecipeCandidate,
  type WeekCategoryFlags,
  type WeekProteinCounts,
} from "@/lib/meal-planner-engine/score";
import type { ScoredRecipeCandidate } from "@/lib/meal-planner-engine/types";
import {
  isCurryOrStew,
  isDonburiDish,
  isFriedDish,
  isNoodleDish,
} from "@/lib/recipe-nutrition";
import { evaluateMealSetCompatibility } from "@/lib/meal-planner-engine/meal-set";
import { getCachedRecipeNutrition } from "@/lib/nutrition/calculate";
import { AUTO_FILL_COURSES } from "@/types/course";
import type { AutoFillMode, DailyConditionOption } from "@/types/daily-condition";
import type { DietaryRestriction } from "@/types/family-member-profile";
import type { FoodIngredientMaster } from "@/types/food-master";
import type { InventoryItem } from "@/types/inventory";
import type { DayMeal, MealDishItem } from "@/types/meal-plan";
import type { HouseholdPreferences } from "@/types/meal-preferences";
import type { Recipe } from "@/types/recipe";
import type { RecipeCourse } from "@/types/course";
import { evaluateCandidateAgainstMealSet } from "@/lib/meal-planner-engine/meal-set";

export type MealCombinationEvaluation = {
  score: number;
  reasons: string[];
  warnings: string[];
};

export type ProposedDayMeal = {
  date: string;
  items: MealDishItem[];
  evaluation: MealCombinationEvaluation;
  recommendation: {
    score: number;
    stars: number;
    reasons: string[];
  };
};

export type MealPlanProposal = {
  id: string;
  weekStart: string;
  mode: AutoFillMode;
  days: ProposedDayMeal[];
  createdAt: string;
};

export type OptimizeContext = {
  recipes: Recipe[];
  inventory: InventoryItem[];
  preferences: HouseholdPreferences;
  recentRecipeIds: string[];
  allergies: string[];
  dietaryRestrictions: DietaryRestriction[];
  conditionsByDate: Record<string, DailyConditionOption[]>;
  mode: AutoFillMode;
  foodMasters: FoodIngredientMaster[];
  cookingTimeLimit?: number;
};

function modeWeight(mode: AutoFillMode, recipe: Recipe): { points: number; reason: string | null } {
  switch (mode) {
    case "時短重視":
      return recipe.cookingTimeMinutes != null && recipe.cookingTimeMinutes <= 25
        ? { points: 20, reason: "時短重視で選びました" }
        : { points: -10, reason: null };
    case "冷蔵庫優先":
      return { points: 0, reason: null };
    case "節約重視":
      return recipe.tags.includes("節約")
        ? { points: 15, reason: "節約重視で選びました" }
        : { points: 0, reason: null };
    case "高たんぱく":
      return (recipe.protein ?? 0) >= 20 || recipe.proteinType === "鶏" || recipe.proteinType === "魚"
        ? { points: 18, reason: "高たんぱくを意識しました" }
        : { points: 0, reason: null };
    case "野菜多め":
      return (recipe.vegetables ?? 0) >= 80 || recipe.tags.includes("野菜たっぷり")
        ? { points: 18, reason: "野菜多めを意識しました" }
        : { points: 0, reason: null };
    case "減塩":
      return recipe.salt != null && recipe.salt <= 1.5
        ? { points: 15, reason: "減塩を意識しました" }
        : { points: (recipe.salt ?? 0) > 3 ? -15 : 0, reason: null };
    case "家族の好み重視":
      return (recipe.favoriteScore ?? 0) >= 4
        ? { points: 16, reason: "家族の好みが高い料理です" }
        : { points: 0, reason: null };
    default:
      return { points: 0, reason: null };
  }
}

function filterHardConstraints(
  recipes: Recipe[],
  allergies: string[],
  restrictions: DietaryRestriction[],
  cookingTimeLimit: number,
): Recipe[] {
  return recipes.filter((recipe) => {
    const check = evaluateRecipeHardConstraints(recipe, allergies, restrictions);
    if (check.blocked) {
      return false;
    }
    if (
      recipe.cookingTimeMinutes != null &&
      recipe.cookingTimeMinutes > cookingTimeLimit
    ) {
      return false;
    }
    return true;
  });
}

/**
 * 1日の料理組み合わせを評価（セット相性・炭水化物偏り等）
 */
export function evaluateMealCombination(
  recipes: Recipe[],
  context: { conditions: DailyConditionOption[]; mode: AutoFillMode },
): MealCombinationEvaluation {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 50;

  const setEval = evaluateMealSetCompatibility(recipes);
  score += setEval.points;
  reasons.push(...setEval.reasons);
  warnings.push(...setEval.warnings);
  if (setEval.incompatible) {
    score -= 15;
  }

  const carbsHeavy = recipes.filter(
    (recipe) =>
      isDonburiDish(recipe) ||
      isCurryOrStew(recipe) ||
      /じゃがいも|ポテト|肉じゃが/.test(recipe.name),
  ).length;
  if (carbsHeavy >= 2) {
    score -= 25;
    warnings.push("いも・炭水化物に偏りやすい組み合わせです");
  } else {
    score += 8;
  }

  const hasFish = recipes.some((recipe) => recipe.proteinType === "魚");
  const hasVeg = recipes.some(
    (recipe) => (recipe.vegetables ?? 0) >= 50 || recipe.course === "副菜",
  );
  const hasSoup = recipes.some((recipe) => recipe.course === "汁物");

  if (hasFish) {
    score += 12;
    reasons.push("今日は魚料理が不足しがちなので選びました");
  }
  if (hasVeg) {
    score += 10;
    reasons.push("野菜を補える組み合わせです");
  }
  if (hasSoup) {
    score += 6;
  }

  const friedCount = recipes.filter((recipe) => isFriedDish(recipe)).length;
  if (friedCount >= 2) {
    score -= 20;
    warnings.push("揚げ物が重なっています");
  }

  const totalTime = recipes.reduce(
    (sum, recipe) => sum + (recipe.cookingTimeMinutes ?? 0),
    0,
  );
  if (totalTime > 0 && totalTime <= 45) {
    score += 8;
    reasons.push(`約${totalTime}分で作れます`);
  }

  for (const recipe of recipes) {
    for (const delta of scoreRecipeForConditions(recipe, context.conditions)) {
      score += delta.points;
      if (delta.points > 0) {
        reasons.push(delta.reason);
      } else if (delta.points < 0) {
        warnings.push(delta.reason);
      }
    }
    const mw = modeWeight(context.mode, recipe);
    score += mw.points;
    if (mw.reason) {
      reasons.push(mw.reason);
    }
  }

  const uniqueReasons = [...new Set(reasons)].slice(0, 5);
  const uniqueWarnings = [...new Set(warnings)].slice(0, 4);

  return { score, reasons: uniqueReasons, warnings: uniqueWarnings };
}

function pickBest(
  candidates: ScoredRecipeCandidate[],
): ScoredRecipeCandidate | null {
  if (candidates.length === 0) {
    return null;
  }
  // セットとして不自然な候補は、互換候補があるとき除外する
  const compatible = candidates.filter(
    (item) => (item.breakdown.setIncompatible ?? 0) === 0,
  );
  const pool = compatible.length > 0 ? compatible : candidates;
  const sorted = [...pool].sort((a, b) => b.score - a.score);
  const top = sorted.filter((item) => item.score === sorted[0].score);
  top.sort((a, b) => a.recipe.id.localeCompare(b.recipe.id));
  return top[0] ?? null;
}

export function optimizeDayMeal(
  date: string,
  existing: DayMeal,
  usedRecipeIds: Set<string>,
  weekProtein: WeekProteinCounts,
  weekFlags: WeekCategoryFlags,
  context: OptimizeContext,
  previous: DayMeal | null,
): ProposedDayMeal | null {
  if (existing.locked || existing.items.length > 0) {
    return null;
  }

  const cookingLimit =
    context.cookingTimeLimit ?? context.preferences.cookingTimeLimit;
  const allowed = filterHardConstraints(
    context.recipes,
    context.allergies,
    context.dietaryRestrictions,
    cookingLimit,
  );

  const previousMain = previous?.items.find((item) => item.course === "主菜");
  const previousRecipe = previousMain?.recipeId
    ? context.recipes.find((recipe) => recipe.id === previousMain.recipeId)
    : null;

  const items: MealDishItem[] = [];
  const pickedRecipes: Recipe[] = [];
  const scoredPicks: { score: number; reasons: string[]; recipe: Recipe }[] = [];
  const daySoFar = {
    calories: 0,
    protein: 0,
    fat: 0,
    salt: 0,
    vegetables: 0,
  };

  for (const course of AUTO_FILL_COURSES) {
    const pool = allowed.filter((recipe) => recipe.course === course);
    const candidatesPool = pool.length > 0 ? pool : allowed;

    const scored = candidatesPool.map((recipe) => {
      const base = scoreRecipeCandidate(recipe, {
        course,
        date,
        preferences: context.preferences,
        inventory: context.inventory,
        recentRecipeIds: context.recentRecipeIds,
        usedRecipeIds,
        previousMainProtein: previousRecipe?.proteinType ?? null,
        previousRecipeIds: new Set(
          previous?.items
            .map((item) => item.recipeId)
            .filter((id): id is string => Boolean(id)) ?? [],
        ),
        previousWasFried: previous
          ? previous.items.some((item) => {
              const r = context.recipes.find((entry) => entry.id === item.recipeId);
              return r ? isFriedDish(r) : false;
            })
          : false,
        previousWasNoodle: previous
          ? previous.items.some((item) => {
              const r = context.recipes.find((entry) => entry.id === item.recipeId);
              return r ? isNoodleDish(r) : false;
            })
          : false,
        weekProtein,
        weekFlags,
        daySoFar,
        foodMasters: context.foodMasters,
      });

      const conditionDeltas = scoreRecipeForConditions(
        recipe,
        context.conditionsByDate[date] ?? [context.preferences.conditionMode as DailyConditionOption].filter(Boolean),
      );
      let extra = conditionDeltas.reduce((sum, d) => sum + d.points, 0);
      const mw = modeWeight(context.mode, recipe);
      extra += mw.points;
      const reasons = [
        ...base.reasons,
        ...conditionDeltas.filter((d) => d.points > 0).map((d) => d.reason),
      ];
      if (mw.reason) {
        reasons.push(mw.reason);
      }
      if (
        previousRecipe &&
        isFriedDish(previousRecipe) &&
        !isFriedDish(recipe)
      ) {
        reasons.push("昨日が揚げ物だったため、今日は別の調理法を選びました");
        extra += 8;
      }

      const setFit = evaluateCandidateAgainstMealSet(pickedRecipes, recipe);
      extra += setFit.points;
      if (setFit.points > 0) {
        reasons.push(...setFit.reasons);
      }
      if (setFit.incompatible) {
        reasons.push(...setFit.warnings.slice(0, 1));
      }

      return {
        ...base,
        score: base.score + extra,
        reasons: [...new Set(reasons)].slice(0, 6),
        breakdown: {
          ...base.breakdown,
          mealSet: setFit.points,
          setIncompatible: setFit.incompatible ? 1 : 0,
        },
      };
    });

    const best = pickBest(scored);
    if (!best) {
      continue;
    }

    usedRecipeIds.add(best.recipe.id);
    pickedRecipes.push(best.recipe);
    daySoFar.calories += best.recipe.calories ?? 0;
    daySoFar.protein += best.recipe.protein ?? 0;
    daySoFar.fat += best.recipe.fat ?? 0;
    daySoFar.salt += best.recipe.salt ?? 0;
    daySoFar.vegetables += best.recipe.vegetables ?? 0;
    if (best.recipe.proteinType) {
      weekProtein[best.recipe.proteinType] += 1;
    }
    if (isCurryOrStew(best.recipe)) weekFlags.curryOrStew += 1;
    if (isDonburiDish(best.recipe)) weekFlags.donburi += 1;

    items.push({
      id: crypto.randomUUID(),
      recipeId: best.recipe.id,
      course: course as RecipeCourse,
      order: items.length + 1,
      customName: null,
      source: "auto",
      engineScore: best.score,
      engineReasons: best.reasons,
    });
    scoredPicks.push({
      score: best.score,
      reasons: best.reasons,
      recipe: best.recipe,
    });
  }

  if (items.length === 0) {
    return null;
  }

  const conditions =
    context.conditionsByDate[date] ??
    ([context.preferences.conditionMode].filter(Boolean) as DailyConditionOption[]);
  const evaluation = evaluateMealCombination(pickedRecipes, {
    conditions,
    mode: context.mode,
  });
  const recommendation = buildDayRecommendation(scoredPicks);
  recommendation.reasons = [
    ...new Set([...evaluation.reasons, ...recommendation.reasons]),
  ].slice(0, 5);

  // 栄養計算の注意
  if (context.foodMasters.length > 0) {
    const uncalc = pickedRecipes.some((recipe) => {
      const n = getCachedRecipeNutrition(recipe, {
        masters: context.foodMasters,
      });
      return n.uncalculatedIngredientCount > 0;
    });
    if (uncalc) {
      evaluation.warnings.push("栄養値の一部は未計算です（適量・未登録材料など）");
    }
  }

  return {
    date,
    items,
    evaluation,
    recommendation: {
      ...recommendation,
      score: recommendation.score + evaluation.score,
    },
  };
}

export function optimizeWeeklyMealPlan(
  weekStart: string,
  days: DayMeal[],
  context: OptimizeContext,
): MealPlanProposal {
  const usedRecipeIds = new Set<string>();
  const weekProtein = createEmptyProteinCounts();
  const weekFlags: WeekCategoryFlags = { curryOrStew: 0, donburi: 0 };

  for (const day of days) {
    for (const item of day.items) {
      if (item.recipeId) usedRecipeIds.add(item.recipeId);
    }
  }

  const proposedDays: ProposedDayMeal[] = [];
  days.forEach((day, index) => {
    const previous = index > 0 ? days[index - 1] : null;
    // 既存日も protein 集計
    for (const item of day.items) {
      const recipe = context.recipes.find((r) => r.id === item.recipeId);
      if (recipe?.proteinType) weekProtein[recipe.proteinType] += 1;
      if (recipe && isCurryOrStew(recipe)) weekFlags.curryOrStew += 1;
      if (recipe && isDonburiDish(recipe)) weekFlags.donburi += 1;
    }

    const proposed = optimizeDayMeal(
      day.date,
      day,
      usedRecipeIds,
      weekProtein,
      weekFlags,
      context,
      previous,
    );
    if (proposed) {
      proposedDays.push(proposed);
    }
  });

  return {
    id: crypto.randomUUID(),
    weekStart,
    mode: context.mode,
    days: proposedDays,
    createdAt: new Date().toISOString(),
  };
}

export function applyProposalToDays(
  days: DayMeal[],
  proposal: MealPlanProposal,
): DayMeal[] {
  const byDate = new Map(proposal.days.map((day) => [day.date, day]));
  return days.map((day) => {
    const proposed = byDate.get(day.date);
    if (!proposed || day.locked || day.items.length > 0) {
      return day;
    }
    return {
      ...day,
      // v4 が付与した余り食材の一致情報も、献立保存時まで保持する。
      items: proposed.items.map((item) => ({
        ...item,
        matchedLeftoverIds: item.matchedLeftoverIds
          ? [...item.matchedLeftoverIds]
          : undefined,
      })),
      recommendation: {
        score: proposed.recommendation.score,
        stars: proposed.recommendation.stars,
        reasons: [
          ...proposed.recommendation.reasons,
          ...proposed.evaluation.warnings.map((w) => `注意: ${w}`),
        ].slice(0, 6),
      },
    };
  });
}
