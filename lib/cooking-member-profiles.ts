import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  isCookingLevel,
  type CookingLevel,
  type CookingMemberProfile,
} from "@/types/weekly-lifestyle";

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cached: CookingMemberProfile[] = [];

function migrate(value: unknown): CookingMemberProfile | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.familyMemberProfileId !== "string"
  ) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: item.id,
    householdId: typeof item.householdId === "string" ? item.householdId : "local",
    familyMemberProfileId: item.familyMemberProfileId,
    cookingLevel: isCookingLevel(item.cookingLevel) ? item.cookingLevel : "basic",
    defaultMaxCookingMinutes:
      typeof item.defaultMaxCookingMinutes === "number"
        ? item.defaultMaxCookingMinutes
        : null,
    maxComfortableStepCount:
      typeof item.maxComfortableStepCount === "number"
        ? item.maxComfortableStepCount
        : null,
    canDeepFry: item.canDeepFry === true,
    canUseOven: item.canUseOven !== false,
    canUsePressureCooker: item.canUsePressureCooker === true,
    canHandleRawFish: item.canHandleRawFish === true,
    prefersLowCleanup: item.prefersLowCleanup === true,
    preferredRecipeIds: asStringArray(item.preferredRecipeIds),
    avoidRecipeIds: asStringArray(item.avoidRecipeIds),
    masteredRecipeIds: asStringArray(item.masteredRecipeIds),
    learningRecipeIds: asStringArray(item.learningRecipeIds),
    preferredCategories: asStringArray(item.preferredCategories),
    dislikedCookingMethods: asStringArray(item.dislikedCookingMethods),
    notes: typeof item.notes === "string" ? item.notes : null,
    isActive: item.isActive !== false,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function persist(list: CookingMemberProfile[]): void {
  writeStorage(STORAGE_KEYS.cookingMemberProfiles, list);
  cached = list;
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.cookingMemberProfiles);
  listeners.forEach((l) => l());
}

export function loadCookingMemberProfiles(): CookingMemberProfile[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.cookingMemberProfiles)) {
    persist([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.cookingMemberProfiles);
  if (raw === cachedRaw && cachedRaw !== undefined) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.cookingMemberProfiles);
  const list = Array.isArray(stored)
    ? stored.map(migrate).filter((p): p is CookingMemberProfile => p !== null)
    : [];
  cached = list;
  cachedRaw = raw;
  return list;
}

export function replaceCookingMemberProfiles(
  list: CookingMemberProfile[],
): void {
  if (typeof window === "undefined") return;
  persist(list);
}

export function saveCookingMemberProfile(
  input: Omit<CookingMemberProfile, "createdAt" | "updatedAt"> & {
    createdAt?: string;
  },
): CookingMemberProfile {
  const now = new Date().toISOString();
  const list = loadCookingMemberProfiles();
  const existing = list.find((p) => p.id === input.id);
  const next: CookingMemberProfile = {
    ...input,
    createdAt: existing?.createdAt ?? input.createdAt ?? now,
    updatedAt: now,
  };
  persist([next, ...list.filter((p) => p.id !== next.id)]);
  return next;
}

export function getCookingProfileForMember(
  familyMemberProfileId: string,
): CookingMemberProfile | null {
  return (
    loadCookingMemberProfiles().find(
      (p) => p.familyMemberProfileId === familyMemberProfileId && p.isActive,
    ) ?? null
  );
}

export function ensureCookingProfile(
  householdId: string,
  familyMemberProfileId: string,
  level: CookingLevel = "basic",
): CookingMemberProfile {
  const existing = getCookingProfileForMember(familyMemberProfileId);
  if (existing) return existing;
  return saveCookingMemberProfile({
    id: crypto.randomUUID(),
    householdId,
    familyMemberProfileId,
    cookingLevel: level,
    defaultMaxCookingMinutes:
      level === "beginner" ? 25 : level === "basic" ? 35 : null,
    maxComfortableStepCount: level === "beginner" ? 5 : level === "basic" ? 8 : null,
    canDeepFry: level !== "beginner",
    canUseOven: true,
    canUsePressureCooker: level === "advanced" || level === "intermediate",
    canHandleRawFish: level === "advanced",
    prefersLowCleanup: level === "beginner",
    preferredRecipeIds: [],
    avoidRecipeIds: [],
    masteredRecipeIds: [],
    learningRecipeIds: [],
    preferredCategories: [],
    dislikedCookingMethods: level === "beginner" ? ["揚げ物"] : [],
    notes: null,
    isActive: true,
  });
}

export function subscribeCookingMemberProfiles(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
