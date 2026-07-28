/**
 * 家族プロフィールの栄養目標・拡張フィールドの移行・学習ヒント。
 */
import type {
  FamilyMemberProfile,
  HealthConditionFlagId,
  MemberGoal,
  ProfileActivityLevel,
  ProfileSex,
  ServingPortion,
} from "@/types/family-member-profile";
import {
  isCookingDayKey,
  isFoodPreferenceTag,
  isHealthConditionFlagId,
  isServingPortion,
} from "@/types/family-member-profile";

const EXT_PREFIX = "<!--mp-profile-ext:";
const EXT_SUFFIX = "-->";

export type ProfileExtraPayload = {
  age?: number | null;
  servingPortion?: ServingPortion;
  fatTarget?: number | null;
  carbTarget?: number | null;
  useStandardNutrition?: boolean;
  healthFlags?: HealthConditionFlagId[];
  likedIngredients?: string[];
  foodPreferences?: string[];
  cookingDays?: string[];
  healthNotes?: string | null;
};

/** notes から表示用テキストと拡張ペイロードを分離 */
export function unpackProfileNotes(raw: string | null | undefined): {
  notes: string | null;
  extra: ProfileExtraPayload;
} {
  if (!raw) return { notes: null, extra: {} };
  const start = raw.lastIndexOf(EXT_PREFIX);
  if (start < 0) return { notes: raw, extra: {} };
  const jsonStart = start + EXT_PREFIX.length;
  const end = raw.indexOf(EXT_SUFFIX, jsonStart);
  if (end < 0) return { notes: raw, extra: {} };
  const display = raw.slice(0, start).trimEnd();
  try {
    const parsed = JSON.parse(raw.slice(jsonStart, end)) as ProfileExtraPayload;
    return {
      notes: display === "" ? null : display,
      extra: parsed && typeof parsed === "object" ? parsed : {},
    };
  } catch {
    return { notes: raw, extra: {} };
  }
}

/** 表示用 notes と拡張フィールドをクラウド互換の文字列にまとめる */
export function packProfileNotes(
  notes: string | null | undefined,
  extra: ProfileExtraPayload,
): string | null {
  const base = (notes ?? "").trim();
  const payload: ProfileExtraPayload = {
    age: extra.age ?? null,
    servingPortion: extra.servingPortion ?? "普通",
    fatTarget: extra.fatTarget ?? null,
    carbTarget: extra.carbTarget ?? null,
    useStandardNutrition: extra.useStandardNutrition !== false,
    healthFlags: extra.healthFlags ?? [],
    likedIngredients: extra.likedIngredients ?? [],
    foodPreferences: extra.foodPreferences ?? [],
    cookingDays: extra.cookingDays ?? [],
    healthNotes: extra.healthNotes ?? null,
  };
  const packed = `${base}${base ? "\n" : ""}${EXT_PREFIX}${JSON.stringify(payload)}${EXT_SUFFIX}`;
  return packed;
}

/** 旧 goals から健康フラグを推定 */
export function migrateHealthFlagsFromGoals(
  goals: MemberGoal[],
  existing: HealthConditionFlagId[] = [],
): HealthConditionFlagId[] {
  const set = new Set<HealthConditionFlagId>(existing);
  for (const goal of goals) {
    if (goal === "減塩") set.add("low_salt");
    if (goal === "高たんぱく") set.add("high_protein");
    if (goal === "減量") set.add("dieting");
  }
  return [...set];
}

function activityFactor(level: ProfileActivityLevel): number {
  if (level === "高い") return 1.55;
  if (level === "低い") return 1.2;
  return 1.375;
}

/**
 * 標準栄養目標の簡易推定（医療目的ではない参考値）。
 */
export function estimateStandardNutrition(input: {
  age: number | null;
  sex: ProfileSex | null | undefined;
  activityLevel: ProfileActivityLevel;
  servingPortion: ServingPortion;
}): {
  calorieTarget: number;
  proteinTarget: number;
  fatTarget: number;
  carbTarget: number;
} {
  const age = input.age != null && input.age > 0 ? input.age : 35;
  const sex = input.sex ?? "未設定";
  // 簡易 BMR（体重は標準体型を仮定）
  const weightKg = sex === "女性" ? 55 : sex === "男性" ? 65 : 60;
  const heightCm = sex === "女性" ? 158 : sex === "男性" ? 170 : 164;
  const bmr =
    sex === "女性"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
      : 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  let calories = Math.round(bmr * activityFactor(input.activityLevel));
  if (input.servingPortion === "少なめ") calories = Math.round(calories * 0.9);
  if (input.servingPortion === "多め") calories = Math.round(calories * 1.1);
  calories = Math.min(3200, Math.max(1200, calories));
  const protein = Math.round((calories * 0.18) / 4);
  const fat = Math.round((calories * 0.25) / 9);
  const carb = Math.round((calories * 0.57) / 4);
  return {
    calorieTarget: calories,
    proteinTarget: protein,
    fatTarget: fat,
    carbTarget: carb,
  };
}

