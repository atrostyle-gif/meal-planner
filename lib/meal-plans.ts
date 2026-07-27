import { getWeekDates, getWeekStart } from "@/lib/date";
import { mealPlannerEngine } from "@/lib/meal-planner-engine";
import { loadHouseholdPreferences } from "@/lib/meal-preferences";
import { loadRecipes } from "@/lib/recipes";
import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  DEFAULT_RECIPE_COURSE,
  isRecipeCourse,
  type RecipeCourse,
} from "@/types/course";
import type { InventoryItem } from "@/types/inventory";
import type {
  DayMeal,
  DayMealRecommendation,
  MealDishItem,
  MealPlan,
  MealSource,
} from "@/types/meal-plan";
import type { HouseholdPreferences } from "@/types/meal-preferences";
import type { Recipe } from "@/types/recipe";
import { isBudgetMode } from "@/types/food-budget";

type Listener = () => void;

let cachedRaw: string | null | undefined = undefined;
let cachedPlans: MealPlan[] = [];
const listeners = new Set<Listener>();

function isMealSource(value: unknown): value is MealSource {
  return value === "manual" || value === "fixed" || value === "auto";
}

function normalizeItems(items: MealDishItem[]): MealDishItem[] {
  return [...items]
    .sort((left, right) => left.order - right.order)
    .map((item, index) => ({
      ...item,
      order: index + 1,
    }));
}

function migrateDishItem(
  value: unknown,
  recipes: Recipe[],
  fallbackOrder: number,
): MealDishItem | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const item = value as Record<string, unknown>;
  const recipeId =
    item.recipeId === null || typeof item.recipeId === "string"
      ? item.recipeId
      : null;
  const customName =
    typeof item.customName === "string"
      ? item.customName
      : item.customName === null
        ? null
        : undefined;

  if (recipeId === null && (customName === undefined || customName === null || customName.trim() === "")) {
    // 旧形式で両方空ならアイテムなし
    if (!("course" in item) && !("order" in item)) {
      return null;
    }
  }

  const recipe = recipeId
    ? recipes.find((entry) => entry.id === recipeId)
    : undefined;
  const course = isRecipeCourse(item.course)
    ? item.course
    : (recipe?.course ?? DEFAULT_RECIPE_COURSE);

  return {
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    recipeId,
    course,
    order:
      typeof item.order === "number" && Number.isInteger(item.order)
        ? item.order
        : fallbackOrder,
    customName: customName ?? null,
    source: isMealSource(item.source) ? item.source : "manual",
    notes: typeof item.notes === "string" ? item.notes : undefined,
    servingsOverride:
      typeof item.servingsOverride === "number" || item.servingsOverride === null
        ? item.servingsOverride
        : undefined,
    engineScore:
      typeof item.engineScore === "number" ? item.engineScore : undefined,
    engineReasons: Array.isArray(item.engineReasons)
      ? item.engineReasons.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    slotLocked: typeof item.slotLocked === "boolean" ? item.slotLocked : false,
    selectionReasons: Array.isArray(item.selectionReasons)
      ? item.selectionReasons.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : undefined,
    selectionBadges: Array.isArray(item.selectionBadges)
      ? item.selectionBadges.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : undefined,
  };
}

function migrateRecommendation(
  value: unknown,
): DayMealRecommendation | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const item = value as Record<string, unknown>;
  if (typeof item.score !== "number" || typeof item.stars !== "number") {
    return undefined;
  }
  return {
    score: item.score,
    stars: Math.min(5, Math.max(1, Math.round(item.stars))),
    reasons: Array.isArray(item.reasons)
      ? item.reasons.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

/** 旧1品スロット / 新 DayMeal を正規化する */
function migrateDayMeal(value: unknown, recipes: Recipe[]): DayMeal | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const item = value as Record<string, unknown>;
  if (typeof item.date !== "string") {
    return null;
  }

  // 新形式
  if (Array.isArray(item.items)) {
    const items: MealDishItem[] = [];
    item.items.forEach((raw, index) => {
      const dish = migrateDishItem(raw, recipes, index + 1);
      if (dish) {
        items.push(dish);
      }
    });

    return {
      date: item.date,
      locked: typeof item.locked === "boolean" ? item.locked : Boolean(item.isFixed),
      items: normalizeItems(items),
      recommendation: migrateRecommendation(item.recommendation),
      participantMemberIds: Array.isArray(item.participantMemberIds)
        ? item.participantMemberIds.filter(
            (id): id is string => typeof id === "string",
          )
        : undefined,
    };
  }

  // 旧形式: { date, recipeId, customName, isFixed, source }
  const locked =
    typeof item.locked === "boolean" ? item.locked : Boolean(item.isFixed);
  const recipeId =
    item.recipeId === null || typeof item.recipeId === "string"
      ? item.recipeId
      : null;
  const customName =
    typeof item.customName === "string" && item.customName.trim() !== ""
      ? item.customName.trim()
      : null;

  const items: MealDishItem[] = [];
  if (recipeId !== null || customName !== null) {
    const recipe = recipeId
      ? recipes.find((entry) => entry.id === recipeId)
      : undefined;
    items.push({
      id: crypto.randomUUID(),
      recipeId,
      course: recipe?.course ?? DEFAULT_RECIPE_COURSE,
      order: 1,
      customName,
      source: isMealSource(item.source) ? item.source : "manual",
    });
  }

  return {
    date: item.date,
    locked,
    items,
  };
}

