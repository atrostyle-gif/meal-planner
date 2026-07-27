import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  isRecipeAdjustmentType,
  type CookingFeedback,
  type FamilyMemberRating,
  type RecipeAdjustment,
  type SeasoningAdjustment,
  type TasteSaltLevel,
  type TasteSweetLevel,
  type TasteSpicyLevel,
  type TextureLevel,
  type TimeFeelingLevel,
} from "@/types/recipe-learning";

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cached: CookingFeedback[] = [];

function isTasteSalt(value: unknown): value is TasteSaltLevel {
  return value === "thin" || value === "just" || value === "thick";
}
function isTasteSweet(value: unknown): value is TasteSweetLevel {
  return value === "sweet" || value === "just" || value === "not_sweet";
}
function isTasteSpicy(value: unknown): value is TasteSpicyLevel {
  return value === "spicy" || value === "just" || value === "not_spicy";
}
function isTexture(value: unknown): value is TextureLevel {
  return value === "soft" || value === "just" || value === "hard";
}
function isTimeFeeling(value: unknown): value is TimeFeelingLevel {
  return value === "long" || value === "just" || value === "short";
}

function migrateMemberRating(value: unknown): FamilyMemberRating | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.memberId !== "string") return null;
  const rating =
    typeof item.rating === "number" && item.rating >= 1 && item.rating <= 5
      ? Math.round(item.rating)
      : null;
  if (rating == null) return null;
  return {
    memberId: item.memberId,
    memberName: typeof item.memberName === "string" ? item.memberName : undefined,
    rating,
    memo: typeof item.memo === "string" ? item.memo : null,
  };
}

function migrateAdjustment(value: unknown): RecipeAdjustment | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.ingredientName !== "string") return null;
  if (!isRecipeAdjustmentType(item.adjustmentType)) return null;
  return {
    ingredientName: item.ingredientName,
    adjustmentType: item.adjustmentType,
    beforeValue: typeof item.beforeValue === "string" ? item.beforeValue : null,
    afterValue: typeof item.afterValue === "string" ? item.afterValue : null,
    memo: typeof item.memo === "string" ? item.memo : null,
  };
}

function migrateSeasoning(value: unknown): SeasoningAdjustment | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.seasoning !== "string") return null;
  return {
    seasoning: item.seasoning,
    beforeAmount:
      typeof item.beforeAmount === "string" ? item.beforeAmount : null,
    afterAmount: typeof item.afterAmount === "string" ? item.afterAmount : null,
    reason: typeof item.reason === "string" ? item.reason : null,
  };
}

function migrate(value: unknown): CookingFeedback | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.historyId !== "string" ||
    typeof item.recipeId !== "string"
  ) {
    return null;
  }
  const overall =
    typeof item.overallRating === "number" &&
    item.overallRating >= 1 &&
    item.overallRating <= 5
      ? Math.round(item.overallRating)
      : null;
  const now = new Date().toISOString();
  const createdAt =
    typeof item.createdAt === "string" ? item.createdAt : now;
  const memo =
    typeof item.memo === "string"
      ? item.memo.slice(0, 500)
      : typeof item.notes === "string"
        ? item.notes.slice(0, 500)
        : null;
  const wantAgain =
    typeof item.wantAgain === "boolean"
      ? item.wantAgain
      : typeof item.wouldCookAgain === "boolean"
        ? item.wouldCookAgain
        : null;

  return {
    id: item.id,
    historyId: item.historyId,
    recipeId: item.recipeId,
    householdId:
      typeof item.householdId === "string" ? item.householdId : "local",
    cookedAt:
      typeof item.cookedAt === "string" ? item.cookedAt : createdAt,
    createdBy:
      typeof item.createdBy === "string" ? item.createdBy : null,
    overallRating: overall,
    tasteSalt: isTasteSalt(item.tasteSalt) ? item.tasteSalt : null,
    tasteSweet: isTasteSweet(item.tasteSweet) ? item.tasteSweet : null,
    tasteSpicy: isTasteSpicy(item.tasteSpicy) ? item.tasteSpicy : null,
    texture: isTexture(item.texture) ? item.texture : null,
    timeFeeling: isTimeFeeling(item.timeFeeling) ? item.timeFeeling : null,
    wantAgain,
    cookingTimeActualMinutes:
      typeof item.cookingTimeActualMinutes === "number"
        ? item.cookingTimeActualMinutes
        : typeof item.cookingTimeActual === "number"
          ? item.cookingTimeActual
          : null,
    servingsActual:
      typeof item.servingsActual === "number"
        ? item.servingsActual
        : typeof item.servings === "number"
          ? item.servings
          : null,
    improvementTags: Array.isArray(item.improvementTags)
      ? item.improvementTags.filter((t): t is string => typeof t === "string")
      : [],
    memberRatings: Array.isArray(item.memberRatings)
      ? item.memberRatings
          .map(migrateMemberRating)
          .filter((r): r is FamilyMemberRating => r !== null)
      : Array.isArray(item.familyRatings)
        ? item.familyRatings
            .map(migrateMemberRating)
            .filter((r): r is FamilyMemberRating => r !== null)
        : [],
    adjustments: Array.isArray(item.adjustments)
      ? item.adjustments
          .map(migrateAdjustment)
          .filter((r): r is RecipeAdjustment => r !== null)
      : [],
    seasoningAdjustments: Array.isArray(item.seasoningAdjustments)
      ? item.seasoningAdjustments
          .map(migrateSeasoning)
          .filter((r): r is SeasoningAdjustment => r !== null)
      : [],
    photoDataUrl:
      typeof item.photoDataUrl === "string" ? item.photoDataUrl : null,
    memo,
    createdAt,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

function persist(list: CookingFeedback[]): void {
  writeStorage(STORAGE_KEYS.cookingFeedbacks, list);
  cached = list;
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.cookingFeedbacks);
  listeners.forEach((l) => l());
}

export function loadCookingFeedbacks(): CookingFeedback[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.cookingFeedbacks)) {
    persist([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.cookingFeedbacks);
  if (raw === cachedRaw && cachedRaw !== undefined) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.cookingFeedbacks);
  const list = Array.isArray(stored)
    ? stored.map(migrate).filter((f): f is CookingFeedback => f !== null)
    : [];
  cached = list;
  cachedRaw = raw;
  return list;
}

export function replaceCookingFeedbacks(list: CookingFeedback[]): void {
  if (typeof window === "undefined") return;
  persist(list);
}

export function saveCookingFeedback(
  feedback: CookingFeedback,
): CookingFeedback {
  const list = loadCookingFeedbacks();
  const index = list.findIndex((item) => item.id === feedback.id);
  const next = [...list];
  if (index >= 0) next[index] = feedback;
  else next.unshift(feedback);
  persist(next);
  return feedback;
}

export function getFeedbacksForRecipe(recipeId: string): CookingFeedback[] {
  return loadCookingFeedbacks()
    .filter((item) => item.recipeId === recipeId)
    .sort((a, b) => b.cookedAt.localeCompare(a.cookedAt));
}

export function subscribeCookingFeedbacks(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
