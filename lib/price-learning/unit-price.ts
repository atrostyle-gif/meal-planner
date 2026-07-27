/**
 * 単価計算（グラム換算できる場合のみ 100g単価を出す。推測補完しない）。
 */

export function calculateUnitPrice(input: {
  purchasePriceYen: number | null;
  discountYen?: number | null;
  gramsEquivalent?: number | null;
  packageQuantity?: number | null;
  unitCountEquivalent?: number | null;
}): {
  netPriceYen: number | null;
  pricePer100g: number | null;
  pricePerUnit: number | null;
} {
  if (
    input.purchasePriceYen == null ||
    !Number.isFinite(input.purchasePriceYen)
  ) {
    return { netPriceYen: null, pricePer100g: null, pricePerUnit: null };
  }
  const discount =
    input.discountYen != null && Number.isFinite(input.discountYen)
      ? input.discountYen
      : 0;
  const netPriceYen = Math.max(0, input.purchasePriceYen - discount);

  const grams = input.gramsEquivalent;
  const pricePer100g =
    grams != null && Number.isFinite(grams) && grams > 0
      ? (netPriceYen / grams) * 100
      : null;

  const units =
    input.unitCountEquivalent ??
    (input.packageQuantity != null &&
    Number.isFinite(input.packageQuantity) &&
    input.packageQuantity > 0
      ? input.packageQuantity
      : null);
  const pricePerUnit =
    units != null ? netPriceYen / units : null;

  return { netPriceYen, pricePer100g, pricePerUnit };
}

export function computeNetPriceYen(
  totalPriceYen: number | null,
  discountYen: number | null,
): number | null {
  return calculateUnitPrice({
    purchasePriceYen: totalPriceYen,
    discountYen,
  }).netPriceYen;
}
