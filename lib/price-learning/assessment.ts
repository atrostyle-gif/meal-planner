import {
  PRICE_ASSESSMENT_THRESHOLDS,
  PRICE_SAMPLE_THRESHOLDS,
  PRICE_TREND_THRESHOLDS,
} from "@/lib/price-learning/thresholds";
import type {
  PriceAssessment,
  PriceDataQuality,
  PriceTrend,
} from "@/types/ingredient-price";

export function classifyDataQuality(sampleCount: number): PriceDataQuality {
  if (sampleCount <= 0) return "none";
  if (sampleCount <= PRICE_SAMPLE_THRESHOLDS.referenceOnlyMax) {
    return "reference_only";
  }
  if (sampleCount <= PRICE_SAMPLE_THRESHOLDS.provisionalMax) {
    return "provisional";
  }
  return "sufficient";
}

/**
 * 直近価格と基準中央値の比較で評価。
 * データ不足時は insufficient_data（断定しない）。
 */
export function assessPriceVsMedian(
  latestPrice: number | null,
  medianPrice: number | null,
  sampleCount: number,
): PriceAssessment {
  const quality = classifyDataQuality(sampleCount);
  if (
    quality === "none" ||
    quality === "reference_only" ||
    latestPrice == null ||
    medianPrice == null ||
    medianPrice <= 0
  ) {
    return "insufficient_data";
  }

  const percent = ((latestPrice - medianPrice) / medianPrice) * 100;
  const t = PRICE_ASSESSMENT_THRESHOLDS;

  if (percent <= t.veryCheapPercent) return "very_cheap";
  if (percent <= t.cheapPercent) return "cheap";
  if (percent < t.normalBandPercent) return "normal";
  if (percent < t.expensivePercent) return "expensive";
  return "very_expensive";
}

export function calculatePriceTrend(
  latestPrice: number | null,
  medianPrice: number | null,
  sampleCount: number,
): PriceTrend {
  if (
    classifyDataQuality(sampleCount) === "none" ||
    classifyDataQuality(sampleCount) === "reference_only" ||
    latestPrice == null ||
    medianPrice == null ||
    medianPrice === 0
  ) {
    return "insufficient_data";
  }
  const diff = (latestPrice - medianPrice) / medianPrice;
  const band = PRICE_TREND_THRESHOLDS.changeRatio;
  if (diff <= -band) return "falling";
  if (diff >= band) return "rising";
  return "stable";
}

/** 100 = 中央値相当。安いほど低い。データ不足は null */
export function calculatePriceIndex(
  latestPrice: number | null,
  medianPrice: number | null,
  sampleCount: number,
): number | null {
  if (
    classifyDataQuality(sampleCount) === "none" ||
    classifyDataQuality(sampleCount) === "reference_only" ||
    latestPrice == null ||
    medianPrice == null ||
    medianPrice <= 0
  ) {
    return null;
  }
  return Math.round((latestPrice / medianPrice) * 1000) / 10;
}

export function assessmentLabel(assessment: PriceAssessment): string {
  switch (assessment) {
    case "very_cheap":
      return "かなり安い";
    case "cheap":
      return "少し安い";
    case "normal":
      return "普段どおり";
    case "expensive":
      return "少し高い";
    case "very_expensive":
      return "かなり高い";
    case "insufficient_data":
      return "価格データがまだ少ないです";
  }
}

/** 旧 trend 値との互換 */
export function legacyTrendFrom(trend: PriceTrend): "up" | "down" | "flat" | "unknown" {
  switch (trend) {
    case "rising":
      return "up";
    case "falling":
      return "down";
    case "stable":
      return "flat";
    default:
      return "unknown";
  }
}
