import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  DAYS_OF_WEEK,
  isDayOfWeek,
  isEffortLevel,
  type DayOfWeek,
  type EffortLevel,
  type WeeklyCookingSchedule,
} from "@/types/weekly-lifestyle";

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cached: WeeklyCookingSchedule[] = [];

function migrate(value: unknown): WeeklyCookingSchedule | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || !isDayOfWeek(item.dayOfWeek)) return null;
  const now = new Date().toISOString();
  return {
    id: item.id,
    householdId: typeof item.householdId === "string" ? item.householdId : "local",
    dayOfWeek: item.dayOfWeek,
    defaultCookMemberId:
      typeof item.defaultCookMemberId === "string" ? item.defaultCookMemberId : null,
    backupCookMemberIds: Array.isArray(item.backupCookMemberIds)
      ? item.backupCookMemberIds.filter((id): id is string => typeof id === "string")
      : [],
    cookingTimeLimitMinutes:
      typeof item.cookingTimeLimitMinutes === "number"
        ? item.cookingTimeLimitMinutes
        : null,
    effortLevel: isEffortLevel(item.effortLevel) ? item.effortLevel : "normal",
    shoppingAvailable: item.shoppingAvailable === true,
    isShoppingDay: item.isShoppingDay === true,
    allowNewRecipes: item.allowNewRecipes !== false,
    preferFamiliarRecipes: item.preferFamiliarRecipes === true,
    allowBatchCooking: item.allowBatchCooking === true,
    preferLowCleanup: item.preferLowCleanup === true,
    maxStepCount: typeof item.maxStepCount === "number" ? item.maxStepCount : null,
    avoidDeepFrying: item.avoidDeepFrying === true,
    preferMakeAhead: item.preferMakeAhead === true,
    notes: typeof item.notes === "string" ? item.notes : null,
    isActive: item.isActive !== false,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

function persist(list: WeeklyCookingSchedule[]): void {
  writeStorage(STORAGE_KEYS.weeklyCookingSchedules, list);
  cached = list;
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.weeklyCookingSchedules);
  listeners.forEach((l) => l());
}

export function loadWeeklyCookingSchedules(): WeeklyCookingSchedule[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.weeklyCookingSchedules)) {
    persist([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.weeklyCookingSchedules);
  if (raw === cachedRaw && cachedRaw !== undefined) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.weeklyCookingSchedules);
  const list = Array.isArray(stored)
    ? stored.map(migrate).filter((s): s is WeeklyCookingSchedule => s !== null)
    : [];
  cached = list;
  cachedRaw = raw;
  return list;
}

export function replaceWeeklyCookingSchedules(
  list: WeeklyCookingSchedule[],
): void {
  if (typeof window === "undefined") return;
  persist(list);
}

export function upsertWeeklyCookingSchedule(
  schedule: WeeklyCookingSchedule,
): WeeklyCookingSchedule {
  const list = loadWeeklyCookingSchedules().filter(
    (item) =>
      !(
        item.householdId === schedule.householdId &&
        item.dayOfWeek === schedule.dayOfWeek
      ) && item.id !== schedule.id,
  );
  const next = {
    ...schedule,
    updatedAt: new Date().toISOString(),
  };
  persist([next, ...list]);
  return next;
}

export function getScheduleForDay(
  householdId: string,
  dayOfWeek: DayOfWeek,
): WeeklyCookingSchedule | null {
  return (
    loadWeeklyCookingSchedules().find(
      (item) =>
        item.isActive &&
        item.dayOfWeek === dayOfWeek &&
        (item.householdId === householdId || item.householdId === "local"),
    ) ?? null
  );
}

