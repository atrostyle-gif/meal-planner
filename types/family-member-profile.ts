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

export type FamilyMemberProfile = {
  id: string;
  householdId: string;
  userId?: string | null;
  displayName: string;
  birthYear?: number | null;
  ageGroup: AgeGroup;
  sex?: ProfileSex | null;
  activityLevel: ProfileActivityLevel;
  /** 利用者が明示設定した目標（自動断定しない） */
  calorieTarget?: number | null;
  proteinTarget?: number | null;
  saltLimit?: number | null;
  goals: MemberGoal[];
  allergies: string[];
  dislikedIngredients: string[];
  dietaryRestrictions: DietaryRestriction[];
  notes?: string | null;
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
