import { AUTO_FILL_COURSES } from "@/types/course";
import type { DayMeal, MealDishItem } from "@/types/meal-plan";
import type { ProteinType } from "@/types/recipe-nutrition";
import type { Recipe } from "@/types/recipe";
import {
  isCurryOrStew,
  isDonburiDish,
  isFriedDish,
  isNoodleDish,
} from "@/lib/recipe-nutrition";
import {
  buildDayRecommendation,
  createEmptyProteinCounts,
  scoreRecipeCandidate,
  type WeekCategoryFlags,
  type WeekProteinCounts,
} from "@/lib/meal-planner-engine/score";
import type {
  MealPlannerAiContext,
  MealPlannerEngine,
  MealPlannerEngineInput,
  MealPlannerEngineResult,
  PlannedDayMeal,
  ScoredRecipeCandidate,
} from "@/lib/meal-planner-engine/types";

function getMainProtein(recipes: Recipe[], items: MealDishItem[]): ProteinType | null {
  const mains = items
    .filter((item) => item.course === "主菜" && item.recipeId)
    .map((item) => recipes.find((recipe) => recipe.id === item.recipeId))
    .filter((recipe): recipe is Recipe => Boolean(recipe));
  return mains[0]?.proteinType ?? null;
}

function dayRecipeIds(items: MealDishItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.recipeId) {
      ids.add(item.recipeId);
    }
  }
  return ids;
}

function dayHasFried(recipes: Recipe[], items: MealDishItem[]): boolean {
  return items.some((item) => {
    const recipe = recipes.find((entry) => entry.id === item.recipeId);
    return recipe ? isFriedDish(recipe) : false;
  });
}

function dayHasNoodle(recipes: Recipe[], items: MealDishItem[]): boolean {
  return items.some((item) => {
    const recipe = recipes.find((entry) => entry.id === item.recipeId);
    return recipe ? isNoodleDish(recipe) : false;
  });
}

function accumulateWeekFromDay(
  recipes: Recipe[],
  items: MealDishItem[],
  protein: WeekProteinCounts,
  flags: WeekCategoryFlags,
): void {
  for (const item of items) {
    if (!item.recipeId) {
      continue;
    }
    const recipe = recipes.find((entry) => entry.id === item.recipeId);
    if (!recipe) {
      continue;
    }
    if (recipe.proteinType) {
      protein[recipe.proteinType] += 1;
    }
    if (isCurryOrStew(recipe)) {
      flags.curryOrStew += 1;
    }
    if (isDonburiDish(recipe)) {
      flags.donburi += 1;
    }
  }
}

function pickBestCandidate(
  candidates: ScoredRecipeCandidate[],
): ScoredRecipeCandidate | null {
  if (candidates.length === 0) {
    return null;
  }
  const sorted = [...candidates].sort((left, right) => right.score - left.score);
  const topScore = sorted[0].score;
  const top = sorted.filter((item) => item.score === topScore);
  // 同点は安定のため id 順で決定的に選ぶ（SSR/再実行の差を抑える）
  top.sort((left, right) => left.recipe.id.localeCompare(right.recipe.id));
  return top[0] ?? null;
}

