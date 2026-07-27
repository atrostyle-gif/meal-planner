import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  DEFAULT_FOOD_BUDGET_SETTINGS,
  DEFAULT_MEAL_PLAN_SCORE_WEIGHTS,
  isBudgetMode,
  type FoodBudgetSettings,
  type MealPlanScoreWeights,
  type WeekBudgetOverride,
} from "@/types/food-budget";
import {
  DEFAULT_STORE_PROFILES,
  LOPIA_STORE_PROFILE,
  type StoreProfile,
} from "@/types/store-profile";

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedRaw: string | null | undefined = undefined;
let cached: FoodBudgetSettings | null = null;

function nullablePositiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  return value;
}

function migrateWeights(value: unknown): MealPlanScoreWeights {
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_MEAL_PLAN_SCORE_WEIGHTS };
  }
  const item = value as Record<string, unknown>;
  const pick = (key: keyof MealPlanScoreWeights): number => {
    const n = item[key];
    return typeof n === "number" && Number.isFinite(n) && n >= 0
      ? n
      : DEFAULT_MEAL_PLAN_SCORE_WEIGHTS[key];
  };
  return {
    time: pick("time"),
    variety: pick("variety"),
    fridge: pick("fridge"),
    health: pick("health"),
    budget: pick("budget"),
    bulkUsage: pick("bulkUsage"),
    perishable: pick("perishable"),
  };
}

function migrateStoreProfile(value: unknown): StoreProfile | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.name !== "string") return null;
  return {
    id: item.id,
    name: item.name,
    prefersBulkPurchase: item.prefersBulkPurchase === true,
    defaultPackSizeMultiplier:
      typeof item.defaultPackSizeMultiplier === "number" &&
      Number.isFinite(item.defaultPackSizeMultiplier) &&
      item.defaultPackSizeMultiplier > 0
        ? item.defaultPackSizeMultiplier
        : 1.5,
    priceHistoryEnabled: item.priceHistoryEnabled !== false,
    notes: typeof item.notes === "string" ? item.notes : "",
  };
}

function migrate(value: unknown): FoodBudgetSettings {
  const now = new Date().toISOString();
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_FOOD_BUDGET_SETTINGS, updatedAt: now };
  }
  const item = value as Record<string, unknown>;
  const profilesRaw = Array.isArray(item.storeProfiles)
    ? item.storeProfiles
        .map(migrateStoreProfile)
        .filter((entry): entry is StoreProfile => entry !== null)
    : [];
  const storeProfiles =
    profilesRaw.length > 0 ? profilesRaw : DEFAULT_STORE_PROFILES;

  const defaultStoreProfileId =
    typeof item.defaultStoreProfileId === "string" &&
    storeProfiles.some((profile) => profile.id === item.defaultStoreProfileId)
      ? item.defaultStoreProfileId
      : LOPIA_STORE_PROFILE.id;

  const primaryStoreName =
    typeof item.primaryStoreName === "string" && item.primaryStoreName.trim() !== ""
      ? item.primaryStoreName.trim()
      : storeProfiles.find((p) => p.id === defaultStoreProfileId)?.name ??
        LOPIA_STORE_PROFILE.name;

  const weekBudgetOverrides: Record<string, WeekBudgetOverride> = {};
  if (
    typeof item.weekBudgetOverrides === "object" &&
    item.weekBudgetOverrides !== null
  ) {
    for (const [weekStart, raw] of Object.entries(
      item.weekBudgetOverrides as Record<string, unknown>,
    )) {
      if (typeof raw !== "object" || raw === null) continue;
      const entry = raw as Record<string, unknown>;
      weekBudgetOverrides[weekStart] = {
        weeklyFoodBudgetYen: nullablePositiveNumber(entry.weeklyFoodBudgetYen),
        budgetMode: isBudgetMode(entry.budgetMode) ? entry.budgetMode : null,
      };
    }
  }

  const startDay =
    typeof item.monthlyBudgetStartDay === "number" &&
    Number.isInteger(item.monthlyBudgetStartDay) &&
    item.monthlyBudgetStartDay >= 1 &&
    item.monthlyBudgetStartDay <= 28
      ? item.monthlyBudgetStartDay
      : DEFAULT_FOOD_BUDGET_SETTINGS.monthlyBudgetStartDay;

  return {
    primaryStoreName,
    defaultStoreProfileId,
    storeProfiles,
    weeklyFoodBudgetYen: nullablePositiveNumber(item.weeklyFoodBudgetYen),
    monthlyFoodBudgetYen: nullablePositiveNumber(item.monthlyFoodBudgetYen),
    monthlyBudgetStartDay: startDay,
    includePreparedFood: item.includePreparedFood !== false,
    includeEatingOut: item.includeEatingOut === true,
    includeHouseholdGoods: item.includeHouseholdGoods === true,
    budgetMode: isBudgetMode(item.budgetMode)
      ? item.budgetMode
      : DEFAULT_FOOD_BUDGET_SETTINGS.budgetMode,
    scoreWeights: migrateWeights(item.scoreWeights),
    weekBudgetOverrides,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

function write(settings: FoodBudgetSettings): void {
  writeStorage(STORAGE_KEYS.foodBudgetSettings, settings);
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.foodBudgetSettings);
  cached = settings;
  listeners.forEach((listener) => listener());
}

