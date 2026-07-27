import { analyzeIngredientPrices } from "@/lib/price-learning/analyze";
import { assessmentLabel } from "@/lib/price-learning/assessment";
import { BUY_SCORE_WEIGHTS } from "@/lib/price-learning/thresholds";
import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import type {
  BuyScoreResult,
  IngredientPriceRecord,
} from "@/types/ingredient-price";
import type { InventoryItem } from "@/types/inventory";

export type BuyScoreContext = {
  ingredientName: string;
  priceRecords: IngredientPriceRecord[];
  /** 今週の献立で必要なグラム（任意） */
  neededGramsThisWeek?: number | null;
  /** 使用予定レシピ数 */
  plannedRecipeCount?: number;
  inventory?: InventoryItem[];
  primaryStoreName?: string | null;
  plannedStoreIds?: string[];
  preferStoreId?: string | null;
  /** 大容量パックを使い切れそうか（0〜1） */
  bulkUsability?: number | null;
  freezable?: boolean;
  perishable?: boolean;
  now?: number;
};

function inventorySufficient(
  name: string,
  inventory: InventoryItem[] | undefined,
): boolean {
  if (!inventory || inventory.length === 0) return false;
  const key = normalizeIngredientName(name);
  return inventory.some((item) => {
    if (normalizeIngredientName(item.name) !== key) return false;
    const amount = item.amount;
    if (amount == null) return true;
    if (amount.kind === "quantity") return amount.value > 0;
    if (amount.kind === "preset") {
      return amount.preset === "half" || amount.preset === "lot";
    }
    return true;
  });
}

function starsFromScore(score: number): number {
  if (score >= 85) return 5;
  if (score >= 70) return 4;
  if (score >= 55) return 3;
  if (score >= 40) return 2;
  if (score >= 20) return 1;
  return 0;
}

/**
 * 買い時スコア。価格だけでなく在庫・献立需要・店舗予定も加味する。
 * 価格が安くても在庫十分なら下げる。
 */
export function calculateBuyScore(ctx: BuyScoreContext): BuyScoreResult {
  const w = BUY_SCORE_WEIGHTS;
  const analysis = analyzeIngredientPrices(ctx.ingredientName, ctx.priceRecords, {
    primaryStoreName: ctx.primaryStoreName,
    now: ctx.now,
  });
  const reasons: string[] = [];
  let score = 50;

  if (analysis.dataQuality === "none") {
    return {
      ingredientName: ctx.ingredientName,
      score: 0,
      stars: 0,
      reasons: ["価格未登録"],
      analysis,
      shouldBuyHint: "unknown",
    };
  }

  if (analysis.dataQuality === "reference_only") {
    reasons.push("データが1件のみのため参考評価");
    score -= 15;
  } else if (analysis.dataQuality === "provisional") {
    reasons.push(`データが${analysis.sampleCount}件のみのため参考評価`);
    score -= 8;
  } else {
    score += w.sampleConfidence * 0.3;
  }

  if (analysis.vsMedianPercent != null) {
    const pct = analysis.vsMedianPercent;
    if (pct <= -15) {
      score += w.vsMedian;
      reasons.push(`90日中央値より${Math.abs(Math.round(pct))}%安い`);
    } else if (pct <= -5) {
      score += w.vsMedian * 0.7;
      reasons.push(`90日中央値より${Math.abs(Math.round(pct))}%安い`);
    } else if (pct >= 15) {
      score -= w.vsMedian * 0.8;
      reasons.push(`90日中央値より${Math.round(pct)}%高い`);
    } else if (pct >= 5) {
      score -= w.vsMedian * 0.4;
      reasons.push(`90日中央値より${Math.round(pct)}%高い`);
    } else {
      reasons.push(assessmentLabel(analysis.priceAssessment));
    }
  } else if (analysis.priceAssessment === "insufficient_data") {
    reasons.push("価格データがまだ少ないです");
  }

  if (
    analysis.latestPricePer100g != null &&
    analysis.lowestPrice90Days != null &&
    analysis.lowestPrice90Days > 0
  ) {
    const dist =
      (analysis.latestPricePer100g - analysis.lowestPrice90Days) /
      analysis.lowestPrice90Days;
    if (dist <= 0.05) {
      score += w.vsLowest;
      reasons.push("過去最安値に近い");
    } else if (dist >= 0.2) {
      score -= w.vsLowest * 0.5;
    }
  }

  const needed = ctx.neededGramsThisWeek ?? 0;
  const recipeCount = ctx.plannedRecipeCount ?? 0;
  if (recipeCount >= 3 || needed >= 500) {
    score += w.mealPlanNeed;
    reasons.push(
      recipeCount > 0
        ? `今週${recipeCount}品で使用予定`
        : "今週の献立で必要",
    );
  } else if (recipeCount === 0 && needed <= 0) {
    score -= 10;
  }

  if (inventorySufficient(ctx.ingredientName, ctx.inventory)) {
    score -= w.inventoryPenalty;
    reasons.push("在庫が十分なため購入不要");
  }

  if (ctx.freezable) {
    score += 3;
    reasons.push("冷凍保存可能");
  }
  if (ctx.perishable && !inventorySufficient(ctx.ingredientName, ctx.inventory)) {
    score += w.perishableBonus * 0.4;
  }

  if (ctx.bulkUsability != null) {
    if (ctx.bulkUsability >= 0.7) {
      score += w.bulkUsability;
      reasons.push("大容量パックを使い切れそう");
    } else if (ctx.bulkUsability < 0.3) {
      score -= w.bulkUsability;
      reasons.push("大容量を使い切れない可能性");
    }
  }

  const preferId = ctx.preferStoreId;
  const planned = ctx.plannedStoreIds ?? [];
  if (preferId && planned.includes(preferId)) {
    score += w.plannedStoreBonus;
    reasons.push("予定店舗で購入できる");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const stars = starsFromScore(score);

  let shouldBuyHint: BuyScoreResult["shouldBuyHint"] = "maybe";
  if (reasons.some((r) => r.includes("購入不要"))) {
    shouldBuyHint = "skip";
  } else if (stars >= 4 && analysis.dataQuality === "sufficient") {
    shouldBuyHint = "buy";
  } else if (stars <= 1) {
    shouldBuyHint = "skip";
  } else if (analysis.dataQuality !== "sufficient") {
    shouldBuyHint = "unknown";
  }

  return {
    ingredientName: ctx.ingredientName,
    score,
    stars,
    reasons: reasons.slice(0, 5),
    analysis,
    shouldBuyHint,
  };
}
