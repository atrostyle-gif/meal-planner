import { getWeekDates } from "@/lib/date";
import {
  getActiveStoreProfile,
  loadFoodBudgetSettings,
} from "@/lib/food-budget/settings";
import { loadIngredientPrices } from "@/lib/food-budget/prices";
import { loadFoodAliasMappings, loadFoodMasters } from "@/lib/food-master/store";
import { createSampleFoodMasters } from "@/lib/food-master/sample-data";
import { getActiveLeftoversForProposal } from "@/lib/leftover-ingredients";
import { collectFamilyLearningHints } from "@/lib/family-profile-helpers";
import { loadFamilyMemberProfiles } from "@/lib/family-member-profiles";
import { loadFamilyLearningProfile } from "@/lib/family-learning/store";
import {
  loadDefaultMealServings,
  resolveDayServings,
} from "@/lib/servings/resolve";
import { evaluateDayCombo } from "@/lib/weekly-auto-plan/combo";
import { buildMealSelectionReason } from "@/lib/weekly-auto-plan/explain";
import {
  getGenreKey,
  getMainIngredientKey,
  isFishRecipe,
  isMeatRecipe,
  recipeUsesInventory,
} from "@/lib/weekly-auto-plan/recipe-features";
import {
  scoreRecipeForSlot,
  type ScoreContext,
  type ScoredCandidate,
} from "@/lib/weekly-auto-plan/score";
import { evaluateLeftoverIngredientUsage } from "@/lib/leftover-match";
import { loadHouseholdPreferences } from "@/lib/meal-preferences";
import { getScheduleForDay } from "@/lib/weekly-cooking-schedules";
import { DAYS_OF_WEEK } from "@/types/weekly-lifestyle";
import type { MealSelectionReason } from "@/types/meal-decision-explanation";
import type { FoodBudgetSettings } from "@/types/food-budget";
import type { InventoryItem } from "@/types/inventory";
import type { LeftoverIngredient } from "@/types/leftover-ingredient";
import type { DayMeal } from "@/types/meal-plan";
import type { MealPlanTagId } from "@/types/meal-plan-tags";
import type { Recipe } from "@/types/recipe";
import type {
  SelectionReason,
  WeeklyAutoCourse,
} from "@/types/weekly-meal-plan";
import { WEEKLY_AUTO_COURSES } from "@/types/weekly-meal-plan";
import type { DiabetesMealSupportSettings } from "@/types/diabetes-meal-support";
import { loadDiabetesMealSupportSettings } from "@/lib/diabetes-meal-support/settings";

export type RecommendTabId =
  | "recommend"
  | "all"
  | "favorite"
  | "not_recent";

export type RecommendCandidate = {
  recipe: Recipe;
  score: number;
  /** 1〜5 */
  stars: number;
  reasons: SelectionReason[];
  compatible: boolean;
  /** 構造化採用理由 */
  decisionExplanation: MealSelectionReason;
  /** 候補一覧のAIイチオシ（先頭） */
  isAiPick?: boolean;
};

export type RecommendForSlotInput = {
  weekStart: string;
  date: string;
  course: WeeklyAutoCourse;
  days: DayMeal[];
  recipes: Recipe[];
  inventory?: InventoryItem[];
  leftovers?: LeftoverIngredient[];
  recentRecipeIds?: string[];
  planTags?: readonly MealPlanTagId[];
  householdId?: string;
  diabetesSettings?: DiabetesMealSupportSettings;
  foodBudgetSettings?: FoodBudgetSettings;
  /** 差し替え時は同じ枠の既存レシピを候補から除外しない（差し替え可） */
  excludeRecipeId?: string | null;
  tab?: RecommendTabId;
  limit?: number;
};

function courseMatches(recipe: Recipe, course: WeeklyAutoCourse): boolean {
  if (recipe.course === course) return true;
  const role = recipe.mealAffinity?.mealRole;
  if (course === "主菜" && role === "main") return true;
  if (course === "副菜" && role === "side") return true;
  if (course === "汁物" && role === "soup") return true;
  if (course === "主菜" && (recipe.course === "その他" || recipe.course === "主食")) {
    return true;
  }
  return false;
}