export function subscribeWeeklyCookingSchedules(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWeeklyCookingSchedulesSnapshot(): WeeklyCookingSchedule[] {
  return loadWeeklyCookingSchedules();
}

const EMPTY: WeeklyCookingSchedule[] = [];
export function getWeeklyCookingSchedulesServerSnapshot(): WeeklyCookingSchedule[] {
  return EMPTY;
}

type PresetInput = {
  dayOfWeek: DayOfWeek;
  cookKey: "wife" | "husband" | "daughter";
  cookingTimeLimitMinutes: number | null;
  effortLevel: EffortLevel;
  isShoppingDay: boolean;
  allowNewRecipes: boolean;
  preferFamiliarRecipes: boolean;
  allowBatchCooking: boolean;
  preferLowCleanup: boolean;
  maxStepCount: number | null;
  avoidDeepFrying: boolean;
  notes: string;
};

const FAMILY_PRESET: PresetInput[] = [
  {
    dayOfWeek: "monday",
    cookKey: "wife",
    cookingTimeLimitMinutes: null,
    effortLevel: "elaborate",
    isShoppingDay: true,
    allowNewRecipes: true,
    preferFamiliarRecipes: false,
    allowBatchCooking: true,
    preferLowCleanup: false,
    maxStepCount: null,
    avoidDeepFrying: false,
    notes: "妻が休み。買い出し・作り置き・新しい料理可",
  },
  {
    dayOfWeek: "tuesday",
    cookKey: "husband",
    cookingTimeLimitMinutes: 30,
    effortLevel: "easy",
    isShoppingDay: false,
    allowNewRecipes: false,
    preferFamiliarRecipes: true,
    allowBatchCooking: false,
    preferLowCleanup: false,
    maxStepCount: 8,
    avoidDeepFrying: false,
    notes: "夫担当。時短・慣れた料理",
  },
  {
    dayOfWeek: "wednesday",
    cookKey: "husband",
    cookingTimeLimitMinutes: 30,
    effortLevel: "easy",
    isShoppingDay: false,
    allowNewRecipes: false,
    preferFamiliarRecipes: true,
    allowBatchCooking: false,
    preferLowCleanup: true,
    maxStepCount: 8,
    avoidDeepFrying: false,
    notes: "夫担当。洗い物少なめ",
  },
  {
    dayOfWeek: "thursday",
    cookKey: "wife",
    cookingTimeLimitMinutes: null,
    effortLevel: "elaborate",
    isShoppingDay: false,
    allowNewRecipes: true,
    preferFamiliarRecipes: false,
    allowBatchCooking: true,
    preferLowCleanup: false,
    maxStepCount: null,
    avoidDeepFrying: false,
    notes: "妻が休み。手の込んだ料理・作り置き可",
  },
  {
    dayOfWeek: "friday",
    cookKey: "daughter",
    cookingTimeLimitMinutes: 25,
    effortLevel: "very_easy",
    isShoppingDay: false,
    allowNewRecipes: false,
    preferFamiliarRecipes: true,
    allowBatchCooking: false,
    preferLowCleanup: true,
    maxStepCount: 5,
    avoidDeepFrying: true,
    notes: "娘担当。初心者向け・揚げ物回避",
  },
  {
    dayOfWeek: "saturday",
    cookKey: "husband",
    cookingTimeLimitMinutes: 60,
    effortLevel: "elaborate",
    isShoppingDay: false,
    allowNewRecipes: true,
    preferFamiliarRecipes: false,
    allowBatchCooking: false,
    preferLowCleanup: false,
    maxStepCount: null,
    avoidDeepFrying: false,
    notes: "夫担当。時間に余裕",
  },
  {
    dayOfWeek: "sunday",
    cookKey: "husband",
    cookingTimeLimitMinutes: 60,
    effortLevel: "elaborate",
    isShoppingDay: false,
    allowNewRecipes: true,
    preferFamiliarRecipes: false,
    allowBatchCooking: false,
    preferLowCleanup: false,
    maxStepCount: null,
    avoidDeepFrying: false,
    notes: "夫担当。家族向け・新しい料理可",
  },
];

/**
 * 平元家向け初期プリセットを登録する。
 * memberIds: { wife, husband, daughter } の FamilyMemberProfile.id
 */
export function applyFamilyWeeklyPreset(
  householdId: string,
  memberIds: { wife?: string; husband?: string; daughter?: string },
): number {
  const now = new Date().toISOString();
  const created = FAMILY_PRESET.map((preset) => {
    const cookId =
      preset.cookKey === "wife"
        ? memberIds.wife ?? null
        : preset.cookKey === "husband"
          ? memberIds.husband ?? null
          : memberIds.daughter ?? null;
    const schedule: WeeklyCookingSchedule = {
      id: crypto.randomUUID(),
      householdId,
      dayOfWeek: preset.dayOfWeek,
      defaultCookMemberId: cookId,
      backupCookMemberIds: [],
      cookingTimeLimitMinutes: preset.cookingTimeLimitMinutes,
      effortLevel: preset.effortLevel,
      shoppingAvailable: preset.isShoppingDay,
      isShoppingDay: preset.isShoppingDay,
      allowNewRecipes: preset.allowNewRecipes,
      preferFamiliarRecipes: preset.preferFamiliarRecipes,
      allowBatchCooking: preset.allowBatchCooking,
      preferLowCleanup: preset.preferLowCleanup,
      maxStepCount: preset.maxStepCount,
      avoidDeepFrying: preset.avoidDeepFrying,
      preferMakeAhead: preset.allowBatchCooking,
      notes: preset.notes,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    return schedule;
  });

  const others = loadWeeklyCookingSchedules().filter(
    (item) => item.householdId !== householdId,
  );
  persist([...created, ...others]);
  return created.length;
}

export function ensureWeekCoverage(householdId: string): void {
  const existing = loadWeeklyCookingSchedules().filter(
    (item) => item.householdId === householdId,
  );
  if (existing.length >= 7) return;
  const now = new Date().toISOString();
  const missing = DAYS_OF_WEEK.filter(
    (day) => !existing.some((item) => item.dayOfWeek === day),
  );
  if (missing.length === 0) return;
  const extras = missing.map((day) => ({
    id: crypto.randomUUID(),
    householdId,
    dayOfWeek: day,
    defaultCookMemberId: null,
    backupCookMemberIds: [],
    cookingTimeLimitMinutes: 45,
    effortLevel: "normal" as const,
    shoppingAvailable: false,
    isShoppingDay: false,
    allowNewRecipes: true,
    preferFamiliarRecipes: false,
    allowBatchCooking: false,
    preferLowCleanup: false,
    maxStepCount: null,
    avoidDeepFrying: false,
    preferMakeAhead: false,
    notes: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }));
  persist([...extras, ...existing, ...loadWeeklyCookingSchedules().filter((i) => i.householdId !== householdId)]);
}
