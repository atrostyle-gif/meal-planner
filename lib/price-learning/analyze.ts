import {
  assessPriceVsMedian,
  calculatePriceIndex,
  calculatePriceTrend,
  classifyDataQuality,
} from "@/lib/price-learning/assessment";
import {
  calculateHighestPrice,
  calculateLatestPrice,
  calculateLowestPrice,
  calculatePriceMedian,
  filterSameMonthPastYears,
  filterWithinDays,
} from "@/lib/price-learning/stats-core";
import { PRICE_SAMPLE_THRESHOLDS } from "@/lib/price-learning/thresholds";
import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import type {
  IngredientPriceAnalysis,
  IngredientPriceRecord,
  PricePeriodStats,
  StorePriceAnalysis,
  StorePriceSlice,
} from "@/types/ingredient-price";

function per100Values(records: IngredientPriceRecord[]): number[] {
  return records
    .map((r) => r.pricePer100g)
    .filter((v): v is number => v !== null && Number.isFinite(v));
}

function periodStats(
  records: IngredientPriceRecord[],
  days: number | null,
  now: number,
): PricePeriodStats {
  const pool =
    days == null ? records : filterWithinDays(records, days, now);
  const values = per100Values(pool);
  return {
    median: calculatePriceMedian(values),
    lowest: calculateLowestPrice(values),
    highest: calculateHighestPrice(values),
    sampleCount: values.length,
  };
}

function storeSlice(
  storeName: string,
  storeId: string | null,
  records: IngredientPriceRecord[],
  now: number,
): StorePriceSlice {
  const priced = records
    .filter((r) => r.pricePer100g != null)
    .map((r) => ({ at: r.purchasedAt, price: r.pricePer100g as number }));
  const latest = calculateLatestPrice(priced);
  const m30 = periodStats(records, 30, now).median;
  const m90 = periodStats(records, 90, now).median;
  const sampleCount = records.length;
  const assessment = assessPriceVsMedian(latest, m90, sampleCount);
  return {
    storeId,
    storeName,
    latestPricePer100g: latest,
    medianPrice30Days: m30,
    medianPrice90Days: m90,
    sampleCount,
    sparseData: sampleCount < PRICE_SAMPLE_THRESHOLDS.sufficientMin,
    priceAssessment: assessment,
  };
}

type AnalyzeOptions = {
  primaryStoreName?: string | null;
  now?: number;
};

/**
 * 食材ごとの価格分析（期間別・店舗別）。
 * 通常表示の中心は 90 日中央値。
 * 第3引数は primaryStoreName 文字列（互換）または options。
 */
