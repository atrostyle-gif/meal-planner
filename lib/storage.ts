/** localStorage のキー */
export const STORAGE_KEYS = {
  recipes: "meal-planner:recipes",
  mealPlans: "meal-planner:mealPlans",
  inventory: "meal-planner:inventory",
  shoppingLists: "meal-planner:shoppingLists",
  pantryStock: "meal-planner:pantryStock",
  mealPreferences: "meal-planner:mealPreferences",
  familyMemberProfiles: "meal-planner:familyMemberProfiles",
  foodMasters: "meal-planner:foodMasters",
  foodAliasMappings: "meal-planner:foodAliasMappings",
  dailyConditions: "meal-planner:dailyConditions",
  householdNutritionPreferences: "meal-planner:householdNutritionPreferences",
  weeklyCookingSchedules: "meal-planner:weeklyCookingSchedules",
  cookingMemberProfiles: "meal-planner:cookingMemberProfiles",
  dailyCookingOverrides: "meal-planner:dailyCookingOverrides",
  cookingHistory: "meal-planner:cookingHistory",
  leftoverIngredients: "meal-planner:leftoverIngredients",
  diabetesMealSupport: "meal-planner:diabetesMealSupport",
  cookingFeedbacks: "meal-planner:cookingFeedbacks",
  recipeVariants: "meal-planner:recipeVariants",
} as const;

/**
 * localStorage から JSON を読み取る。
 * サーバー側や未対応環境では null を返す。
 */
export function readStorage<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 同一タブ内の変更通知（Supabase 同期用） */
export const LOCAL_DATA_CHANGED_EVENT = "meal-planner:local-data-changed";

/** クラウドへ同期するキー（端末書き込み直後の pull 上書き防止に使う） */
const SYNCABLE_STORAGE_KEYS = new Set<string>([
  STORAGE_KEYS.recipes,
  STORAGE_KEYS.mealPlans,
  STORAGE_KEYS.inventory,
  STORAGE_KEYS.shoppingLists,
  STORAGE_KEYS.pantryStock,
  STORAGE_KEYS.familyMemberProfiles,
  STORAGE_KEYS.householdNutritionPreferences,
  STORAGE_KEYS.dailyConditions,
  STORAGE_KEYS.foodAliasMappings,
  STORAGE_KEYS.weeklyCookingSchedules,
  STORAGE_KEYS.cookingMemberProfiles,
  STORAGE_KEYS.dailyCookingOverrides,
  STORAGE_KEYS.cookingHistory,
  STORAGE_KEYS.leftoverIngredients,
]);

let lastSyncableLocalWriteAt = 0;

/** 直近の端末書き込み時刻（同期レース防止用） */
export function getLastSyncableLocalWriteAt(): number {
  return lastSyncableLocalWriteAt;
}

/** localStorage に JSON を書き込む */
export function writeStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  if (SYNCABLE_STORAGE_KEYS.has(key)) {
    lastSyncableLocalWriteAt = Date.now();
  }

  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(
    new CustomEvent(LOCAL_DATA_CHANGED_EVENT, { detail: { key } }),
  );
}

/** キーが存在するかどうか */
export function hasStorageKey(key: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(key) !== null;
}
