/**
 * 今日ホーム用の夕食ダッシュボード。
 * 「今日の夕食を作る」に必要な情報だけを集約する。
 */
import { loadCookingHistory } from "@/lib/cooking-history";
import { getDishLabel } from "@/lib/meal-plans";
import { loadCookingFeedbacks } from "@/lib/recipe-learning/cooking-feedbacks";
import {
  FALLBACK_DEFAULT_MEAL_SERVINGS,
  loadDefaultMealServings,
  resolveDayServings,
} from "@/lib/servings/resolve";
import { isCookDone } from "@/lib/today/cook-done";
import {
  aggregateDaySelectionReasons,
  selectionReasonFromLegacyStrings,
} from "@/lib/weekly-auto-plan/explain";
import type { RecipeCourse } from "@/types/course";
import type { MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import type { CookingFeedback } from "@/types/recipe-learning";
import type { CookingHistory } from "@/types/weekly-lifestyle";
import type { MealSelectionReason } from "@/types/meal-decision-explanation";

/** ホーム用レビュー状態 */
export type TodayReviewStatus = "pending" | "ready" | "done";

export type TodayDish = {
  mealItemId: string;
  recipeId: string | null;
  title: string;
  course: RecipeCourse;
  cookingTimeMinutes: number | null;
  cookHref: string | null;
};

export type TodayPrimaryCook = {
  recipeId: string;
  mealItemId: string;
  title: string;
  cookHref: string;
  servings: number;
  cookingTimeMinutes: number | null;
  recipeServings: number | null;
  recipeServingsKnown: boolean;
};

export type TodayReviewSummary = {
  overallRating: number | null;
  wantAgain: boolean | null;
  memo: string | null;
  improvementTags: string[];
};

export type TodayDecisionReasons = {
  messages: string[];
  details: import("@/types/meal-decision-explanation").MealDecisionExplanation[];
};

export type TodayDashboard = {
  date: string;
  dishes: TodayDish[];
  /** 日別献立人数 */
  servings: number | null;
  servingsIsCustom: boolean;
  defaultMealServings: number;
  /** 各品の調理時間の最大（分） */
  cookingTimeMinutes: number | null;
  /** 主菜優先の調理先。レシピ無しなら null */
  primaryCook: TodayPrimaryCook | null;
  reviewStatus: TodayReviewStatus;
  /** 当日フィードバックがある場合の要約 */
  reviewSummary: TodayReviewSummary | null;
  /** 今日の献立になった理由 */
  decisionReasons: TodayDecisionReasons | null;
};

export type TodayDashboardInput = {
  date: string;
  weekStart: string;
  mealPlan: MealPlan | null;
  recipes: Recipe[];
  defaultMealServings?: number;
  feedbacks?: CookingFeedback[];
  cookingHistory?: CookingHistory[];
  /**
   * 調理完了フラグ。未指定時はブラウザ localStorage を参照。
   * テストでは明示的に渡す。
   */
  cookDoneByRecipeId?: Record<string, boolean>;
};

const COURSE_PRIORITY: RecipeCourse[] = [
  "主菜",
  "主食",
  "副菜",
  "汁物",
  "デザート",
  "飲み物",
  "その他",
];

function courseSortIndex(course: RecipeCourse): number {
  const index = COURSE_PRIORITY.indexOf(course);
  return index >= 0 ? index : COURSE_PRIORITY.length;
}

function feedbackOnDate(
  feedbacks: CookingFeedback[],
  recipeId: string,
  date: string,
): CookingFeedback | null {
  const matches = feedbacks
    .filter(
      (f) => f.recipeId === recipeId && f.cookedAt.slice(0, 10) === date,
    )
    .sort((a, b) => b.cookedAt.localeCompare(a.cookedAt));
  return matches[0] ?? null;
}

function historyOnDate(
  history: CookingHistory[],
  recipeId: string,
  date: string,
): boolean {
  return history.some(
    (h) => h.recipeId === recipeId && h.cookedAt.slice(0, 10) === date,
  );
}

function resolveCookDone(
  date: string,
  recipeId: string,
  cookDoneByRecipeId: Record<string, boolean> | undefined,
): boolean {
  if (cookDoneByRecipeId && recipeId in cookDoneByRecipeId) {
    return cookDoneByRecipeId[recipeId] === true;
  }
  return isCookDone(date, recipeId);
}

export function pickPrimaryDish(dishes: TodayDish[]): TodayDish | null {
  const withRecipe = dishes.filter((d) => d.recipeId && d.cookHref);
  if (withRecipe.length === 0) return null;
  const sorted = [...withRecipe].sort(
    (a, b) => courseSortIndex(a.course) - courseSortIndex(b.course),
  );
  return sorted[0] ?? null;
}

export function buildTodayDashboard(input: TodayDashboardInput): TodayDashboard {
  const recipes = input.recipes;
  const feedbacks = input.feedbacks ?? [];
  const history = input.cookingHistory ?? [];
  const defaultMealServings =
    input.defaultMealServings ??
    (typeof window !== "undefined"
      ? loadDefaultMealServings()
      : FALLBACK_DEFAULT_MEAL_SERVINGS);
  const day = input.mealPlan?.days.find((d) => d.date === input.date);
  const dayItems = day?.items ?? [];
  const resolvedServings = day
    ? resolveDayServings(day, defaultMealServings)
    : {
        servings: defaultMealServings,
        mode: "default" as const,
        isCustom: false,
      };

  const dishes: TodayDish[] = [...dayItems]
    .sort((a, b) => a.order - b.order)
    .map((item) => {
      const recipe = item.recipeId
        ? recipes.find((r) => r.id === item.recipeId) ?? null
        : null;
      return {
        mealItemId: item.id,
        recipeId: item.recipeId,
        title: getDishLabel(item, recipes),
        course: item.course,
        cookingTimeMinutes: recipe?.cookingTimeMinutes ?? null,
        cookHref: item.recipeId
          ? `/recipes/${item.recipeId}/cook?date=${input.date}&mealItemId=${item.id}`
          : null,
      };
    });

  const primaryDish = pickPrimaryDish(dishes);
  let primaryCook: TodayPrimaryCook | null = null;
  if (primaryDish?.recipeId && primaryDish.cookHref) {
    const recipe = recipes.find((r) => r.id === primaryDish.recipeId);
    const recipeServingsKnown =
      typeof recipe?.servings === "number" && recipe.servings > 0;
    primaryCook = {
      recipeId: primaryDish.recipeId,
      mealItemId: primaryDish.mealItemId,
      title: primaryDish.title,
      cookHref: primaryDish.cookHref,
      servings: resolvedServings.servings,
      cookingTimeMinutes: primaryDish.cookingTimeMinutes,
      recipeServings: recipeServingsKnown ? recipe!.servings : null,
      recipeServingsKnown,
    };
  }

  const times = dishes
    .map((d) => d.cookingTimeMinutes)
    .filter((t): t is number => t != null);
  const cookingTimeMinutes = times.length > 0 ? Math.max(...times) : null;

  let reviewStatus: TodayReviewStatus = "pending";
  let reviewSummary: TodayReviewSummary | null = null;

  if (primaryCook) {
    const feedback = feedbackOnDate(
      feedbacks,
      primaryCook.recipeId,
      input.date,
    );
    if (feedback) {
      reviewStatus = "done";
      reviewSummary = {
        overallRating: feedback.overallRating,
        wantAgain: feedback.wantAgain,
        memo: feedback.memo,
        improvementTags: feedback.improvementTags,
      };
    } else {
      const done =
        resolveCookDone(
          input.date,
          primaryCook.recipeId,
          input.cookDoneByRecipeId,
        ) || historyOnDate(history, primaryCook.recipeId, input.date);
      reviewStatus = done ? "ready" : "pending";
    }
  }

  const daySelections: MealSelectionReason[] = [];
  for (const item of dayItems) {
    if (item.decisionExplanation) {
      daySelections.push(item.decisionExplanation);
    } else if (
      (item.selectionReasons && item.selectionReasons.length > 0) ||
      (item.engineReasons && item.engineReasons.length > 0)
    ) {
      daySelections.push(
        selectionReasonFromLegacyStrings(
          [
            ...(item.selectionReasons ?? []),
            ...(item.engineReasons ?? []),
          ],
          item.engineScore ?? 60,
        ),
      );
    }
  }
  const aggregated = aggregateDaySelectionReasons(
    daySelections,
    day?.recommendation?.reasons ?? [],
  );
  const decisionReasons: TodayDecisionReasons | null =
    aggregated.messages.length > 0
      ? {
          messages: aggregated.messages,
          details: day?.recommendation?.decisionDetails?.length
            ? day.recommendation.decisionDetails
            : aggregated.details,
        }
      : null;

  return {
    date: input.date,
    dishes,
    servings: day ? resolvedServings.servings : null,
    servingsIsCustom: resolvedServings.isCustom,
    defaultMealServings,
    cookingTimeMinutes,
    primaryCook,
    reviewStatus,
    reviewSummary,
    decisionReasons,
  };
}

/** クライアント向け: ローカルストアから不足分を補って集計 */
export function buildTodayDashboardFromLocal(
  input: Omit<
    TodayDashboardInput,
    "feedbacks" | "cookingHistory" | "defaultMealServings"
  > &
    Partial<
      Pick<
        TodayDashboardInput,
        "feedbacks" | "cookingHistory" | "defaultMealServings"
      >
    >,
): TodayDashboard {
  return buildTodayDashboard({
    ...input,
    defaultMealServings:
      input.defaultMealServings ?? loadDefaultMealServings(),
    feedbacks: input.feedbacks ?? loadCookingFeedbacks(),
    cookingHistory: input.cookingHistory ?? loadCookingHistory(),
  });
}