function migrateMealPlan(value: unknown, recipes: Recipe[]): MealPlan | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.weekStart !== "string" ||
    typeof item.createdAt !== "string" ||
    typeof item.updatedAt !== "string"
  ) {
    return null;
  }

  const rawDays = Array.isArray(item.days)
    ? item.days
    : Array.isArray(item.slots)
      ? item.slots
      : null;

  if (rawDays === null || rawDays.length !== 7) {
    return null;
  }

  const days: DayMeal[] = [];
  for (const raw of rawDays) {
    const day = migrateDayMeal(raw, recipes);
    if (day === null) {
      return null;
    }
    days.push(day);
  }

  return {
    id: item.id,
    weekStart: item.weekStart,
    days,
    weeklyFoodBudgetYen:
      typeof item.weeklyFoodBudgetYen === "number" &&
      Number.isFinite(item.weeklyFoodBudgetYen)
        ? item.weeklyFoodBudgetYen
        : item.weeklyFoodBudgetYen === null
          ? null
          : undefined,
    budgetMode: isBudgetMode(item.budgetMode) ? item.budgetMode : undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function needsMealPlanMigration(raw: unknown, migrated: MealPlan): boolean {
  if (typeof raw !== "object" || raw === null) {
    return true;
  }

  const item = raw as Record<string, unknown>;
  if (!Array.isArray(item.days)) {
    return true;
  }
  if (Array.isArray(item.slots)) {
    return true;
  }

  for (let index = 0; index < migrated.days.length; index += 1) {
    const rawDay = item.days[index];
    if (typeof rawDay !== "object" || rawDay === null) {
      return true;
    }
    const day = rawDay as Record<string, unknown>;
    if (!("locked" in day) || !Array.isArray(day.items)) {
      return true;
    }
    if (day.items.length !== migrated.days[index].items.length) {
      return true;
    }
  }

  return false;
}

function parseAndMigrateMealPlans(value: unknown): {
  plans: MealPlan[];
  migrated: boolean;
} | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const recipes = loadRecipes();
  const plans: MealPlan[] = [];
  let migrated = false;

  for (const item of value) {
    const plan = migrateMealPlan(item, recipes);
    if (plan === null) {
      return null;
    }
    if (needsMealPlanMigration(item, plan)) {
      migrated = true;
    }
    plans.push(plan);
  }

  return { plans, migrated };
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function writePlans(plans: MealPlan[]): void {
  writeStorage(STORAGE_KEYS.mealPlans, plans);
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.mealPlans);
  cachedPlans = plans;
}

function persist(plans: MealPlan[]): void {
  writePlans(plans);
  notify();
}

function createEmptyDays(weekStart: string): DayMeal[] {
  return getWeekDates(weekStart).map((date) => ({
    date,
    locked: false,
    items: [],
    recommendation: null,
  }));
}

function createEmptyPlan(weekStart: string): MealPlan {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    weekStart,
    days: createEmptyDays(weekStart),
    createdAt: now,
    updatedAt: now,
  };
}

export function loadMealPlans(): MealPlan[] {
  if (typeof window === "undefined") {
    return [];
  }

  if (!hasStorageKey(STORAGE_KEYS.mealPlans)) {
    writePlans([]);
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.mealPlans);
  if (raw === cachedRaw && cachedRaw !== undefined) {
    return cachedPlans;
  }

  const stored = readStorage<unknown>(STORAGE_KEYS.mealPlans);
  const parsed = parseAndMigrateMealPlans(stored);

  if (parsed === null) {
    writePlans([]);
    return [];
  }

  if (parsed.migrated) {
    writePlans(parsed.plans);
    return parsed.plans;
  }

  cachedRaw = raw;
  cachedPlans = parsed.plans;
  return parsed.plans;
}

