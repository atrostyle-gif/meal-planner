import {
  estimateStandardNutrition,
  migrateHealthFlagsFromGoals,
  packProfileNotes,
  parseExtraFromUnknown,
  resolveAge,
  unpackProfileNotes,
} from "@/lib/family-profile-helpers";
import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  ensureWeekCoverage,
  loadWeeklyCookingSchedules,
  upsertWeeklyCookingSchedule,
} from "@/lib/weekly-cooking-schedules";
import {
  isAgeGroup,
  isCookingDayKey,
  isDietaryRestriction,
  isFoodPreferenceTag,
  isHealthConditionFlagId,
  isMemberGoal,
  isProfileActivityLevel,
  isServingPortion,
  type CookingDayKey,
  type FamilyMemberProfile,
  type FamilyMemberProfileInput,
} from "@/types/family-member-profile";

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cached: FamilyMemberProfile[] = [];

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * 既存データ（旧フィールドのみ）も新プロフィール形へ自動移行する。
 */
export function migrateProfile(value: unknown): FamilyMemberProfile | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.displayName !== "string") {
    return null;
  }
  const now = new Date().toISOString();
  const goals = Array.isArray(item.goals)
    ? item.goals.filter(isMemberGoal)
    : [];

  // 新フィールドがトップレベルにあれば優先。なければ notes 内の拡張から復元
  const unpacked = unpackProfileNotes(
    typeof item.notes === "string" ? item.notes : null,
  );
  const fromNotes = parseExtraFromUnknown(unpacked.extra);

  const age = resolveAge(
    typeof item.age === "number"
      ? item.age
      : fromNotes.age,
    typeof item.birthYear === "number" ? item.birthYear : null,
  );

  const servingPortion = isServingPortion(item.servingPortion)
    ? item.servingPortion
    : fromNotes.servingPortion;

  const healthFlagsRaw = Array.isArray(item.healthFlags)
    ? item.healthFlags.filter(isHealthConditionFlagId)
    : fromNotes.healthFlags;
  const healthFlags = migrateHealthFlagsFromGoals(goals, healthFlagsRaw);

  const likedIngredients = Array.isArray(item.likedIngredients)
    ? asStringArray(item.likedIngredients)
    : fromNotes.likedIngredients;

  const foodPreferences = Array.isArray(item.foodPreferences)
    ? item.foodPreferences.filter(isFoodPreferenceTag)
    : fromNotes.foodPreferences;

  const cookingDays = Array.isArray(item.cookingDays)
    ? item.cookingDays.filter(isCookingDayKey)
    : fromNotes.cookingDays;

  const useStandardNutrition =
    typeof item.useStandardNutrition === "boolean"
      ? item.useStandardNutrition
      : typeof fromNotes.useStandardNutrition === "boolean"
        ? fromNotes.useStandardNutrition
        : // 旧データで目標値が入っている場合は手動扱い（上書きしない）
          !(
            typeof item.calorieTarget === "number" ||
            typeof item.proteinTarget === "number"
          );

  const fatTarget =
    typeof item.fatTarget === "number" ? item.fatTarget : fromNotes.fatTarget;
  const carbTarget =
    typeof item.carbTarget === "number" ? item.carbTarget : fromNotes.carbTarget;

  const sex =
    item.sex === "男性" ||
    item.sex === "女性" ||
    item.sex === "その他" ||
    item.sex === "未設定"
      ? item.sex
      : "未設定";
  const activityLevel = isProfileActivityLevel(item.activityLevel)
    ? item.activityLevel
    : "未設定";

  let calorieTarget =
    typeof item.calorieTarget === "number" ? item.calorieTarget : null;
  let proteinTarget =
    typeof item.proteinTarget === "number" ? item.proteinTarget : null;
  let fat = fatTarget;
  let carb = carbTarget;

  if (useStandardNutrition) {
    const estimated = estimateStandardNutrition({
      age,
      sex,
      activityLevel,
      servingPortion,
    });
    calorieTarget = estimated.calorieTarget;
    proteinTarget = estimated.proteinTarget;
    fat = estimated.fatTarget;
    carb = estimated.carbTarget;
  }

  return {
    id: item.id,
    householdId:
      typeof item.householdId === "string" ? item.householdId : "local",
    userId: typeof item.userId === "string" ? item.userId : null,
    displayName: item.displayName,
    age,
    birthYear: typeof item.birthYear === "number" ? item.birthYear : null,
    ageGroup: isAgeGroup(item.ageGroup) ? item.ageGroup : "未設定",
    sex,
    activityLevel,
    servingPortion,
    calorieTarget,
    proteinTarget,
    fatTarget: fat,
    carbTarget: carb,
    saltLimit: typeof item.saltLimit === "number" ? item.saltLimit : null,
    useStandardNutrition,
    goals,
    healthFlags,
    allergies: asStringArray(item.allergies),
    dislikedIngredients: asStringArray(item.dislikedIngredients),
    likedIngredients,
    dietaryRestrictions: Array.isArray(item.dietaryRestrictions)
      ? item.dietaryRestrictions.filter(isDietaryRestriction)
      : ["なし"],
    foodPreferences,
    cookingDays,
    notes: unpacked.notes,
    healthNotes:
      typeof item.healthNotes === "string"
        ? item.healthNotes
        : fromNotes.healthNotes,
    isActive: item.isActive !== false,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

function notify(): void {
  listeners.forEach((l) => l());
}

function persist(profiles: FamilyMemberProfile[]): void {
  writeStorage(STORAGE_KEYS.familyMemberProfiles, profiles);
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.familyMemberProfiles);
  cached = profiles;
  notify();
}

