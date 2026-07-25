/**
 * 栄養計算のカバー率（0〜100）。
 * 計算できた材料数 / 全材料数。
 */
export function computeNutritionCoverage(
  matchedCount: number,
  totalCount: number,
): number {
  if (totalCount <= 0) return 0;
  return Math.round((matchedCount / totalCount) * 100);
}

export function coverageLabel(coverage: number): string {
  if (coverage >= 90) return "ほぼ完全";
  if (coverage >= 60) return "一部計算";
  if (coverage > 0) return "不足多め";
  return "計算不可";
}