function planBlankDay(
  input: MealPlannerEngineInput,
  day: DayMeal,
  dayIndex: number,
  usedRecipeIds: Set<string>,
  weekProtein: WeekProteinCounts,
  weekFlags: WeekCategoryFlags,
): PlannedDayMeal | null {
  const previous = dayIndex > 0 ? input.days[dayIndex - 1] : null;
  const previousMainProtein = previous
    ? getMainProtein(input.recipes, previous.items)
    : null;
  const previousRecipeIds = previous
    ? dayRecipeIds(previous.items)
    : new Set<string>();
  const previousWasFried = previous
    ? dayHasFried(input.recipes, previous.items)
    : false;
  const previousWasNoodle = previous
    ? dayHasNoodle(input.recipes, previous.items)
    : false;

  const items: MealDishItem[] = [];
  const scoredPicks: {
    score: number;
    reasons: string[];
    recipe: Recipe;
  }[] = [];
  const candidatesByCourse: Record<string, ScoredRecipeCandidate[]> = {};

  const daySoFar = {
    calories: 0,
    protein: 0,
    fat: 0,
    salt: 0,
    vegetables: 0,
  };

  for (const course of AUTO_FILL_COURSES) {
    const byCourse = input.recipes.filter((recipe) => recipe.course === course);
    const pool = byCourse.length > 0 ? byCourse : input.recipes;

    const scored = pool.map((recipe) =>
      scoreRecipeCandidate(recipe, {
        course,
        date: day.date,
        preferences: input.preferences,
        inventory: input.inventory,
        recentRecipeIds: input.recentRecipeIds,
        usedRecipeIds,
        previousMainProtein,
        previousRecipeIds,
        previousWasFried,
        previousWasNoodle,
        weekProtein,
        weekFlags,
        daySoFar,
      }),
    );

    candidatesByCourse[course] = [...scored]
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);

    const best = pickBestCandidate(scored);
    if (!best) {
      continue;
    }

    usedRecipeIds.add(best.recipe.id);
    daySoFar.calories += best.recipe.calories ?? 0;
    daySoFar.protein += best.recipe.protein ?? 0;
    daySoFar.fat += best.recipe.fat ?? 0;
    daySoFar.salt += best.recipe.salt ?? 0;
    daySoFar.vegetables += best.recipe.vegetables ?? 0;

    if (best.recipe.proteinType) {
      weekProtein[best.recipe.proteinType] += 1;
    }
    if (isCurryOrStew(best.recipe)) {
      weekFlags.curryOrStew += 1;
    }
    if (isDonburiDish(best.recipe)) {
      weekFlags.donburi += 1;
    }

    items.push({
      id: crypto.randomUUID(),
      recipeId: best.recipe.id,
      course,
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

  const recommendation = buildDayRecommendation(scoredPicks);

  return {
    date: day.date,
    items,
    recommendation,
    candidatesByCourse,
  };
}

function createRulesEngine(): MealPlannerEngine {
  return {
    planWeek(input: MealPlannerEngineInput): MealPlannerEngineResult {
      const usedRecipeIds = new Set<string>();
      const weekProtein = createEmptyProteinCounts();
      const weekFlags: WeekCategoryFlags = { curryOrStew: 0, donburi: 0 };

      // 既存の固定・入力済み日から週間カウントを初期化
      for (const day of input.days) {
        for (const item of day.items) {
          if (item.recipeId) {
            usedRecipeIds.add(item.recipeId);
          }
        }
        accumulateWeekFromDay(input.recipes, day.items, weekProtein, weekFlags);
      }

      const planned: PlannedDayMeal[] = [];
      let filledCount = 0;
      let priorityUsedCount = 0;

      const nextDays = input.days.map((day, dayIndex) => {
        if (day.locked || day.items.length > 0) {
          return day;
        }

        const result = planBlankDay(
          input,
          day,
          dayIndex,
          usedRecipeIds,
          weekProtein,
          weekFlags,
        );
        if (!result) {
          return day;
        }

        planned.push(result);
        filledCount += 1;
        const usedFridge = result.recommendation.reasons.some((reason) =>
          reason.includes("冷蔵庫"),
        );
        if (usedFridge) {
          priorityUsedCount += 1;
        }

        return {
          ...day,
          items: result.items,
          recommendation: result.recommendation,
        };
      });

      const aiContext: MealPlannerAiContext = {
        version: "v2-rules",
        preferences: input.preferences,
        selectedDays: planned,
        notes: [
          "ルールベース採点結果です。将来ここを OpenAI に渡し、改善案を生成できます。",
        ],
      };

      return {
        days: nextDays,
        filledCount,
        priorityUsedCount,
        planned,
        aiContext,
      };
    },
  };
}

/** 献立エンジン v2（ルールベース＋スコアリング） */
export const mealPlannerEngine: MealPlannerEngine = createRulesEngine();