export function analyzeIngredientPrices(
  ingredientName: string,
  records: IngredientPriceRecord[],
  optionsOrPrimaryStore?: AnalyzeOptions | string | null,
): IngredientPriceAnalysis {
  const options: AnalyzeOptions =
    typeof optionsOrPrimaryStore === "string" || optionsOrPrimaryStore == null
      ? { primaryStoreName: optionsOrPrimaryStore ?? null }
      : optionsOrPrimaryStore;
  const now = options.now ?? Date.now();
  const key = normalizeIngredientName(ingredientName);
  const matched = records.filter((r) => r.normalizedIngredientName === key);
  const priced = matched
    .filter((r) => r.pricePer100g != null)
    .map((r) => ({ at: r.purchasedAt, price: r.pricePer100g as number }));

  const latest = calculateLatestPrice(priced);
  const p30 = periodStats(matched, 30, now);
  const p90 = periodStats(matched, 90, now);
  const p365 = periodStats(matched, 365, now);
  const pAll = periodStats(matched, null, now);

  const byStoreMap = new Map<string, IngredientPriceRecord[]>();
  for (const r of matched) {
    const k = r.storeId || r.storeName || "unknown";
    const list = byStoreMap.get(k) ?? [];
    list.push(r);
    byStoreMap.set(k, list);
  }
  const byStore = [...byStoreMap.entries()].map(([k, list]) =>
    storeSlice(list[0]?.storeName || k, list[0]?.storeId ?? null, list, now),
  );

  let lowestAcross: IngredientPriceAnalysis["lowestAcrossStores90Days"] = null;
  for (const slice of byStore) {
    if (slice.sparseData || slice.medianPrice90Days == null) continue;
    const storeRecords = matched.filter(
      (r) =>
        (slice.storeId && r.storeId === slice.storeId) ||
        r.storeName === slice.storeName,
    );
    const values = per100Values(filterWithinDays(storeRecords, 90, now));
    if (values.length === 0) continue;
    const low = Math.min(...values);
    if (!lowestAcross || low < lowestAcross.pricePer100g) {
      lowestAcross = { storeName: slice.storeName, pricePer100g: low };
    }
  }

  const primaryName = options?.primaryStoreName ?? null;
  const primarySlice = primaryName
    ? byStore.find((s) => s.storeName === primaryName)
    : null;

  const sampleCount = matched.length;
  const quality = classifyDataQuality(sampleCount);
  const vs =
    latest != null && p90.median != null && p90.median > 0
      ? ((latest - p90.median) / p90.median) * 100
      : null;

  const priceAssessment = assessPriceVsMedian(latest, p90.median, sampleCount);
  const priceTrend = calculatePriceTrend(latest, p90.median, sampleCount);
  const priceIndex = calculatePriceIndex(latest, p90.median, sampleCount);

  // 季節比較: 同月の過去実績が十分あるときのみ
  const currentMonth = new Date(now).getMonth();
  const seasonalPool = filterSameMonthPastYears(matched, currentMonth, new Date(now));
  const seasonalValues = per100Values(seasonalPool);
  const seasonalMedian =
    seasonalValues.length >= PRICE_SAMPLE_THRESHOLDS.sufficientMin
      ? calculatePriceMedian(seasonalValues)
      : null;
  const seasonalAssessment =
    seasonalMedian != null
      ? assessPriceVsMedian(latest, seasonalMedian, seasonalValues.length)
      : null;

  return {
    ingredientName,
    normalizedIngredientName: key,
    latestPricePer100g: latest,
    medianPrice30Days: p30.median,
    medianPrice90Days: p90.median,
    lowestPrice90Days: p90.lowest,
    highestPrice90Days: p90.highest,
    medianPrice365Days: p365.median,
    overallMedianPer100g: pAll.median,
    priceTrend,
    sampleCount,
    sparseData: quality !== "sufficient",
    dataQuality: quality,
    vsMedianPercent: quality === "sufficient" ? vs : null,
    priceAssessment,
    priceIndex,
    byStore,
    lowestAcrossStores90Days: lowestAcross,
    primaryStoreMedianPer100g: primarySlice?.medianPrice90Days ?? null,
    storeSpecificMedian: primarySlice?.medianPrice90Days ?? null,
    seasonalMedianPer100g: seasonalMedian,
    seasonalAssessment,
    periods: {
      days30: p30,
      days90: p90,
      days365: p365,
      all: pAll,
    },
  };
}

/** 互換エイリアス */
export const analyzeIngredientPrice = analyzeIngredientPrices;

export function analyzeStorePrices(
  storeId: string | null,
  storeName: string,
  records: IngredientPriceRecord[],
  now = Date.now(),
): StorePriceAnalysis {
  const matched = records.filter(
    (r) =>
      (storeId && r.storeId === storeId) ||
      (!!storeName && r.storeName === storeName),
  );
  const byIngredient = new Map<string, IngredientPriceRecord[]>();
  for (const r of matched) {
    const list = byIngredient.get(r.normalizedIngredientName) ?? [];
    list.push(r);
    byIngredient.set(r.normalizedIngredientName, list);
  }
  const ingredients = [...byIngredient.keys()].map((name) =>
    analyzeIngredientPrices(name, matched, { now }),
  );
  return {
    storeId,
    storeName,
    sampleCount: matched.length,
    ingredientCount: byIngredient.size,
    ingredients,
  };
}
