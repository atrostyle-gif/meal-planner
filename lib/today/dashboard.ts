/**
 * 今日ホーム用の再集計。
 * 既存の献立・買い物・在庫・予算・健康・学習データを読み取り専用でまとめる。
 */
import { loadCookingHistory } from "@/lib/cooking-history";
import { buildDiabetesMealSupportReport } from "@/lib/diabetes-meal-support/report";
import { loadDiabetesMealSupportSettings } from "@/lib/diabetes-meal-support/settings";
import {
  aggregateImprovementSuggestions,
  buildWeeklyHealthSummaryView,
  type GradeMark,
} from "@/lib/diabetes-meal-support/weekly-summary";
import { loadIngredientPrices } from "@/lib/food-budget/prices";
import { resolveWeekFoodBudget } from "@/lib/food-budget/settings";
import { calculateWeekBudgetSummary } from "@/lib/food-budget/week-cost";
import { getActiveLeftoversForProposal } from "@/lib/leftover-ingredients";
import { getDishLabel } from "@/lib/meal-plans";
import { analyzeIngredientPrices } from "@/lib/price-learning";
import { loadCookingFeedbacks } from "@/lib/recipe-learning/cooking-feedbacks";
import { getPriceLearningStats } from "@/lib/receipt/stats";
import { getReceiptRepository } from "@/lib/receipt/receipt-repository";
import { formatCourseLabel } from "@/types/course";
import type { FoodBudgetSettings } from "@/types/food-budget";
import type { InventoryItem } from "@/types/inventory";
import type { MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import type { ShoppingList } from "@/types/shopping-list";
import type { LeftoverIngredient } from "@/types/leftover-ingredient";
import type { CookingFeedback } from "@/types/recipe-learning";
import type { Receipt } from "@/types/receipt";
import type { IngredientPriceRecord } from "@/types/ingredient-price";
import type { CookingHistory } from "@/types/weekly-lifestyle";
import type { DiabetesMealSupportSettings } from "@/types/diabetes-meal-support";

export type TodayMealCard = {
  mealItemId: string;
  recipeId: string | null;
  title: string;
  courseLabel: string;
  cookingTimeMinutes: number | null;
  /** 完成写真（フィードバック由来）。無ければ null */
  photoDataUrl: string | null;
  cookHref: string | null;
  recipeHref: string | null;
};

export type TodayShoppingPreview = {
  id: string;
  name: string;
  quantityLabel: string;
};

export type TodayIngredientPreview = {
  id: string;
  name: string;
  reason: string;
};

export type TodayBudgetView = {
  weeklyFoodBudgetYen: number | null;
  remainingBudgetYen: number | null;
  estimatedPurchaseCostYen: number | null;
  /** 0〜100。予算未設定時 null */
  progressPercent: number | null;
};

export type TodayHealthView = {
  overall: GradeMark;
  carbohydrates: GradeMark;
  vegetables: GradeMark;
  protein: GradeMark;
  salt: GradeMark;
  weightManagement: GradeMark;
  improvements: string[];
  enabled: boolean;
};

export type TodayWeekSummaryLine = {
  id: string;
  text: string;
};

export type TodayRecentLine = {
  id: string;
  kind: "receipt" | "price" | "feedback" | "family";
  text: string;
};

export type TodayDashboard = {
  date: string;
  tip: string | null;
  meals: TodayMealCard[];
  shopping: {
    items: TodayShoppingPreview[];
    totalUnchecked: number;
  };
  ingredients: TodayIngredientPreview[];
  budget: TodayBudgetView;
  health: TodayHealthView;
  weekSummary: TodayWeekSummaryLine[];
  recent: TodayRecentLine[];
};

export type TodayDashboardInput = {
  date: string;
  weekStart: string;
  mealPlan: MealPlan | null;
  recipes: Recipe[];
  shoppingList: ShoppingList | null;
  inventory: InventoryItem[];
  leftovers?: LeftoverIngredient[];
  priceRecords?: IngredientPriceRecord[];
  budgetSettings: FoodBudgetSettings;
  diabetesSettings?: DiabetesMealSupportSettings;
  feedbacks?: CookingFeedback[];
  cookingHistory?: CookingHistory[];
  receipts?: Receipt[];
};

function carbStatusToGrade(
  status: string | undefined,
): GradeMark {
  if (status === "in_range") return "◎";
  if (status === "over" || status === "under") return "△";
  if (status === "unknown" || status === "no_target") return "—";
  return "—";
}

function saltGrade(saltG: number | null): GradeMark {
  if (saltG == null) return "—";
  if (saltG <= 6) return "◎";
  if (saltG <= 8) return "○";
  return "△";
}

function overallFromMarks(marks: GradeMark[]): GradeMark {
  const score = (m: GradeMark): number => {
    if (m === "◎") return 3;
    if (m === "○") return 2;
    if (m === "△") return 1;
    return 0;
  };
  const valid = marks.filter((m) => m !== "—");
  if (valid.length === 0) return "—";
  const avg =
    valid.reduce((sum, m) => sum + score(m), 0) / valid.length;
  if (avg >= 2.5) return "◎";
  if (avg >= 1.5) return "○";
  return "△";
}

function latestPhotoForRecipe(
  recipeId: string,
  feedbacks: CookingFeedback[],
): string | null {
  const withPhoto = feedbacks
    .filter((f) => f.recipeId === recipeId && f.photoDataUrl)
    .sort((a, b) => b.cookedAt.localeCompare(a.cookedAt));
  return withPhoto[0]?.photoDataUrl ?? null;
}

export function selectUrgentIngredients(
  inventory: InventoryItem[],
  leftovers: LeftoverIngredient[],
  limit = 3,
): TodayIngredientPreview[] {
  const fromLeftovers = [...leftovers]
    .filter((l) => l.priority === "must_use" || l.priority === "soon")
    .sort((a, b) => {
      const rank = (p: string) => (p === "must_use" ? 0 : 1);
      return rank(a.priority) - rank(b.priority);
    })
    .map((l) => ({
      id: `leftover-${l.id}`,
      name: l.name,
      reason: l.priority === "must_use" ? "優先して使う" : "早めに使う",
    }));

  const fromInventory = inventory
    .filter((item) => item.priority)
    .map((item) => ({
      id: `inv-${item.id}`,
      name: item.name,
      reason: "優先",
    }));

  const seen = new Set<string>();
  const merged: TodayIngredientPreview[] = [];
  for (const item of [...fromLeftovers, ...fromInventory]) {
    const key = item.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged;
}

export function buildTodayTip(input: {
  leftovers: LeftoverIngredient[];
  priceRecords: IngredientPriceRecord[];
  meals: TodayMealCard[];
  dayRecommendationReason?: string | null;
}): string | null {
  const must = input.leftovers.find((l) => l.priority === "must_use");
  if (must) {
    return `${must.name}を使い切る日です`;
  }
  const soon = input.leftovers.find((l) => l.priority === "soon");
  if (soon) {
    return `${soon.name}を早めに使いましょう`;
  }

  // 普段より安い食材（十分なデータがあるもの）
  const names = new Set(
    input.priceRecords.map((r) => r.normalizedIngredientName),
  );
  for (const name of names) {
    const analysis = analyzeIngredientPrices(name, input.priceRecords);
    if (
      analysis.dataQuality === "sufficient" &&
      (analysis.priceAssessment === "cheap" ||
        analysis.priceAssessment === "very_cheap")
    ) {
      return `${analysis.ingredientName}が安く買えています`;
    }
  }

  const times = input.meals
    .map((m) => m.cookingTimeMinutes)
    .filter((t): t is number => t != null);
  if (times.length > 0) {
    const max = Math.max(...times);
    if (max <= 20) {
      return `今日は${max}分で作れます`;
    }
  }

  if (input.dayRecommendationReason?.trim()) {
    const reason = input.dayRecommendationReason.trim();
    return reason.length > 28 ? `${reason.slice(0, 28)}…` : reason;
  }

  return null;
}

export function buildTodayDashboard(input: TodayDashboardInput): TodayDashboard {
  const recipes = input.recipes;
  const feedbacks = input.feedbacks ?? [];
  const leftovers =
    input.leftovers ?? getActiveLeftoversForProposal("local");
  const priceRecords = input.priceRecords ?? [];
  const history = input.cookingHistory ?? [];
  const receipts = input.receipts ?? [];

  const day = input.mealPlan?.days.find((d) => d.date === input.date);
  const dayItems = day?.items ?? [];

  const meals: TodayMealCard[] = dayItems.map((item) => {
    const recipe = item.recipeId
      ? recipes.find((r) => r.id === item.recipeId) ?? null
      : null;
    return {
      mealItemId: item.id,
      recipeId: item.recipeId,
      title: getDishLabel(item, recipes),
      courseLabel: formatCourseLabel(item.course),
      cookingTimeMinutes: recipe?.cookingTimeMinutes ?? null,
      photoDataUrl: item.recipeId
        ? latestPhotoForRecipe(item.recipeId, feedbacks)
        : null,
      cookHref: item.recipeId
        ? `/recipes/${item.recipeId}/cook?date=${input.date}&mealItemId=${item.id}`
        : null,
      recipeHref: item.recipeId ? `/recipes/${item.recipeId}` : null,
    };
  });

  const unchecked = (input.shoppingList?.items ?? []).filter(
    (item) => !item.checked,
  );
  const shoppingItems: TodayShoppingPreview[] = unchecked
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      name: item.ingredientName,
      quantityLabel:
        item.quantities[0]?.quantity != null
          ? `${item.quantities[0].quantity}${item.quantities[0].unit ?? ""}`
          : "",
    }));

  const ingredients = selectUrgentIngredients(
    input.inventory,
    leftovers,
    3,
  );

  const weekBudgetYen = resolveWeekFoodBudget(
    input.weekStart,
    input.mealPlan?.weeklyFoodBudgetYen,
    input.budgetSettings,
  );
  let budget: TodayBudgetView = {
    weeklyFoodBudgetYen: weekBudgetYen,
    remainingBudgetYen: null,
    estimatedPurchaseCostYen: null,
    progressPercent: null,
  };
  if (input.mealPlan) {
    const summary = calculateWeekBudgetSummary({
      mealPlan: input.mealPlan,
      recipes,
      inventory: input.inventory,
      priceRecords,
      settings: input.budgetSettings,
      weeklyFoodBudgetYenOverride: weekBudgetYen,
    });
    const progress =
      summary.weeklyFoodBudgetYen != null &&
      summary.weeklyFoodBudgetYen > 0 &&
      summary.estimatedPurchaseCostYen != null
        ? Math.min(
            100,
            Math.round(
              (summary.estimatedPurchaseCostYen /
                summary.weeklyFoodBudgetYen) *
                100,
            ),
          )
        : null;
    budget = {
      weeklyFoodBudgetYen: summary.weeklyFoodBudgetYen,
      remainingBudgetYen: summary.remainingBudgetYen,
      estimatedPurchaseCostYen: summary.estimatedPurchaseCostYen,
      progressPercent: progress,
    };
  }

  const diabetesSettings =
    input.diabetesSettings ?? loadDiabetesMealSupportSettings();
  let health: TodayHealthView = {
    overall: "—",
    carbohydrates: "—",
    vegetables: "—",
    protein: "—",
    salt: "—",
    weightManagement: "—",
    improvements: [],
    enabled: false,
  };

  if (input.mealPlan && diabetesSettings.diabetesMealSupportEnabled) {
    const report = buildDiabetesMealSupportReport(
      input.mealPlan,
      recipes,
      diabetesSettings,
    );
    const weekly = buildWeeklyHealthSummaryView(report);
    const mealCheck = report.mealChecks.find((m) => m.date === input.date);
    const daily = report.dailyTotals.find((d) => d.date === input.date);
    const todaySuggestions = report.suggestions
      .filter((s) => s.date === input.date)
      .map((s) => s.title)
      .slice(0, 4);
    const vegToday: GradeMark = mealCheck
      ? mealCheck.hasVegetables
        ? "◎"
        : "△"
      : "—";
    const proteinToday: GradeMark =
      daily?.proteinG == null
        ? "—"
        : daily.proteinG >= 40
          ? "◎"
          : daily.proteinG >= 25
            ? "○"
            : "△";
    const carbToday = carbStatusToGrade(mealCheck?.status ?? daily?.carbStatus);
    const saltToday = saltGrade(daily?.saltEquivalentG ?? null);
    const marks = [carbToday, vegToday, proteinToday, saltToday, weekly.weightManagement];
    health = {
      overall: overallFromMarks(marks),
      carbohydrates: carbToday,
      vegetables: vegToday,
      protein: proteinToday,
      salt: saltToday,
      weightManagement: weekly.weightManagement,
      improvements:
        todaySuggestions.length > 0
          ? todaySuggestions
          : weekly.aggregatedImprovements.slice(0, 3).map(
              (i) => `${i.title}（${i.countLabel}）`,
            ),
      enabled: true,
    };
  }

  const weekSummary: TodayWeekSummaryLine[] = [];
  if (input.mealPlan && diabetesSettings.diabetesMealSupportEnabled) {
    const report = buildDiabetesMealSupportReport(
      input.mealPlan,
      recipes,
      diabetesSettings,
    );
    const aggregated = aggregateImprovementSuggestions(report.suggestions);
    for (const item of aggregated) {
      if (item.key === "fish" || item.key === "veg") {
        weekSummary.push({
          id: item.key,
          text: `${item.title} ${item.countLabel}`,
        });
      }
    }
  }
  if (budget.estimatedPurchaseCostYen != null) {
    weekSummary.push({
      id: "food-cost",
      text:
        budget.weeklyFoodBudgetYen != null
          ? `食費 予定${Math.round(budget.estimatedPurchaseCostYen).toLocaleString("ja-JP")}円 / 枠${Math.round(budget.weeklyFoodBudgetYen).toLocaleString("ja-JP")}円`
          : `食費 予定${Math.round(budget.estimatedPurchaseCostYen).toLocaleString("ja-JP")}円`,
    });
  }
  const weekCookCount = history.filter((h) => {
    const d = h.cookedAt.slice(0, 10);
    return d >= input.weekStart && d <= input.date;
  }).length;
  weekSummary.push({
    id: "cook-count",
    text: `料理回数 ${weekCookCount}回`,
  });

  const recent: TodayRecentLine[] = [];
  const latestReceipt = [...receipts].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0];
  if (latestReceipt) {
    recent.push({
      id: "receipt",
      kind: "receipt",
      text: `レシート ${latestReceipt.storeName}${
        latestReceipt.totalAmountYen != null
          ? ` ${Math.round(latestReceipt.totalAmountYen).toLocaleString("ja-JP")}円`
          : ""
      }`,
    });
  }
  try {
    const stats = getPriceLearningStats();
    if (stats.priceRecordCount > 0) {
      recent.push({
        id: "price",
        kind: "price",
        text: `価格学習 ${stats.priceRecordCount}件・認識${stats.recognizedProductCount}種`,
      });
    }
  } catch {
    // 統計取得失敗時はスキップ
  }
  const latestFeedback = [...feedbacks].sort((a, b) =>
    b.cookedAt.localeCompare(a.cookedAt),
  )[0];
  if (latestFeedback) {
    const stars =
      latestFeedback.overallRating != null
        ? "★".repeat(latestFeedback.overallRating)
        : "";
    recent.push({
      id: "feedback",
      kind: "feedback",
      text: `料理フィードバック ${stars || "記録あり"}`,
    });
    if (latestFeedback.memberRatings.length > 0) {
      const avg =
        latestFeedback.memberRatings.reduce((s, m) => s + m.rating, 0) /
        latestFeedback.memberRatings.length;
      recent.push({
        id: "family",
        kind: "family",
        text: `家族評価 平均${avg.toFixed(1)}`,
      });
    }
  }

  const tip = buildTodayTip({
    leftovers,
    priceRecords,
    meals,
    dayRecommendationReason: day?.recommendation?.reasons[0] ?? null,
  });

  return {
    date: input.date,
    tip,
    meals,
    shopping: {
      items: shoppingItems,
      totalUnchecked: unchecked.length,
    },
    ingredients,
    budget,
    health,
    weekSummary: weekSummary.slice(0, 6),
    recent: recent.slice(0, 6),
  };
}

/** クライアント向け: ローカルストアから不足分を補って集計 */
export function buildTodayDashboardFromLocal(
  input: Omit<
    TodayDashboardInput,
    | "leftovers"
    | "priceRecords"
    | "feedbacks"
    | "cookingHistory"
    | "receipts"
    | "diabetesSettings"
  > &
    Partial<
      Pick<
        TodayDashboardInput,
        | "leftovers"
        | "priceRecords"
        | "feedbacks"
        | "cookingHistory"
        | "receipts"
        | "diabetesSettings"
      >
    >,
): TodayDashboard {
  return buildTodayDashboard({
    ...input,
    leftovers: input.leftovers ?? getActiveLeftoversForProposal("local"),
    priceRecords: input.priceRecords ?? loadIngredientPrices(),
    feedbacks: input.feedbacks ?? loadCookingFeedbacks(),
    cookingHistory: input.cookingHistory ?? loadCookingHistory(),
    receipts: input.receipts ?? getReceiptRepository().listReceipts(),
    diabetesSettings:
      input.diabetesSettings ?? loadDiabetesMealSupportSettings(),
  });
}
