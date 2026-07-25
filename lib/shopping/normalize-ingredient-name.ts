/**
 * 食材名の正規化。
 * - 前後空白除去
 * - 全角・半角空白を統一して除去相当に圧縮
 * - 英字は小文字化
 */
export function normalizeIngredientName(name: string): string {
  return name
    .trim()
    .replace(/[\u3000\s]+/g, " ")
    .toLowerCase();
}