function buildContext(
  days: DayMeal[],
  dayIndex: number,
  recipes: Recipe[],
  usedRecipeIds: Set<string>,
  recentRecipeIds: Set<string>,
  inventory: InventoryItem[],
  course: WeeklyAutoCourse,
  leftovers: LeftoverIngredient[],
  diabetesSettings: DiabetesMealSupportSettings,
  planTags: readonly MealPlanTagId[],
): ScoreContext {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const day = days[dayIndex];
  const prev = dayIndex > 0 ? days[dayIndex - 1] : null;
  const prevMain = prev?.items.find((i) => i.course === "主菜");
  const prevRecipe = prevMain?.recipeId
    ? recipeMap.get(prevMain.recipeId)
    : undefined;

  const previousDayRecipes: Recipe[] = [];
  if (prev) {
    for (const item of prev.items) {
      if (!item.recipeId) continue;
      const r = recipeMap.get(item.recipeId);
      if (r) previousDayRecipes.push(r);
    }
  }

  let weekHasFish = false;
  for (let i = 0; i < dayIndex; i += 1) {
    for (const item of days[i]?.items ?? []) {
      if (!item.recipeId) continue;
      const r = recipeMap.get(item.recipeId);
      if (r && isFishRecipe(r)) weekHasFish = true;
    }
  }

  const dayCoursesSoFar = (day?.items ?? [])
    .filter((item) => item.course !== course)
    .map((item) => item.course);

  const foodBudgetSettings = loadFoodBudgetSettings();
  const priceRecords = loadIngredientPrices();
  const store = getActiveStoreProfile(foodBudgetSettings);

  return {
    dayIndex,
    usedRecipeIds,
    previousMainIngredientKey: prevRecipe
      ? getMainIngredientKey(prevRecipe)
      : null,
    previousGenreKey: prevRecipe ? getGenreKey(prevRecipe) : null,
    previousWasFish: prevRecipe ? isFishRecipe(prevRecipe) : null,
    previousWasMeat: prevRecipe ? isMeatRecipe(prevRecipe) : null,
    weekHasFish,
    recentRecipeIds,
    inventory,
    leftovers,
    foodMasters:
      typeof window === "undefined"
        ? createSampleFoodMasters()
        : loadFoodMasters(),
    foodAliasMappings:
      typeof window === "undefined" ? [] : loadFoodAliasMappings(),
    diabetesSettings,
    dayCoursesSoFar,
    previousDayRecipes,
    targetCourse: course,
    budgetContext: {
      settings: foodBudgetSettings,
      store,
      priceRecords,
      inventory,
      selectedRecipes: [],
      weeklyFoodBudgetYen: foodBudgetSettings.weeklyFoodBudgetYen,
      runningPurchaseCostYen: 0,
    },
    plannedServings: resolveDayServings(
      day ?? { date: "", locked: false, items: [] },
      loadDefaultMealServings(),
    ).servings,
    planTags,
    familyHints: collectFamilyLearningHints(loadFamilyMemberProfiles()),
    familyLearning: loadFamilyLearningProfile(),
    cookMemberId: null,
  };
}

function filterByTab(
  candidates: RecommendCandidate[],
  tab: RecommendTabId,
): RecommendCandidate[] {
  if (tab === "all" || tab === "recommend") return candidates;
  if (tab === "favorite") {
    return candidates.filter(
      (c) =>
        (c.recipe.favoriteScore ?? 0) >= 4 ||
        (c.recipe.averageRating ?? 0) >= 4,
    );
  }
  // 最近作っていない
  return candidates.filter((c) => {
    if (!c.recipe.lastCookedAt) return true;
    const last = new Date(c.recipe.lastCookedAt).getTime();
    if (Number.isNaN(last)) return true;
    const days = (Date.now() - last) / (1000 * 60 * 60 * 24);
    return days >= 14;
  });
}

/**
 * スロット向けおすすめ候補（スコア順）。
 */
