import { getWeekDates } from "@/lib/date";
import { scoreBudgetSupport } from "@/lib/food-budget/score";
import {
  getActiveStoreProfile,
  loadFoodBudgetSettings,
} from "@/lib/food-budget/settings";
import { loadIngredientPrices } from "@/lib/food-budget/prices";
import {
  getGenreKey,
  getMainIngredientKey,
  isFishRecipe,
  isMeatRecipe,
} from "@/lib/weekly-auto-plan/recipe-features";
import {
  pickBestCandidate,
  scoreRecipeForSlot,
  type ScoreContext,
} from "@/lib/weekly-auto-plan/score";
import type { FoodBudgetSettings } from "@/types/food-budget";
import type { IngredientPriceRecord } from "@/types/ingredient-price";
import type { InventoryItem } from "@/types/inventory";
import type { DayMeal, MealDishItem, MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import {
  WEEKLY_AUTO_COURSES,
  type WeeklyAutoCourse,
  type WeeklyAutoScope,
} from "@/types/weekly-meal-plan";

export type GenerateWeeklyPlanInput = {
  weekStart: string;
  days: DayMeal[];
  recipes: Recipe[];
  inventory?: InventoryItem[];
  recentRecipeIds?: string[];
  scope?: WeeklyAutoScope;
  /** 乱数を固定したい場合（テスト用） */
  random?: () => number;
  diabetesSettings?: import("@/types/diabetes-meal-support").DiabetesMealSupportSettings;
  foodBudgetSettings?: FoodBudgetSettings;
  priceRecords?: IngredientPriceRecord[];
  weeklyFoodBudgetYen?: number | null;
};

export type GenerateWeeklyPlanResult = {
  days: DayMeal[];
  filledCount: number;
  emptySlotCount: number;
  warnings: string[];
};

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `slot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeDays(weekStart: string, days: DayMeal[]): DayMeal[] {
  const dates = getWeekDates(weekStart);
  return dates.map((date) => {
    const existing = days.find((day) => day.date === date);
    return existing
      ? {
          ...existing,
          items: [...existing.items].sort((a, b) => a.order - b.order),
        }
      : { date, locked: false, items: [] };
  });
}

function courseMatches(recipe: Recipe, course: WeeklyAutoCourse): boolean {
  if (recipe.course === course) return true;
  const role = recipe.mealAffinity?.mealRole;
  if (course === "主菜" && role === "main") return true;
  if (course === "副菜" && role === "side") return true;
  if (course === "汁物" && role === "soup") return true;
  // コース未設定の「その他」は主菜候補に緩く入れる
  if (course === "主菜" && (recipe.course === "その他" || recipe.course === "主食")) {
    return true;
  }
  return false;
}

function isSlotLocked(item: MealDishItem, day: DayMeal): boolean {
  return Boolean(item.slotLocked) || day.locked;
}

function findSlot(
  day: DayMeal,
  course: WeeklyAutoCourse,
  slotId?: string,
): MealDishItem | undefined {
  if (slotId) {
    return day.items.find((item) => item.id === slotId);
  }
  return day.items.find((item) => item.course === course);
}

function shouldRegenerateSlot(
  day: DayMeal,
  course: WeeklyAutoCourse,
  scope: WeeklyAutoScope,
): boolean {
  if (day.locked) return false;

  if (scope.type === "week") {
    const existing = findSlot(day, course);
    if (existing && isSlotLocked(existing, day)) return false;
    return true;
  }

  if (scope.type === "day") {
    if (day.date !== scope.date) return false;
    const existing = findSlot(day, course);
    if (existing && isSlotLocked(existing, day)) return false;
    return true;
  }

  if (scope.type === "slot") {
    if (day.date !== scope.date) return false;
    if (scope.course !== course) return false;

    // removeRegeneratedSlots のあとでも、空きコースなら埋め直す
    const existingById = scope.slotId
      ? day.items.find((item) => item.id === scope.slotId)
      : undefined;
    const existingByCourse = findSlot(day, course);

    if (existingById && isSlotLocked(existingById, day)) return false;
    if (existingByCourse && isSlotLocked(existingByCourse, day)) return false;

    if (scope.slotId) {
      // 指定枠がまだ残っている → 再生成対象
      if (existingById) return true;
      // 枠は消えたが同コースが埋まっている → 触らない
      if (existingByCourse?.recipeId) return false;
      // 空き → 埋める
      return true;
    }

    return true;
  }

  return false;
}

function removeRegeneratedSlots(
  day: DayMeal,
  scope: WeeklyAutoScope,
): MealDishItem[] {
  return day.items.filter((item) => {
    if (!WEEKLY_AUTO_COURSES.includes(item.course as WeeklyAutoCourse)) {
      // 主食など対象外はそのまま残す
      return true;
    }
    if (isSlotLocked(item, day)) return true;
    if (scope.type === "week") return false;
    if (scope.type === "day") return day.date !== scope.date;
    if (scope.type === "slot") {
      if (day.date !== scope.date) return true;
      if (scope.slotId) return item.id !== scope.slotId;
      return item.course !== scope.course;
    }
    return true;
  });
}

function buildContextForDay(
  days: DayMeal[],
  dayIndex: number,
  recipes: Recipe[],
  usedRecipeIds: Set<string>,
  recentRecipeIds: Set<string>,
  inventory: InventoryItem[],
  dayCoursesSoFar: import("@/types/recipe").RecipeCourse[],
  diabetesSettings:
    | import("@/types/diabetes-meal-support").DiabetesMealSupportSettings
    | undefined,
  targetCourse: import("@/types/recipe").RecipeCourse,
  budgetContext: ScoreContext["budgetContext"],
): ScoreContext {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
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
    diabetesSettings,
    dayCoursesSoFar,
    previousDayRecipes,
    targetCourse,
    budgetContext,
  };
}

/**
 * 保存済みレシピから週間献立（主菜・副菜・汁物）をルールベースで編成する。
 * OpenAI は呼ばない。候補不足時は空き枠のまま返す。
 */
export function generateWeeklyMealPlan(
  input: GenerateWeeklyPlanInput,
): GenerateWeeklyPlanResult {
  const scope: WeeklyAutoScope = input.scope ?? { type: "week" };
  const inventory = input.inventory ?? [];
  const recentRecipeIds = new Set(input.recentRecipeIds ?? []);
  const warnings: string[] = [];
  const foodBudgetSettings =
    input.foodBudgetSettings ?? loadFoodBudgetSettings();
  const priceRecords = input.priceRecords ?? loadIngredientPrices();
  const store = getActiveStoreProfile(foodBudgetSettings);
  const weeklyFoodBudgetYen =
    input.weeklyFoodBudgetYen !== undefined
      ? input.weeklyFoodBudgetYen
      : foodBudgetSettings.weeklyFoodBudgetYen;
  const recipeMap = new Map(input.recipes.map((r) => [r.id, r]));
  const selectedRecipes: Recipe[] = [];
  let runningPurchaseCostYen = 0;

  let days = normalizeDays(input.weekStart, input.days).map((day) => ({
    ...day,
    items: removeRegeneratedSlots(day, scope),
  }));

  // 使用済みレシピ（ロック枠含む）
  const usedRecipeIds = new Set<string>();
  for (const day of days) {
    for (const item of day.items) {
      if (item.recipeId) {
        usedRecipeIds.add(item.recipeId);
        const lockedRecipe = recipeMap.get(item.recipeId);
        if (lockedRecipe) {
          selectedRecipes.push(lockedRecipe);
          const budgetPart = scoreBudgetSupport(lockedRecipe, {
            settings: foodBudgetSettings,
            store,
            priceRecords,
            inventory,
            selectedRecipes: selectedRecipes.slice(0, -1),
            weeklyFoodBudgetYen,
            runningPurchaseCostYen,
          });
          runningPurchaseCostYen += budgetPart.addedPurchaseCostYen;
        }
      }
    }
  }

  let filledCount = 0;
  let emptySlotCount = 0;

  days = days.map((day, dayIndex) => {
    if (day.locked && scope.type === "week") {
      // 日ロックは週再生成でも触らない
      return day;
    }

    const nextItems = [...day.items];
    const coursesToFill = WEEKLY_AUTO_COURSES.filter((course) =>
      shouldRegenerateSlot(day, course, scope),
    );

    // 既に同コースがある場合は追加しない（再生成で消えている想定）
    for (const course of coursesToFill) {
      if (nextItems.some((item) => item.course === course && item.recipeId)) {
        continue;
      }

      const budgetContext = {
        settings: foodBudgetSettings,
        store,
        priceRecords,
        inventory,
        selectedRecipes: [...selectedRecipes],
        weeklyFoodBudgetYen,
        runningPurchaseCostYen,
      };

      const ctx = buildContextForDay(
        // 途中経過を反映するため、当日までの仮 days を渡す
        days.map((d, i) => (i === dayIndex ? { ...d, items: nextItems } : d)),
        dayIndex,
        input.recipes,
        usedRecipeIds,
        recentRecipeIds,
        inventory,
        nextItems.map((item) => item.course),
        input.diabetesSettings,
        course,
        budgetContext,
      );

      const candidates = input.recipes
        .filter((recipe) => courseMatches(recipe, course))
        .map((recipe) => scoreRecipeForSlot(recipe, ctx));

      const best = pickBestCandidate(candidates);
      if (!best) {
        emptySlotCount += 1;
        warnings.push(`${day.date}の${course}に候補が足りません`);
        continue;
      }

      usedRecipeIds.add(best.recipe.id);
      const added = scoreBudgetSupport(best.recipe, budgetContext);
      runningPurchaseCostYen += added.addedPurchaseCostYen;
      selectedRecipes.push(best.recipe);
      nextItems.push({
        id: createId(),
        recipeId: best.recipe.id,
        course,
        order: nextItems.length + 1,
        customName: null,
        source: "auto",
        engineScore: best.score,
        engineReasons: best.reasons.map((r) => r.detail),
        selectionReasons: best.reasons.map((r) => r.detail),
        selectionBadges: best.badges,
        slotLocked: false,
      });
      filledCount += 1;
    }

    // おすすめ要約
    const autoReasons = nextItems
      .flatMap((item) => item.selectionReasons ?? [])
      .slice(0, 5);
    const avgScore =
      nextItems
        .map((item) => item.engineScore ?? 0)
        .reduce((sum, n) => sum + n, 0) / Math.max(1, nextItems.length);

    return {
      ...day,
      items: nextItems
        .map((item, index) => ({ ...item, order: index + 1 }))
        .sort((a, b) => a.order - b.order),
      recommendation:
        nextItems.length > 0
          ? {
              score: avgScore,
              stars: Math.min(5, Math.max(1, Math.round(avgScore / 20))),
              reasons: autoReasons,
            }
          : day.recommendation ?? null,
    };
  });

  // 週全体の空き枠を再カウント（対象コースのみ）
  emptySlotCount = 0;
  for (const day of days) {
    for (const course of WEEKLY_AUTO_COURSES) {
      const has = day.items.some(
        (item) => item.course === course && item.recipeId,
      );
      if (!has && !day.locked) emptySlotCount += 1;
    }
  }

  if (input.recipes.length === 0) {
    warnings.push("保存済みレシピがありません");
  }

  return { days, filledCount, emptySlotCount, warnings };
}

/** MealPlan へ適用しやすいラッパ */
export function applyGeneratedDaysToPlan(
  plan: MealPlan,
  days: DayMeal[],
): MealPlan {
  return {
    ...plan,
    days,
    updatedAt: new Date().toISOString(),
  };
}
