import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import { loadFamilyMemberProfiles } from "@/lib/family-member-profiles";
import {
  DEFAULT_HOUSEHOLD_PREFERENCES,
  isActivityLevel,
  isConditionMode,
  isCookingTimeLimit,
  isHealthGoal,
  isMemberGender,
  type HouseholdMemberProfile,
  type HouseholdPreferences,
} from "@/types/meal-preferences";

type Listener = () => void;

const listeners = new Set<Listener>();

let cachedRaw: string | null | undefined = undefined;
let cachedPrefs: HouseholdPreferences | null = null;

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 20;

function clampServings(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_HOUSEHOLD_PREFERENCES.defaultMealServings;
  }
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(value)));
}

function pickDefaultMealServings(
  rawDefault: number | null,
  familyCount: number,
): number {
  if (rawDefault != null && Number.isFinite(rawDefault) && rawDefault >= 1) {
    return clampServings(rawDefault);
  }
  if (familyCount >= 1) {
    return clampServings(familyCount);
  }
  return DEFAULT_HOUSEHOLD_PREFERENCES.defaultMealServings;
}

function migrateMember(value: unknown): HouseholdMemberProfile | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const item = value as Record<string, unknown>;
  const age =
    typeof item.age === "number" && Number.isFinite(item.age)
      ? Math.max(0, Math.round(item.age))
      : null;
  return {
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    label: typeof item.label === "string" ? item.label : "",
    age,
    gender: isMemberGender(item.gender) ? item.gender : "未設定",
    activityLevel: isActivityLevel(item.activityLevel)
      ? item.activityLevel
      : "ふつう",
  };
}

function migratePreferences(value: unknown): HouseholdPreferences {
  const now = new Date().toISOString();
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_HOUSEHOLD_PREFERENCES, updatedAt: now };
  }

  const item = value as Record<string, unknown>;
  const members = Array.isArray(item.members)
    ? item.members
        .map((entry) => migrateMember(entry))
        .filter((entry): entry is HouseholdMemberProfile => entry !== null)
    : [];

  let familyCount = 0;
  try {
    familyCount = loadFamilyMemberProfiles().length;
  } catch {
    familyCount = members.length;
  }
  if (familyCount <= 0) {
    familyCount = members.length;
  }

  const rawDefault =
    typeof item.defaultMealServings === "number"
      ? item.defaultMealServings
      : typeof item.servingCount === "number"
        ? item.servingCount
        : null;

  const defaultMealServings = pickDefaultMealServings(
    rawDefault,
    familyCount,
  );

  return {
    defaultMealServings,
    // 既存エンジン互換: servingCount は通常人数と同値
    servingCount: defaultMealServings,
    members,
    healthGoal: isHealthGoal(item.healthGoal)
      ? item.healthGoal
      : DEFAULT_HOUSEHOLD_PREFERENCES.healthGoal,
    cookingTimeLimit: isCookingTimeLimit(item.cookingTimeLimit)
      ? item.cookingTimeLimit
      : DEFAULT_HOUSEHOLD_PREFERENCES.cookingTimeLimit,
    conditionMode: isConditionMode(item.conditionMode)
      ? item.conditionMode
      : DEFAULT_HOUSEHOLD_PREFERENCES.conditionMode,
    updatedAt:
      typeof item.updatedAt === "string"
        ? item.updatedAt
        : now,
  };
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function writePrefs(prefs: HouseholdPreferences): void {
  writeStorage(STORAGE_KEYS.mealPreferences, prefs);
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.mealPreferences);
  cachedPrefs = prefs;
}

export function loadHouseholdPreferences(): HouseholdPreferences {
  if (typeof window === "undefined") {
    return {
      ...DEFAULT_HOUSEHOLD_PREFERENCES,
      updatedAt: new Date().toISOString(),
    };
  }

  if (!hasStorageKey(STORAGE_KEYS.mealPreferences)) {
    let familyCount = 0;
    try {
      familyCount = loadFamilyMemberProfiles().length;
    } catch {
      familyCount = 0;
    }
    const defaultMealServings = pickDefaultMealServings(
      null,
      familyCount,
    );
    const initial: HouseholdPreferences = {
      ...DEFAULT_HOUSEHOLD_PREFERENCES,
      defaultMealServings,
      servingCount: defaultMealServings,
      updatedAt: new Date().toISOString(),
    };
    writePrefs(initial);
    return initial;
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.mealPreferences);
  if (raw === cachedRaw && cachedPrefs) {
    return cachedPrefs;
  }

  const stored = readStorage<unknown>(STORAGE_KEYS.mealPreferences);
  const prefs = migratePreferences(stored);
  writePrefs(prefs);
  return prefs;
}

export function saveHouseholdPreferences(
  patch: Partial<
    Omit<HouseholdPreferences, "updatedAt">
  >,
): HouseholdPreferences {
  const current = loadHouseholdPreferences();
  const nextDefaultRaw =
    patch.defaultMealServings ??
    patch.servingCount ??
    current.defaultMealServings;
  const defaultMealServings = clampServings(nextDefaultRaw);

  const next: HouseholdPreferences = {
    ...current,
    ...patch,
    defaultMealServings,
    servingCount: defaultMealServings,
    updatedAt: new Date().toISOString(),
  };
  writePrefs(next);
  notify();
  return next;
}

export function subscribeHouseholdPreferences(
  onStoreChange: Listener,
): () => void {
  listeners.add(onStoreChange);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEYS.mealPreferences || event.key === null) {
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

export function getHouseholdPreferencesSnapshot(): HouseholdPreferences {
  return loadHouseholdPreferences();
}

const EMPTY_PREFS: HouseholdPreferences = {
  ...DEFAULT_HOUSEHOLD_PREFERENCES,
  updatedAt: "",
};

export function getHouseholdPreferencesServerSnapshot(): HouseholdPreferences {
  return EMPTY_PREFS;
}
