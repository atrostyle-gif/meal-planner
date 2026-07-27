import { assessmentLabel } from "@/lib/price-learning/assessment";
import type {
  BuyScoreResult,
  IngredientPriceAnalysis,
  PriceAssessment,
} from "@/types/ingredient-price";

export function explainPriceAssessment(
  analysis: IngredientPriceAnalysis,
): string[] {
  const lines: string[] = [];
  if (analysis.dataQuality === "none") {
    return ["価格データがまだ少ないです"];
  }
  if (analysis.dataQuality === "reference_only") {
    lines.push("参考データが少ない（1件）");
  } else if (analysis.dataQuality === "provisional") {
    lines.push(`仮評価（登録${analysis.sampleCount}件）`);
  }

  lines.push(assessmentLabel(analysis.priceAssessment));

  if (
    analysis.latestPricePer100g != null &&
    analysis.medianPrice90Days != null
  ) {
    lines.push(
      `直近 ${Math.round(analysis.latestPricePer100g)}円／100g・90日中央値 ${Math.round(analysis.medianPrice90Days)}円／100g`,
    );
  }
  if (analysis.lowestPrice90Days != null) {
    lines.push(`90日最安 ${Math.round(analysis.lowestPrice90Days)}円／100g`);
  }
  if (
    analysis.seasonalMedianPer100g != null &&
    analysis.seasonalAssessment &&
    analysis.seasonalAssessment !== "insufficient_data"
  ) {
    lines.push(
      `同月の過去実績と比べて${assessmentLabel(analysis.seasonalAssessment)}`,
    );
  }
  return lines;
}

export function explainBuyScore(result: BuyScoreResult): string[] {
  return result.reasons;
}

export function shortAssessmentPhrase(
  assessment: PriceAssessment,
): string | null {
  switch (assessment) {
    case "very_cheap":
      return "かなり安い";
    case "cheap":
      return "少し安い";
    case "expensive":
      return "少し高い";
    case "very_expensive":
      return "かなり高い";
    case "normal":
      return "普段どおり";
    default:
      return null;
  }
}
