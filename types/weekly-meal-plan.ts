/**
 * 週間献立自動作成用の型。
 * 保存構造は既存 MealPlan / DayMeal / MealDishItem を再利用する。
 */
import type {
  DayMeal,
  MealDishItem,
  MealPlan,
} from "@/types/meal-plan";
import type { RecipeCourse } from "@/types/course";

/** 選定理由バッジ（UI表示用の短いラベル） */
export const SELECTION_REASON_BADGES = [
  "時短",
  "魚の日",
  "冷蔵庫消費",
  "家族のお気に入り",
  "作り置き活用",
  "食材使い切り",
  "余り食材活用",
  "まとめ買い向き",
  "予算内",
  "ロピアで購入済み",
  "購入済み食材",
  "普段より安く購入",
  "冷凍在庫を活用",
  "週間予算内",
  "旬の食材",
] as const;

export type SelectionReasonBadge = (typeof SELECTION_REASON_BADGES)[number];

/** 選定理由（詳細文＋任意バッジ） */
export type SelectionReason = {
  /** 表示用の詳細理由 */
  detail: string;
  /** バッジがある場合のみ */
  badge?: SelectionReasonBadge;
};

/** 自動編成の対象コース（主菜・副菜・汁物） */
export const WEEKLY_AUTO_COURSES = ["主菜", "副菜", "汁物"] as const;

export type WeeklyAutoCourse = (typeof WEEKLY_AUTO_COURSES)[number];

export function isWeeklyAutoCourse(value: string): value is WeeklyAutoCourse {
  return (WEEKLY_AUTO_COURSES as readonly string[]).includes(value);
}

/** 1週間の献立（既存 MealPlan の別名） */
export type WeeklyMealPlan = MealPlan;

/** 1日分（既存 DayMeal の別名） */
export type MealPlanDay = DayMeal;

/** 1枠（既存 MealDishItem の別名。slotLocked / selectionReasons を利用） */
export type MealPlanSlot = MealDishItem;

/** 自動編成のスコープ */
export type WeeklyAutoScope =
  | { type: "week" }
  | { type: "day"; date: string }
  | { type: "slot"; date: string; course: RecipeCourse; slotId?: string };

/** UI状態 */
export type WeeklyPlanUiStatus =
  | "no_recipes"
  | "generating"
  | "success"
  | "partial_empty"
  | "save_success"
  | "save_failed"
  | "idle";
