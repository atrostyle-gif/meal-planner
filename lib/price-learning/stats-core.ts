/** 価格系列の基本統計（純粋関数） */

export function calculatePriceMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function calculateLatestPrice(
  pricedAt: Array<{ at: string; price: number }>,
): number | null {
  if (pricedAt.length === 0) return null;
  const sorted = [...pricedAt].sort((a, b) => b.at.localeCompare(a.at));
  return sorted[0]?.price ?? null;
}

export function calculateLowestPrice(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.min(...values);
}

export function calculateHighestPrice(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.max(...values);
}

export function filterWithinDays<T extends { purchasedAt: string }>(
  records: T[],
  days: number,
  now = Date.now(),
): T[] {
  const min = now - days * 24 * 60 * 60 * 1000;
  return records.filter((r) => {
    const t = new Date(r.purchasedAt).getTime();
    return !Number.isNaN(t) && t >= min;
  });
}

export function filterSameMonthPastYears<T extends { purchasedAt: string }>(
  records: T[],
  month: number,
  now = new Date(),
): T[] {
  return records.filter((r) => {
    const d = new Date(r.purchasedAt);
    if (Number.isNaN(d.getTime())) return false;
    return d.getMonth() === month && d.getFullYear() < now.getFullYear();
  });
}
