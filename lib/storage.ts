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
  /** 食費予算・買い物先（端末ローカル） */
  foodBudgetSettings: "meal-planner:foodBudgetSettings",
  /** 食材価格履歴（家族同期対象） */
  ingredientPrices: "meal-planner:ingredientPrices",
  /** 登録店舗（家族同期対象） */
  stores: "meal-planner:stores",
  /** 週ごとの買い物先予定 */
  weekStorePlans: "meal-planner:weekStorePlans",
  /** レシート本体（家族同期対象） */
  receipts: "meal-planner:receipts",
  /** レシート明細（家族同期対象） */
  receiptItems: "meal-planner:receiptItems",
  /** 店舗商品名マッピング（家族同期対象） */
  storeProductMappings: "meal-planner:storeProductMappings",
  /** 店舗名統合履歴（端末ローカル学習） */
  storeMergeHistory: "meal-planner:storeMergeHistory",
  /** 食費取引・家計簿（家族同期対象） */
  foodExpenseTransactions: "meal-planner:foodExpenseTransactions",
  cookingFeedbacks: "meal-planner:cookingFeedbacks",
  recipeVariants: "meal-planner:recipeVariants",
  /** 家庭ごとの献立学習プロファイル（端末ローカル） */
  familyLearningProfile: "meal-planner:familyLearningProfile",
  /** 料理変更履歴（学習用・端末ローカル） */
  mealChangeEvents: "meal-planner:mealChangeEvents",
  /** サンプルレシピを一度でも投入（または初期化判定）したか */
  sampleRecipesInitialized: "meal-planner:sampleRecipesInitialized",
  /** ユーザーがサンプルを削除したか（自動再投入・同期での復活を禁止） */
  sampleRecipesDismissed: "meal-planner:sampleRecipesDismissed",
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
  STORAGE_KEYS.ingredientPrices,
  STORAGE_KEYS.stores,
  STORAGE_KEYS.receipts,
  STORAGE_KEYS.receiptItems,
  STORAGE_KEYS.storeProductMappings,
  STORAGE_KEYS.foodExpenseTransactions,
  STORAGE_KEYS.foodBudgetSettings,
  STORAGE_KEYS.cookingFeedbacks,
  STORAGE_KEYS.recipeVariants,
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
