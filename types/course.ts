/** 料理区分（レシピ・献立アイテム共通） */
export const RECIPE_COURSES = [
  "主食",
  "主菜",
  "副菜",
  "汁物",
  "デザート",
  "飲み物",
  "その他",
] as const;

export type RecipeCourse = (typeof RECIPE_COURSES)[number];

export const DEFAULT_RECIPE_COURSE: RecipeCourse = "その他";

/** 自動作成の基本構成 */
export const AUTO_FILL_COURSES: readonly RecipeCourse[] = [
  "主食",
  "主菜",
  "副菜",
  "汁物",
];

export const COURSE_ICONS: Record<RecipeCourse, string> = {
  主食: "🍚",
  主菜: "🥩",
  副菜: "🥗",
  汁物: "🥣",
  デザート: "🍰",
  飲み物: "🥤",
  その他: "📦",
};

export function isRecipeCourse(value: unknown): value is RecipeCourse {
  return (
    typeof value === "string" &&
    (RECIPE_COURSES as readonly string[]).includes(value)
  );
}

export function getCourseIcon(course: RecipeCourse): string {
  return COURSE_ICONS[course];
}

export function formatCourseLabel(course: RecipeCourse): string {
  return `${getCourseIcon(course)} ${course}`;
}
