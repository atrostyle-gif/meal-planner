/**
 * 家庭学習プロファイルの保存・再計算・リセット。
 */
import { computeFamilyLearningProfile } from "@/lib/family-learning/compute";
import { clearMealChangeEvents } from "@/lib/family-learning/meal-change-events";
import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  EMPTY_FAMILY_LEARNING_PROFILE,
  type FamilyLearningProfile,
} from "@/types/family-learning";

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cached: FamilyLearningProfile | null = null;

function notify(): void {
  listeners.forEach((l) => l());
}

function persist(profile: FamilyLearningProfile): void {
  writeStorage(STORAGE_KEYS.familyLearningProfile, profile);
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.familyLearningProfile);
  cached = profile;
  notify();
}

function isProfile(value: unknown): value is FamilyLearningProfile {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.householdId === "string" &&
    typeof item.updatedAt === "string" &&
    typeof item.sampleCount === "number" &&
    Array.isArray(item.insights)
  );
}

/**
 * キャッシュ済みプロファイルを返す。無ければ再計算して保存。
 */
export function loadFamilyLearningProfile(
  householdId = "local",
): FamilyLearningProfile {
  if (typeof window === "undefined") {
    return EMPTY_FAMILY_LEARNING_PROFILE(householdId);
  }
  if (!hasStorageKey(STORAGE_KEYS.familyLearningProfile)) {
    return refreshFamilyLearningProfile(householdId);
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.familyLearningProfile);
  if (raw === cachedRaw && cached && cached.householdId === householdId) {
    return cached;
  }
  const stored = readStorage<unknown>(STORAGE_KEYS.familyLearningProfile);
  if (isProfile(stored) && stored.householdId === householdId) {
    cachedRaw = raw;
    cached = stored;
    return stored;
  }
  return refreshFamilyLearningProfile(householdId);
}

/** フィードバック等の後に呼ぶ再計算 */
export function refreshFamilyLearningProfile(
  householdId = "local",
): FamilyLearningProfile {
  if (typeof window === "undefined") {
    return EMPTY_FAMILY_LEARNING_PROFILE(householdId);
  }
  const profile = computeFamilyLearningProfile(householdId);
  persist(profile);
  return profile;
}

/**
 * AI学習だけリセット（レビュー・履歴・プロフィール本体は消さない）。
 * 変更履歴も学習用のためクリアし、空プロファイルを保存する。
 */
export function resetFamilyLearningOnly(householdId = "local"): void {
  if (typeof window === "undefined") return;
  clearMealChangeEvents();
  persist(EMPTY_FAMILY_LEARNING_PROFILE(householdId));
}

export function subscribeFamilyLearningProfile(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEYS.familyLearningProfile || event.key === null) {
      cachedRaw = undefined;
      listener();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function getFamilyLearningProfileSnapshot(): FamilyLearningProfile {
  return loadFamilyLearningProfile();
}

export function getFamilyLearningProfileServerSnapshot(): FamilyLearningProfile {
  return EMPTY_FAMILY_LEARNING_PROFILE("local");
}
