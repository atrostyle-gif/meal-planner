/**
 * 週間生活スケジュール・調理担当・適性（献立エンジン v4）
 */

export const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  monday: "月曜日",
  tuesday: "火曜日",
  wednesday: "水曜日",
  thursday: "木曜日",
  friday: "金曜日",
  saturday: "土曜日",
  sunday: "日曜日",
};

export const EFFORT_LEVELS = [
  "very_easy",
  "easy",
  "normal",
  "elaborate",
  "unrestricted",
] as const;

export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export const EFFORT_LEVEL_LABELS: Record<EffortLevel, string> = {
  very_easy: "とても簡単",
  easy: "簡単",
  normal: "普通",
  elaborate: "手の込んだ",
  unrestricted: "制限なし",
};

export const COOKING_LEVELS = [
  "beginner",
  "basic",
  "intermediate",
  "advanced",
] as const;

export type CookingLevel = (typeof COOKING_LEVELS)[number];

export const COOKING_LEVEL_LABELS: Record<CookingLevel, string> = {
  beginner: "初心者",
  basic: "基本",
  intermediate: "中級",
  advanced: "上級",
};

export const RECIPE_DIFFICULTIES = [
  "very_easy",
  "easy",
  "normal",
  "hard",
] as const;

export type RecipeDifficultyLevel = (typeof RECIPE_DIFFICULTIES)[number];

export const CLEANUP_LEVELS = ["low", "medium", "high"] as const;

export type CleanupLevel = (typeof CLEANUP_LEVELS)[number];

export const SUITABILITY_LEVELS = [
  "unsuitable",
  "difficult",
  "possible",
  "comfortable",
  "expert",
] as const;

export type SuitabilityLevel = (typeof SUITABILITY_LEVELS)[number];

export const SUITABILITY_LABELS: Record<SuitabilityLevel, string> = {
  unsuitable: "向かない",
  difficult: "難しい",
  possible: "可能",
  comfortable: "作りやすい",
  expert: "得意",
};

/** 曜日ごとの基本生活・調理スケジュール */
export type WeeklyCookingSchedule = {
  id: string;
  householdId: string;
  dayOfWeek: DayOfWeek;
  defaultCookMemberId: string | null;
  backupCookMemberIds: string[];
  cookingTimeLimitMinutes: number | null;
  effortLevel: EffortLevel;
  shoppingAvailable: boolean;
  isShoppingDay: boolean;
  allowNewRecipes: boolean;
  preferFamiliarRecipes: boolean;
  allowBatchCooking: boolean;
  preferLowCleanup: boolean;
  maxStepCount: number | null;
  avoidDeepFrying: boolean;
  preferMakeAhead: boolean;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** 家族メンバーの調理能力プロフィール */
export type CookingMemberProfile = {
  id: string;
  householdId: string;
  familyMemberProfileId: string;
  cookingLevel: CookingLevel;
  defaultMaxCookingMinutes: number | null;
  maxComfortableStepCount: number | null;
  canDeepFry: boolean;
  canUseOven: boolean;
  canUsePressureCooker: boolean;
  canHandleRawFish: boolean;
  prefersLowCleanup: boolean;
  preferredRecipeIds: string[];
  avoidRecipeIds: string[];
  masteredRecipeIds: string[];
  learningRecipeIds: string[];
  preferredCategories: string[];
  dislikedCookingMethods: string[];
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MemberSuitabilityEntry = {
  memberId: string;
  suitability: SuitabilityLevel;
  reason?: string | null;
  isMastered?: boolean;
  lastCookedAt?: string | null;
  cookCount?: number;
  source?: "manual" | "estimated" | "history";
};

/** レシピの調理適性メタ */
export type RecipeCookingProfile = {
  difficulty: RecipeDifficultyLevel | null;
  effortLevel: EffortLevel | null;
  activeCookingMinutes: number | null;
  totalCookingMinutes: number | null;
  stepCount: number | null;
  cleanupLevel: CleanupLevel | null;
  requiresDeepFrying: boolean | null;
  requiresOven: boolean | null;
  requiresPressureCooker: boolean | null;
  requiresRawFishHandling: boolean | null;
  canBatchCook: boolean | null;
  makeAheadSuitable: boolean | null;
  beginnerFriendly: boolean | null;
  assignedCookMemberIds: string[];
  preferredCookMemberIds: string[];
  avoidCookMemberIds: string[];
  memberSuitability: MemberSuitabilityEntry[];
  source: "manual" | "estimated" | "mixed";
};

/** 特定日の上書き */
export type DailyCookingOverride = {
  id: string;
  householdId: string;
  date: string;
  cookMemberId: string | null;
  isEatingOut: boolean;
  skipMealPlanning: boolean;
  cookingTimeLimitMinutes: number | null;
  effortLevel: EffortLevel | null;
  shoppingAvailable: boolean | null;
  allowNewRecipes: boolean | null;
  participantMemberIds: string[];
  notes: string | null;
  updatedAt: string;
};

/** 調理実績 */
export type CookingHistory = {
  id: string;
  householdId: string;
  recipeId: string;
  cookedByMemberId: string | null;
  cookedAt: string;
  difficultyFeedback: SuitabilityLevel | null;
  durationMinutes: number | null;
  successRating: number | null;
  notes: string | null;
  /** 提供人数（学習用） */
  servings?: number | null;
  /** 実際の調理時間（分）。durationMinutes と同義で保持可 */
  cookingTimeActual?: number | null;
  /** 記録者（cookedByMemberId の別名） */
  createdBy?: string | null;
  /** メモ（notes の別名） */
  memo?: string | null;
  /** また作りたい */
  wantAgain?: boolean | null;
  /** ワンタップ改善タグ ID */
  improvementTags?: string[];
};

export const LIFESTYLE_AUTO_FILL_MODES = [
  "生活優先",
  "担当者優先",
  "作り慣れた料理優先",
  "新しい料理に挑戦",
  "買い足し最小",
  "週末に手の込んだ料理",
  "娘でも作りやすい",
] as const;

export type LifestyleAutoFillMode = (typeof LIFESTYLE_AUTO_FILL_MODES)[number];

export function isDayOfWeek(value: unknown): value is DayOfWeek {
  return typeof value === "string" && (DAYS_OF_WEEK as readonly string[]).includes(value);
}

export function isEffortLevel(value: unknown): value is EffortLevel {
  return typeof value === "string" && (EFFORT_LEVELS as readonly string[]).includes(value);
}

export function isCookingLevel(value: unknown): value is CookingLevel {
  return typeof value === "string" && (COOKING_LEVELS as readonly string[]).includes(value);
}

/** Date / YYYY-MM-DD → DayOfWeek（月曜始まり） */
export function dateToDayOfWeek(dateText: string): DayOfWeek {
  const [y, m, d] = dateText.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  const map: DayOfWeek[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return map[day] ?? "monday";
}
