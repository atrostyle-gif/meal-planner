/**
 * 日ごとの体調・状況（構造化）
 */
import { LIFESTYLE_AUTO_FILL_MODES } from "@/types/weekly-lifestyle";

export const DAILY_CONDITION_OPTIONS = [
  "通常",
  "疲れている",
  "胃腸にやさしく",
  "食欲がない",
  "風邪気味",
  "暑さで食欲低下",
  "寒い",
  "運動した日",
  "部活動・体育の日",
  "忙しい",
  "帰宅が遅い",
] as const;

export type DailyConditionOption = (typeof DAILY_CONDITION_OPTIONS)[number];

export type DailyCondition = {
  date: string;
  selectedConditions: DailyConditionOption[];
  notes?: string | null;
  updatedAt: string;
};

export function isDailyConditionOption(
  value: unknown,
): value is DailyConditionOption {
  return (
    typeof value === "string" &&
    (DAILY_CONDITION_OPTIONS as readonly string[]).includes(value)
  );
}

/** 自動生成モード */
const BASE_AUTO_FILL_MODES = [
  "バランス重視",
  "時短重視",
  "冷蔵庫優先",
  "節約重視",
  "高たんぱく",
  "野菜多め",
  "減塩",
  "家族の好み重視",
] as const;

/** 通常・生活スタイルを含む自動生成モード */
export const AUTO_FILL_MODES = [
  ...BASE_AUTO_FILL_MODES,
  ...LIFESTYLE_AUTO_FILL_MODES,
] as const;

export type AutoFillMode = (typeof AUTO_FILL_MODES)[number];

export function isAutoFillMode(value: unknown): value is AutoFillMode {
  return (
    typeof value === "string" &&
    (AUTO_FILL_MODES as readonly string[]).includes(value)
  );
}