export function resolveAge(
  age: number | null | undefined,
  birthYear: number | null | undefined,
): number | null {
  if (typeof age === "number" && Number.isFinite(age) && age > 0) {
    return Math.round(age);
  }
  if (typeof birthYear === "number" && birthYear > 1900) {
    const year = new Date().getFullYear();
    const estimated = year - birthYear;
    return estimated > 0 && estimated < 120 ? estimated : null;
  }
  return null;
}

export function parseExtraFromUnknown(extra: ProfileExtraPayload): {
  age: number | null;
  servingPortion: ServingPortion;
  fatTarget: number | null;
  carbTarget: number | null;
  /** 未指定時は undefined（移行側で旧目標値の有無を見て決める） */
  useStandardNutrition: boolean | undefined;
  healthFlags: HealthConditionFlagId[];
  likedIngredients: string[];
  foodPreferences: import("@/types/family-member-profile").FoodPreferenceTag[];
  cookingDays: import("@/types/family-member-profile").CookingDayKey[];
  healthNotes: string | null;
} {
  return {
    age:
      typeof extra.age === "number" && Number.isFinite(extra.age)
        ? extra.age
        : null,
    servingPortion: isServingPortion(extra.servingPortion)
      ? extra.servingPortion
      : "普通",
    fatTarget:
      typeof extra.fatTarget === "number" ? extra.fatTarget : null,
    carbTarget:
      typeof extra.carbTarget === "number" ? extra.carbTarget : null,
    useStandardNutrition:
      typeof extra.useStandardNutrition === "boolean"
        ? extra.useStandardNutrition
        : undefined,
    healthFlags: Array.isArray(extra.healthFlags)
      ? extra.healthFlags.filter(isHealthConditionFlagId)
      : [],
    likedIngredients: Array.isArray(extra.likedIngredients)
      ? extra.likedIngredients.filter((x): x is string => typeof x === "string")
      : [],
    foodPreferences: Array.isArray(extra.foodPreferences)
      ? extra.foodPreferences.filter(isFoodPreferenceTag)
      : [],
    cookingDays: Array.isArray(extra.cookingDays)
      ? extra.cookingDays.filter(isCookingDayKey)
      : [],
    healthNotes:
      typeof extra.healthNotes === "string" ? extra.healthNotes : null,
  };
}

/** 献立エンジン・おすすめ用に家族情報を集約 */
export function collectFamilyLearningHints(
  profiles: FamilyMemberProfile[],
): {
  allergies: string[];
  dislikedIngredients: string[];
  likedIngredients: string[];
  foodPreferences: string[];
  healthFlags: HealthConditionFlagId[];
  aiNotes: string[];
  dietaryRestrictions: string[];
} {
  const allergies = new Set<string>();
  const disliked = new Set<string>();
  const liked = new Set<string>();
  const prefs = new Set<string>();
  const flags = new Set<HealthConditionFlagId>();
  const notes: string[] = [];
  const dietary = new Set<string>();

  for (const profile of profiles.filter((p) => p.isActive)) {
    profile.allergies.forEach((a) => allergies.add(a));
    profile.dislikedIngredients.forEach((d) => disliked.add(d));
    profile.likedIngredients.forEach((l) => liked.add(l));
    profile.foodPreferences.forEach((p) => prefs.add(p));
    profile.healthFlags.forEach((f) => flags.add(f));
    profile.dietaryRestrictions.forEach((d) => {
      if (d !== "なし") dietary.add(d);
    });
    if (profile.notes?.trim()) {
      notes.push(`${profile.displayName}: ${profile.notes.trim()}`);
    }
    if (profile.healthNotes?.trim()) {
      notes.push(`${profile.displayName}（健康）: ${profile.healthNotes.trim()}`);
    }
  }

  return {
    allergies: [...allergies],
    dislikedIngredients: [...disliked],
    likedIngredients: [...liked],
    foodPreferences: [...prefs],
    healthFlags: [...flags],
    aiNotes: notes,
    dietaryRestrictions: [...dietary],
  };
}
