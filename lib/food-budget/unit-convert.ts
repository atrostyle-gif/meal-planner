/**
 * 買い物・予算計算用の単位換算（ヒューリスティック）。
 * 不明な場合は null（推測で断定しない）。
 */

export function toGramsEquivalent(
  quantity: number | null,
  unit: string,
): number | null {
  if (quantity === null || !Number.isFinite(quantity) || quantity < 0) {
    return null;
  }
  const u = unit.trim().toLowerCase();
  if (u === "g" || u === "グラム") {
    return quantity;
  }
  if (u === "kg" || u === "キロ" || u === "キログラム") {
    return quantity * 1000;
  }
  if (u === "ml" || u === "ミリリットル") {
    // 水換算の近似。厳密ではないが体積系の比較用
    return quantity;
  }
  if (u === "l" || u === "リットル") {
    return quantity * 1000;
  }
  return null;
}

/** パック数量を必要量以上になる最小倍数で求める */
export function ceilToPackCount(
  neededGrams: number,
  packGrams: number,
): number {
  if (packGrams <= 0 || neededGrams <= 0) return 0;
  return Math.ceil(neededGrams / packGrams);
}

export function formatGramsLabel(grams: number | null, fallbackUnit = ""): string {
  if (grams === null || !Number.isFinite(grams)) {
    return fallbackUnit;
  }
  if (grams >= 1000 && grams % 1000 === 0) {
    return `${grams / 1000}kg`;
  }
  if (grams >= 1000) {
    const kg = Number((grams / 1000).toFixed(2));
    return `${kg}kg`;
  }
  return `${Math.round(grams)}g`;
}

export function formatQuantityWithUnit(
  quantity: number | null,
  unit: string,
): string {
  if (quantity === null || !Number.isFinite(quantity)) {
    return unit.trim();
  }
  const q =
    Number.isInteger(quantity) || Math.abs(quantity - Math.round(quantity)) < 0.001
      ? String(Math.round(quantity))
      : String(Number(quantity.toFixed(2)));
  return `${q}${unit.trim()}`;
}