export function recommendRecipesForSlot(
  input: RecommendForSlotInput,
): RecommendCandidate[] {
  const tab = input.tab ?? "recommend";
  const limit = input.limit ?? (tab === "all" ? 80 : 12);
  const planTags = input.planTags ?? [];
  const inventory = input.inventory ?? [];
  const leftovers =
    input.leftovers ??
    getActiveLeftoversForProposal(
      input.householdId ?? "local",
      input.weekStart,
    );
  const diabetesSettings =
    input.diabetesSettings ?? loadDiabetesMealSupportSettings();
  const dates = getWeekDates(input.weekStart);
  const dayIndex = dates.indexOf(input.date);
  if (dayIndex < 0) return [];

  const day = input.days.find((d) => d.date === input.date);
  if (!day) return [];

  const recipesById = new Map(input.recipes.map((r) => [r.id, r]));
  const usedRecipeIds = new Set<string>();
  for (const d of input.days) {
    for (const item of d.items) {
      if (!item.recipeId) continue;
      if (d.date === input.date && item.course === input.course) continue;
      if (item.recipeId === input.excludeRecipeId) continue;
      usedRecipeIds.add(item.recipeId);
    }
  }

  const recentRecipeIds = new Set(input.recentRecipeIds ?? []);
  const ctx = buildContext(
    input.days,
    dayIndex,
    input.recipes,
    usedRecipeIds,
    recentRecipeIds,
    inventory,
    input.course,
    leftovers,
    diabetesSettings,
    planTags,
  );

  // budgetContext の設定上書き
  if (input.foodBudgetSettings && ctx.budgetContext) {
    ctx.budgetContext = {
      ...ctx.budgetContext,
      settings: input.foodBudgetSettings,
      store: getActiveStoreProfile(input.foodBudgetSettings),
      weeklyFoodBudgetYen: input.foodBudgetSettings.weeklyFoodBudgetYen,
    };
  }

  const pool = input.recipes.filter((recipe) =>
    courseMatches(recipe, input.course),
  );

  const scored: RecommendCandidate[] = [];
  const familyProfiles = loadFamilyMemberProfiles();
  const householdPrefs = loadHouseholdPreferences();
  const dayOfWeek = DAYS_OF_WEEK[dayIndex];
  const schedule = dayOfWeek
    ? getScheduleForDay(input.householdId ?? "local", dayOfWeek)
    : null;
  const cookProfile = schedule?.defaultCookMemberId
    ? familyProfiles.find((p) => p.id === schedule.defaultCookMemberId) ?? null
    : null;
  const cookMember = cookProfile
    ? { id: cookProfile.id, displayName: cookProfile.displayName }
    : null;
  // スコア文脈に担当者を渡す
  ctx.cookMemberId = cookMember?.id ?? null;
  ctx.familyLearning = loadFamilyLearningProfile(input.householdId ?? "local");

  const foodMasters =
    typeof window === "undefined"
      ? createSampleFoodMasters()
      : loadFoodMasters();
  const foodAliasMappings =
    typeof window === "undefined" ? [] : loadFoodAliasMappings();

  for (const recipe of pool) {
    if (usedRecipeIds.has(recipe.id)) continue;

    const base: ScoredCandidate = scoreRecipeForSlot(recipe, ctx);
    if (base.score <= -1000) continue;

    const combo = evaluateDayCombo(
      recipe,
      day,
      recipesById,
      input.course,
    );

    const total = base.score + combo.delta;
    const reasons = [...combo.reasons, ...base.reasons];
    // 重複除去
    const seen = new Set<string>();
    const uniqueReasons: SelectionReason[] = [];
    for (const reason of reasons) {
      if (seen.has(reason.detail)) continue;
      seen.add(reason.detail);
      uniqueReasons.push(reason);
      if (uniqueReasons.length >= 5) break;
    }

    // 理由が空なら最低1つ
    if (uniqueReasons.length === 0) {
      uniqueReasons.push({ detail: "今週の献立に合いやすい候補です" });
    }

    const leftoverUsed = evaluateLeftoverIngredientUsage(
      recipe,
      leftovers,
      foodMasters,
      foodAliasMappings,
    );
    const leftoverMatched = leftovers
      .filter((item) => leftoverUsed.matchedIds.includes(item.id))
      .map((item) => item.name);
    const decisionExplanation = buildMealSelectionReason({
      recipe,
      score: total,
      scoredReasons: uniqueReasons,
      dayIndex,
      date: input.date,
      planTags,
      inventoryMatched: recipeUsesInventory(recipe, inventory).matched,
      leftoverMatched,
      cookMember,
      familyProfiles,
      householdHealthGoal: householdPrefs.healthGoal,
      defaultMealServings: householdPrefs.defaultMealServings,
    });

    scored.push({
      recipe,
      score: total,
      stars: decisionExplanation.stars,
      reasons: uniqueReasons,
      compatible: combo.compatible,
      decisionExplanation,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const filtered = filterByTab(scored, tab);
  if (tab === "all") {
    return filtered
      .slice()
      .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name, "ja"))
      .slice(0, limit);
  }
  const limited = filtered.slice(0, limit);
  if (limited[0]) {
    limited[0] = { ...limited[0], isAiPick: true };
  }
  return limited;
}

export function isWeeklyAutoCourse(value: string): value is WeeklyAutoCourse {
  return (WEEKLY_AUTO_COURSES as readonly string[]).includes(value);
}
