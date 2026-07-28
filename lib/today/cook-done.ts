/**
 * 調理モード完了フラグ（ホームのレビュー表示判定用）。
 * localStorage キー: meal-planner:cook-done:{date}:{recipeId}
 */

export function cookDoneStorageKey(date: string, recipeId: string): string {
  return `meal-planner:cook-done:${date}:${recipeId}`;
}

/** 指定日・レシピの調理完了を記録する */
export function markCookDone(date: string, recipeId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cookDoneStorageKey(date, recipeId), "1");
  } catch {
    // 容量不足などは無視
  }
}

/** 指定日・レシピが調理完了済みか */
export function isCookDone(date: string, recipeId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(cookDoneStorageKey(date, recipeId)) === "1";
  } catch {
    return false;
  }
}