export function loadFoodBudgetSettings(): FoodBudgetSettings {
  if (typeof window === "undefined") {
    return {
      ...DEFAULT_FOOD_BUDGET_SETTINGS,
      storeProfiles: DEFAULT_STORE_PROFILES.map((p) => ({ ...p })),
      scoreWeights: { ...DEFAULT_MEAL_PLAN_SCORE_WEIGHTS },
      updatedAt: new Date().toISOString(),
    };
  }
  if (!hasStorageKey(STORAGE_KEYS.foodBudgetSettings)) {
    const initial = {
      ...DEFAULT_FOOD_BUDGET_SETTINGS,
      storeProfiles: DEFAULT_STORE_PROFILES.map((p) => ({ ...p })),
      scoreWeights: { ...DEFAULT_MEAL_PLAN_SCORE_WEIGHTS },
      updatedAt: new Date().toISOString(),
    };
    write(initial);
    return initial;
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.foodBudgetSettings);
  if (raw === cachedRaw && cached) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.foodBudgetSettings);
  const settings = migrate(stored);
  write(settings);
  return settings;
}

export function saveFoodBudgetSettings(
  patch: Partial<Omit<FoodBudgetSettings, "updatedAt">>,
): FoodBudgetSettings {
  const current = loadFoodBudgetSettings();
  const next: FoodBudgetSettings = {
    ...current,
    ...patch,
    storeProfiles: patch.storeProfiles ?? current.storeProfiles,
    scoreWeights: patch.scoreWeights
      ? { ...current.scoreWeights, ...patch.scoreWeights }
      : current.scoreWeights,
    updatedAt: new Date().toISOString(),
  };
  write(next);
  return next;
}

export function getActiveStoreProfile(
  settings: FoodBudgetSettings = loadFoodBudgetSettings(),
): StoreProfile {
  return (
    settings.storeProfiles.find(
      (profile) => profile.id === settings.defaultStoreProfileId,
    ) ??
    settings.storeProfiles[0] ??
    LOPIA_STORE_PROFILE
  );
}

/** 週次予算（週上書き → MealPlan → 世帯デフォルト） */
export function resolveWeekFoodBudget(
  weekStart: string,
  planBudgetYen?: number | null,
  settings: FoodBudgetSettings = loadFoodBudgetSettings(),
): number | null {
  const override = settings.weekBudgetOverrides[weekStart];
  if (override && "weeklyFoodBudgetYen" in override) {
    return override.weeklyFoodBudgetYen;
  }
  if (planBudgetYen !== undefined) {
    return planBudgetYen;
  }
  return settings.weeklyFoodBudgetYen;
}

export function saveWeekBudgetOverride(
  weekStart: string,
  patch: WeekBudgetOverride,
): FoodBudgetSettings {
  const current = loadFoodBudgetSettings();
  return saveFoodBudgetSettings({
    weekBudgetOverrides: {
      ...current.weekBudgetOverrides,
      [weekStart]: {
        ...current.weekBudgetOverrides[weekStart],
        ...patch,
      },
    },
  });
}

export function subscribeFoodBudgetSettings(onStoreChange: Listener): () => void {
  listeners.add(onStoreChange);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEYS.foodBudgetSettings || event.key === null) {
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

export function getFoodBudgetSettingsSnapshot(): FoodBudgetSettings {
  return loadFoodBudgetSettings();
}

const EMPTY_SNAPSHOT: FoodBudgetSettings = {
  ...DEFAULT_FOOD_BUDGET_SETTINGS,
  storeProfiles: DEFAULT_STORE_PROFILES.map((p) => ({ ...p })),
  scoreWeights: { ...DEFAULT_MEAL_PLAN_SCORE_WEIGHTS },
  updatedAt: "",
};

export function getFoodBudgetSettingsServerSnapshot(): FoodBudgetSettings {
  return EMPTY_SNAPSHOT;
}