export function subscribeMealPlans(onStoreChange: Listener): () => void {
  listeners.add(onStoreChange);

  const onStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEYS.mealPlans || event.key === null) {
      cachedRaw = undefined;
      onStoreChange();
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getMealPlansSnapshot(): MealPlan[] {
  return loadMealPlans();
}

/** SSR 用の安定参照（毎回新しい配列を返すと無限ループになる） */
const EMPTY_MEAL_PLANS_SNAPSHOT: MealPlan[] = [];

export function getMealPlansServerSnapshot(): MealPlan[] {
  return EMPTY_MEAL_PLANS_SNAPSHOT;
}

export function getOrCreateMealPlan(weekStart: string = getWeekStart()): MealPlan {
  const plans = loadMealPlans();
  const existing = plans.find((plan) => plan.weekStart === weekStart);
  if (existing) {
    return existing;
  }

  const created = createEmptyPlan(weekStart);
  persist([created, ...plans]);
  return created;
}

export function isDayBlank(day: DayMeal): boolean {
  return day.items.length === 0;
}

export function getDishLabel(item: MealDishItem, recipes: Recipe[]): string {
  if (item.customName && item.customName.trim() !== "") {
    return item.customName.trim();
  }
  if (item.recipeId) {
    const recipe = recipes.find((entry) => entry.id === item.recipeId);
    return recipe?.name ?? "（削除済みレシピ）";
  }
  return "未設定";
}

function updatePlanDays(
  weekStart: string,
  updater: (days: DayMeal[]) => DayMeal[],
): MealPlan {
  const plans = loadMealPlans();
  const index = plans.findIndex((plan) => plan.weekStart === weekStart);
  const base = index >= 0 ? plans[index] : createEmptyPlan(weekStart);
  const updated: MealPlan = {
    ...base,
    days: updater(base.days),
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    const next = [...plans];
    next[index] = updated;
    persist(next);
  } else {
    persist([updated, ...plans]);
  }

  return updated;
}

function updateDayItems(
  weekStart: string,
  date: string,
  updater: (items: MealDishItem[]) => MealDishItem[],
): MealPlan {
  return updatePlanDays(weekStart, (days) =>
    days.map((day) => {
      if (day.date !== date) {
        return day;
      }
      return {
        ...day,
        items: normalizeItems(updater(day.items)),
      };
    }),
  );
}

/** 固定の ON/OFF */
export function toggleDayLocked(weekStart: string, date: string): MealPlan {
  return updatePlanDays(weekStart, (days) =>
    days.map((day) =>
      day.date === date ? { ...day, locked: !day.locked } : day,
    ),
  );
}

/** レシピを1品追加 */
export function addDishFromRecipe(
  weekStart: string,
  date: string,
  recipe: Recipe,
): MealPlan {
  return updateDayItems(weekStart, date, (items) => [
    ...items,
    {
      id: crypto.randomUUID(),
      recipeId: recipe.id,
      course: recipe.course,
      order: items.length + 1,
      customName: null,
      source: "manual",
    },
  ]);
}

/** 料理を削除 */
export function removeDishItem(
  weekStart: string,
  date: string,
  itemId: string,
): MealPlan {
  return updateDayItems(weekStart, date, (items) =>
    items.filter((item) => item.id !== itemId),
  );
}

/** 料理区分を変更 */
export function updateDishCourse(
  weekStart: string,
  date: string,
  itemId: string,
  course: RecipeCourse,
): MealPlan {
  return updateDayItems(weekStart, date, (items) =>
    items.map((item) => (item.id === itemId ? { ...item, course } : item)),
  );
}

/** 枠単位のロック切替 */
export function toggleSlotLocked(
  weekStart: string,
  date: string,
  itemId: string,
): MealPlan {
  return updateDayItems(weekStart, date, (items) =>
    items.map((item) =>
      item.id === itemId
        ? { ...item, slotLocked: !Boolean(item.slotLocked) }
        : item,
    ),
  );
}

/**
 * 曜日間で料理カードを移動（先が空）または交換する。
 */
export function moveOrSwapDishBetweenDays(
  weekStart: string,
  fromDate: string,
  toDate: string,
  itemId: string,
  targetItemId?: string | null,
): MealPlan {
  if (fromDate === toDate && !targetItemId) {
    return getOrCreateMealPlan(weekStart);
  }

  return updatePlanDays(weekStart, (days) => {
    const fromDay = days.find((day) => day.date === fromDate);
    const toDay = days.find((day) => day.date === toDate);
    if (!fromDay || !toDay) return days;

    const moving = fromDay.items.find((item) => item.id === itemId);
    if (!moving) return days;
    if (moving.slotLocked || fromDay.locked) return days;
    if (toDay.locked) return days;

    if (targetItemId) {
      const target = toDay.items.find((item) => item.id === targetItemId);
      if (!target || target.slotLocked) return days;

      return days.map((day) => {
        if (day.date === fromDate) {
          return {
            ...day,
            items: normalizeItems(
              day.items.map((item) =>
                item.id === itemId
                  ? {
                      ...target,
                      id: item.id,
                      order: item.order,
                    }
                  : item,
              ),
            ),
          };
        }
        if (day.date === toDate) {
          return {
            ...day,
            items: normalizeItems(
              day.items.map((item) =>
                item.id === targetItemId
                  ? {
                      ...moving,
                      id: item.id,
                      order: item.order,
                    }
                  : item,
              ),
            ),
          };
        }
        return day;
      });
    }

    // 移動: from から削除して to に追加
    return days.map((day) => {
      if (day.date === fromDate) {
        return {
          ...day,
          items: normalizeItems(day.items.filter((item) => item.id !== itemId)),
        };
      }
      if (day.date === toDate) {
        return {
          ...day,
          items: normalizeItems([
            ...day.items,
            { ...moving, id: crypto.randomUUID(), order: day.items.length + 1 },
          ]),
        };
      }
      return day;
    });
  });
}

/** 上下で並び替え */
export function moveDishItem(
  weekStart: string,
  date: string,
  itemId: string,
  direction: -1 | 1,
): MealPlan {
  return updateDayItems(weekStart, date, (items) => {
    const ordered = normalizeItems(items);
    const index = ordered.findIndex((item) => item.id === itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) {
      return ordered;
    }
    const next = [...ordered];
    const current = next[index];
    next[index] = next[target];
    next[target] = current;
    return next;
  });
}

/** 指定週をすべて空にする */
export function clearMealPlanWeek(weekStart: string): MealPlan {
  // 既存 day を再利用せず、空の7日で確実に置き換える
  return updatePlanDays(weekStart, () => createEmptyDays(weekStart));
}

/** 直近の献立から使ったレシピ ID を集める（頻度ペナルティ用） */
export function collectRecentRecipeIds(
  plans: MealPlan[],
  excludeWeekStart?: string,
  limit = 40,
): string[] {
  const ids: string[] = [];
  const sorted = [...plans].sort((left, right) =>
    right.weekStart.localeCompare(left.weekStart),
  );
  for (const plan of sorted) {
    if (excludeWeekStart && plan.weekStart === excludeWeekStart) {
      continue;
    }
    for (const day of plan.days) {
      for (const item of day.items) {
        if (item.recipeId && !ids.includes(item.recipeId)) {
          ids.push(item.recipeId);
          if (ids.length >= limit) {
            return ids;
          }
        }
      }
    }
  }
  return ids;
}

/**
 * 外部で組み立てた days で週を更新する（提案の採用など）
 */
export function replaceWeekDays(weekStart: string, days: DayMeal[]): MealPlan {
  return updatePlanDays(weekStart, () => days);
}

export type AutoFillResult = {
  plan: MealPlan;
  filledCount: number;
  priorityUsedCount: number;
};

/**
 * 空欄日だけ自動作成（献立エンジン v2）。
 * 基本構成: 主食・主菜・副菜・汁物 各1品。
 * 固定日・入力済み日は変更しない。
 */
export function autoFillBlankSlots(
  weekStart: string,
  recipes: Recipe[],
  inventory: InventoryItem[] = [],
  preferences?: HouseholdPreferences,
): AutoFillResult {
  if (recipes.length === 0) {
    const plans = loadMealPlans();
    const existing = plans.find((plan) => plan.weekStart === weekStart);
    return {
      plan: existing ?? createEmptyPlan(weekStart),
      filledCount: 0,
      priorityUsedCount: 0,
    };
  }

  const prefs = preferences ?? loadHouseholdPreferences();
  const allPlans = loadMealPlans();
  const recentRecipeIds = collectRecentRecipeIds(allPlans, weekStart);

  let filledCount = 0;
  let priorityUsedCount = 0;

  const plan = updatePlanDays(weekStart, (days) => {
    const result = mealPlannerEngine.planWeek({
      weekStart,
      days,
      recipes,
      inventory,
      preferences: prefs,
      recentRecipeIds,
    });
    filledCount = result.filledCount;
    priorityUsedCount = result.priorityUsedCount;
    return result.days;
  });

  return {
    plan,
    filledCount,
    priorityUsedCount,
  };
}

/** 週ごとの食費予算を更新 */
export function updateMealPlanBudget(
  weekStart: string,
  patch: {
    weeklyFoodBudgetYen?: number | null;
    budgetMode?: MealPlan["budgetMode"];
  },
): MealPlan {
  const plans = loadMealPlans();
  const index = plans.findIndex((plan) => plan.weekStart === weekStart);
  const base = index >= 0 ? plans[index] : createEmptyPlan(weekStart);
  const updated: MealPlan = {
    ...base,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (index >= 0) {
    const next = [...plans];
    next[index] = updated;
    persist(next);
  } else {
    persist([updated, ...plans]);
  }
  return updated;
}

/** repository / 同期用 */
export function replaceMealPlans(plans: MealPlan[]): void {
  persist(plans);
}
