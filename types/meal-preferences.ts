/**
 * 家庭の好み・体調モード（献立エンジン v2）
 */

export const ACTIVITY_LEVELS = [
  "低い",
  "ふつう",
  "高い",
] as const;

export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const MEMBER_GENDERS = ["男性", "女性", "その他", "未設定"] as const;

export type MemberGender = (typeof MEMBER_GENDERS)[number];

export const HEALTH_GOALS = [
  "通常",
  "ダイエット",
  "筋力アップ",
  "減塩",
  "野菜多め",
  "時短",
  "節約",
] as const;

export type HealthGoal = (typeof HEALTH_GOALS)[number];

export const COOKING_TIME_LIMITS = [15, 30, 45, 60] as const;

export type CookingTimeLimit = (typeof COOKING_TIME_LIMITS)[number];

export const CONDITION_MODES = [
  "通常",
  "疲れている",
  "風邪気味",
  "胃腸が弱い",
  "暑い日",
  "寒い日",
  "スタミナを付けたい",
] as const;

export type ConditionMode = (typeof CONDITION_MODES)[number];

/** 家族メンバー1人分の属性 */
export type HouseholdMemberProfile = {
  id: string;
  /** 表示用（任意） */
  label: string;
  age: number | null;
  gender: MemberGender;
  activityLevel: ActivityLevel;
};

/** 家庭の献立設定 */
export type HouseholdPreferences = {
  /**
   * 通常の食事人数（来客・不在がない日の既定）。
   * 献立の日別人数が default のときに使う。
   */
  defaultMealServings: number;
  /**
   * @deprecated defaultMealServings と同値で保持（既存エンジン互換）
   */
  servingCount: number;
  members: HouseholdMemberProfile[];
  healthGoal: HealthGoal;
  cookingTimeLimit: CookingTimeLimit;
  /** 今日の体調（自動生成時に参照） */
  conditionMode: ConditionMode;
  updatedAt: string;
};

export const DEFAULT_HOUSEHOLD_PREFERENCES: Omit<
  HouseholdPreferences,
  "updatedAt"
> = {
  defaultMealServings: 4,
  servingCount: 4,
  members: [],
  healthGoal: "通常",
  cookingTimeLimit: 45,
  conditionMode: "通常",
};

export function isHealthGoal(value: unknown): value is HealthGoal {
  return (
    typeof value === "string" &&
    (HEALTH_GOALS as readonly string[]).includes(value)
  );
}

export function isConditionMode(value: unknown): value is ConditionMode {
  return (
    typeof value === "string" &&
    (CONDITION_MODES as readonly string[]).includes(value)
  );
}

export function isCookingTimeLimit(value: unknown): value is CookingTimeLimit {
  return (
    typeof value === "number" &&
    (COOKING_TIME_LIMITS as readonly number[]).includes(value)
  );
}

export function isActivityLevel(value: unknown): value is ActivityLevel {
  return (
    typeof value === "string" &&
    (ACTIVITY_LEVELS as readonly string[]).includes(value)
  );
}

export function isMemberGender(value: unknown): value is MemberGender {
  return (
    typeof value === "string" &&
    (MEMBER_GENDERS as readonly string[]).includes(value)
  );
}
