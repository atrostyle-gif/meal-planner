import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  isAgeGroup,
  isDietaryRestriction,
  isMemberGoal,
  isProfileActivityLevel,
  type FamilyMemberProfile,
  type FamilyMemberProfileInput,
} from "@/types/family-member-profile";

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cached: FamilyMemberProfile[] = [];

function migrateProfile(value: unknown): FamilyMemberProfile | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.displayName !== "string") {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: item.id,
    householdId: typeof item.householdId === "string" ? item.householdId : "local",
    userId: typeof item.userId === "string" ? item.userId : null,
    displayName: item.displayName,
    birthYear: typeof item.birthYear === "number" ? item.birthYear : null,
    ageGroup: isAgeGroup(item.ageGroup) ? item.ageGroup : "未設定",
    sex:
      item.sex === "男性" || item.sex === "女性" || item.sex === "その他" || item.sex === "未設定"
        ? item.sex
        : "未設定",
    activityLevel: isProfileActivityLevel(item.activityLevel)
      ? item.activityLevel
      : "未設定",
    calorieTarget: typeof item.calorieTarget === "number" ? item.calorieTarget : null,
    proteinTarget: typeof item.proteinTarget === "number" ? item.proteinTarget : null,
    saltLimit: typeof item.saltLimit === "number" ? item.saltLimit : null,
    goals: Array.isArray(item.goals)
      ? item.goals.filter(isMemberGoal)
      : [],
    allergies: Array.isArray(item.allergies)
      ? item.allergies.filter((a): a is string => typeof a === "string")
      : [],
    dislikedIngredients: Array.isArray(item.dislikedIngredients)
      ? item.dislikedIngredients.filter((a): a is string => typeof a === "string")
      : [],
    dietaryRestrictions: Array.isArray(item.dietaryRestrictions)
      ? item.dietaryRestrictions.filter(isDietaryRestriction)
      : ["なし"],
    notes: typeof item.notes === "string" ? item.notes : null,
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

export function saveFamilyMemberProfile(
  input: FamilyMemberProfileInput,
): FamilyMemberProfile {
  const now = new Date().toISOString();
  const profiles = loadFamilyMemberProfiles();
  const existing = input.id
    ? profiles.find((p) => p.id === input.id)
    : undefined;
  const next: FamilyMemberProfile = {
    id: existing?.id ?? crypto.randomUUID(),
    householdId: input.householdId || "local",
    userId: input.userId ?? null,
    displayName: input.displayName.trim() || "メンバー",
    birthYear: input.birthYear ?? null,
    ageGroup: input.ageGroup,
    sex: input.sex ?? "未設定",
    activityLevel: input.activityLevel,
    calorieTarget: input.calorieTarget ?? null,
    proteinTarget: input.proteinTarget ?? null,
    saltLimit: input.saltLimit ?? null,
    goals: input.goals,
    allergies: input.allergies,
    dislikedIngredients: input.dislikedIngredients,
    dietaryRestrictions:
      input.dietaryRestrictions.length > 0 ? input.dietaryRestrictions : ["なし"],
    notes: input.notes ?? null,
    isActive: input.isActive,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const without = profiles.filter((p) => p.id !== next.id);
  persist([next, ...without]);
  return next;
}

export function deleteFamilyMemberProfile(id: string): void {
  persist(loadFamilyMemberProfiles().filter((p) => p.id !== id));
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
  const dietary = new Set<import("@/types/family-member-profile").DietaryRestriction>();
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