export function loadFamilyMemberProfiles(): FamilyMemberProfile[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.familyMemberProfiles)) {
    persist([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.familyMemberProfiles);
  if (raw === cachedRaw && cachedRaw !== undefined) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.familyMemberProfiles);
  const list = Array.isArray(stored)
    ? stored.map(migrateProfile).filter((p): p is FamilyMemberProfile => p !== null)
    : [];
  cachedRaw = raw;
  cached = list;
  return list;
}

export function replaceFamilyMemberProfiles(
  profiles: FamilyMemberProfile[],
): void {
  if (typeof window !== "undefined") {
    persist(profiles);
  }
}

/**
 * 料理担当曜日を週間スケジュールへ反映する。
 */
export function syncCookingDaysToWeeklySchedule(
  householdId: string,
  memberId: string,
  cookingDays: readonly CookingDayKey[],
): void {
  ensureWeekCoverage(householdId);
  const selected = new Set(cookingDays);
  const schedules = loadWeeklyCookingSchedules().filter(
    (item) => item.householdId === householdId,
  );
  for (const schedule of schedules) {
    const wants = selected.has(schedule.dayOfWeek as CookingDayKey);
    if (wants) {
      if (schedule.defaultCookMemberId !== memberId) {
        upsertWeeklyCookingSchedule({
          ...schedule,
          defaultCookMemberId: memberId,
        });
      }
    } else if (schedule.defaultCookMemberId === memberId) {
      upsertWeeklyCookingSchedule({
        ...schedule,
        defaultCookMemberId: null,
      });
    }
  }
}

/**
 * 週間スケジュールからメンバーの担当曜日を読み取る（移行用）。
 */
export function cookingDaysFromWeeklySchedule(
  householdId: string,
  memberId: string,
): CookingDayKey[] {
  return loadWeeklyCookingSchedules()
    .filter(
      (item) =>
        item.householdId === householdId &&
        item.defaultCookMemberId === memberId &&
        isCookingDayKey(item.dayOfWeek),
    )
    .map((item) => item.dayOfWeek as CookingDayKey);
}

