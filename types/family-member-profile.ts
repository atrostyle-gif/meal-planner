/**
 * 家族メンバーの献立用プロフィール（医療診断ではない参考情報）
 */

export const AGE_GROUPS = [
  "幼児",
  "小学生",
  "中高生",
  "成人",
  "高齢者",
  "未設定",
] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];

export const PROFILE_ACTIVITY_LEVELS = [
  "低い",
  "普通",
  "高い",
  "未設定",
] as const;

export type ProfileActivityLevel = (typeof PROFILE_ACTIVITY_LEVELS)[number];

export const PROFILE_SEXES = ["男性", "女性", "その他", "未設定"] as const;

export type ProfileSex = (typeof PROFILE_SEXES)[number];

/** 通常食べる量（相対） */
export const SERVING_PORTIONS = ["少なめ", "普通", "多め"] as const;

export type ServingPortion = (typeof SERVING_PORTIONS)[number];

export const MEMBER_GOALS = [
  "バランス重視",
  "減量",
  "体重維持",
  "筋力アップ",
  "高たんぱく",
  "野菜多め",
  "減塩",
  "鉄分を意識",
  "カルシウムを意識",
  "時短",
  "節約",
] as const;

export type MemberGoal = (typeof MEMBER_GOALS)[number];

/** 健康・食事のチェック項目（わかりやすいフラグ） */
export const HEALTH_CONDITION_FLAGS = [
  { id: "diabetes_care", label: "糖尿病配慮" },
  { id: "low_salt", label: "減塩" },
  { id: "low_fat", label: "低脂質" },
  { id: "high_protein", label: "高たんぱく" },
  { id: "dieting", label: "ダイエット中" },
] as const;

export type HealthConditionFlagId =
  (typeof HEALTH_CONDITION_FLAGS)[number]["id"];

export const DIETARY_RESTRICTIONS = [
  "なし",
  "ベジタリアン",
  "魚介なし",
  "肉なし",
  "乳製品なし",
  "卵なし",
  "その他",
] as const;

export type DietaryRestriction = (typeof DIETARY_RESTRICTIONS)[number];

/** よくあるアレルギー候補（自由入力も可） */
export const COMMON_ALLERGENS = [
  "卵",
  "乳",
  "小麦",
  "そば",
  "落花生",
  "えび",
  "かに",
  "くるみ",
  "大豆",
] as const;

/** 食事の好み（AI学習・おすすめ用） */
export const FOOD_PREFERENCE_TAGS = [
  "和食",
  "洋食",
  "中華",
  "韓国料理",
  "麺類",
  "魚料理",
  "肉料理",
  "野菜多め",
] as const;

export type FoodPreferenceTag = (typeof FOOD_PREFERENCE_TAGS)[number];

/** 料理担当曜日（月曜始まり） */
export const COOKING_DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type CookingDayKey = (typeof COOKING_DAY_KEYS)[number];

export const COOKING_DAY_LABELS: Record<CookingDayKey, string> = {
  monday: "月",
  tuesday: "火",
  wednesday: "水",
  thursday: "木",
  friday: "金",
  saturday: "土",
  sunday: "日",
};

export type FamilyMemberProfile = {
  id: string;
  householdId: string;
  userId?: string | null;
  displayName: string;
  /** 年齢（任意）。birthYear からも推定可 */
  age?: number | null;
  birthYear?: number | null;
  ageGroup: AgeGroup;
  sex?: ProfileSex | null;
  activityLevel: ProfileActivityLevel;
  /** 通常食べる量 */
  servingPortion: ServingPortion;
  /** 利用者が明示設定した目標（自動断定しない） */
  calorieTarget?: number | null;
  proteinTarget?: number | null;
  fatTarget?: number | null;
  carbTarget?: number | null;
  saltLimit?: number | null;
  /** true のとき栄養目標は標準計算を使う */
  useStandardNutrition: boolean;
  goals: MemberGoal[];
  /** 健康状態チェック */
  healthFlags: HealthConditionFlagId[];
  allergies: string[];
  dislikedIngredients: string[];
  likedIngredients: string[];
  dietaryRestrictions: DietaryRestriction[];
  /** 食事の好み */
  foodPreferences: FoodPreferenceTag[];
  /** 料理担当曜日 */
  cookingDays: CookingDayKey[];
  /** AIメモ（献立作成の参考） */
  notes?: string | null;
  /** 健康・食事のその他自由入力 */
  healthNotes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FamilyMemberProfileInput = Omit<
  FamilyMemberProfile,
  "id" | "createdAt" | "updatedAt"
> & { id?: string };

export function isAgeGroup(value: unknown): value is AgeGroup {
  return typeof value === "string" && (AGE_GROUPS as readonly string[]).includes(value);
}

export function isProfileActivityLevel(
  value: unknown,
): value is ProfileActivityLevel {
  return (
    typeof value === "string" &&
    (PROFILE_ACTIVITY_LEVELS as readonly string[]).includes(value)
  );
}

export function isMemberGoal(value: unknown): value is MemberGoal {
  return typeof value === "string" && (MEMBER_GOALS as readonly string[]).includes(value);
}

export function isDietaryRestriction(
  value: unknown,
): value is DietaryRestriction {
  return (
    typeof value === "string" &&
    (DIETARY_RESTRICTIONS as readonly string[]).includes(value)
  );
}

export function isServingPortion(value: unknown): value is ServingPortion {
  return (
    typeof value === "string" &&
    (SERVING_PORTIONS as readonly string[]).includes(value)
  );
}

export function isHealthConditionFlagId(
  value: unknown,
): value is HealthConditionFlagId {
  return (
    typeof value === "string" &&
    HEALTH_CONDITION_FLAGS.some((flag) => flag.id === value)
  );
}

export function isFoodPreferenceTag(value: unknown): value is FoodPreferenceTag {
  return (
    typeof value === "string" &&
    (FOOD_PREFERENCE_TAGS as readonly string[]).includes(value)
  );
}

export function isCookingDayKey(value: unknown): value is CookingDayKey {
  return (
    typeof value === "string" &&
    (COOKING_DAY_KEYS as readonly string[]).includes(value)
  );
}