export function saveFamilyMemberProfile(
  input: FamilyMemberProfileInput,
): FamilyMemberProfile {
  const now = new Date().toISOString();
  const profiles = loadFamilyMemberProfiles();
  const existing = input.id
    ? profiles.find((p) => p.id === input.id)
    : undefined;

  const age = resolveAge(input.age, input.birthYear);
  const servingPortion = input.servingPortion ?? "普通";
  const useStandardNutrition = input.useStandardNutrition !== false;

  let calorieTarget = input.calorieTarget ?? null;
  let proteinTarget = input.proteinTarget ?? null;
  let fatTarget = input.fatTarget ?? null;
  let carbTarget = input.carbTarget ?? null;

  if (useStandardNutrition) {
    const estimated = estimateStandardNutrition({
      age,
      sex: input.sex,
      activityLevel: input.activityLevel,
      servingPortion,
    });
    calorieTarget = estimated.calorieTarget;
    proteinTarget = estimated.proteinTarget;
    fatTarget = estimated.fatTarget;
    carbTarget = estimated.carbTarget;
  }

  const cookingDays =
    input.cookingDays ??
    existing?.cookingDays ??
    (existing
      ? cookingDaysFromWeeklySchedule(input.householdId || "local", existing.id)
      : []);

  const next: FamilyMemberProfile = {
    id: existing?.id ?? crypto.randomUUID(),
    householdId: input.householdId || "local",
    userId: input.userId ?? null,
    displayName: input.displayName.trim() || "メンバー",
    age,
    birthYear: input.birthYear ?? null,
    ageGroup: input.ageGroup,
    sex: input.sex ?? "未設定",
    activityLevel: input.activityLevel,
    servingPortion,
    calorieTarget,
    proteinTarget,
    fatTarget,
    carbTarget,
    saltLimit: input.saltLimit ?? null,
    useStandardNutrition,
    goals: input.goals,
    healthFlags: migrateHealthFlagsFromGoals(input.goals, input.healthFlags),
    allergies: input.allergies,
    dislikedIngredients: input.dislikedIngredients,
    likedIngredients: input.likedIngredients,
    dietaryRestrictions:
      input.dietaryRestrictions.length > 0
        ? input.dietaryRestrictions
        : ["なし"],
    foodPreferences: input.foodPreferences,
    cookingDays,
    notes: input.notes ?? null,
    healthNotes: input.healthNotes ?? null,
    isActive: input.isActive,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const without = profiles.filter((p) => p.id !== next.id);
  persist([next, ...without]);
  syncCookingDaysToWeeklySchedule(
    next.householdId,
    next.id,
    next.cookingDays,
  );
  return next;
}

export function deleteFamilyMemberProfile(id: string): void {
  const profiles = loadFamilyMemberProfiles();
  const target = profiles.find((p) => p.id === id);
  if (target) {
    syncCookingDaysToWeeklySchedule(target.householdId, id, []);
  }
  persist(profiles.filter((p) => p.id !== id));
}

export function subscribeFamilyMemberProfiles(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEYS.familyMemberProfiles || event.key === null) {
      cachedRaw = undefined;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getFamilyMemberProfilesSnapshot(): FamilyMemberProfile[] {
  return loadFamilyMemberProfiles();
}

const EMPTY: FamilyMemberProfile[] = [];
export function getFamilyMemberProfilesServerSnapshot(): FamilyMemberProfile[] {
  return EMPTY;
}

export function collectActiveConstraints(profiles: FamilyMemberProfile[]): {
  allergies: string[];
  dietaryRestrictions: import("@/types/family-member-profile").DietaryRestriction[];
} {
  const allergies = new Set<string>();
  const dietary = new Set<
    import("@/types/family-member-profile").DietaryRestriction
  >();
  for (const profile of profiles.filter((p) => p.isActive)) {
    profile.allergies.forEach((a) => allergies.add(a));
    profile.dietaryRestrictions.forEach((d) => {
      if (d !== "なし") dietary.add(d);
    });
  }
  return {
    allergies: [...allergies],
    dietaryRestrictions: [...dietary],
  };
}

/** クラウド同期用: notes に拡張フィールドを埋め込む */
export function profileForCloudSync(
  profile: FamilyMemberProfile,
): FamilyMemberProfile & { notes: string | null } {
  return {
    ...profile,
    notes: packProfileNotes(profile.notes, {
      age: profile.age,
      servingPortion: profile.servingPortion,
      fatTarget: profile.fatTarget,
      carbTarget: profile.carbTarget,
      useStandardNutrition: profile.useStandardNutrition,
      healthFlags: profile.healthFlags,
      likedIngredients: profile.likedIngredients,
      foodPreferences: profile.foodPreferences,
      cookingDays: profile.cookingDays,
      healthNotes: profile.healthNotes,
    }),
  };
}
