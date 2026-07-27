import { estimateIngredientPrice } from "@/lib/food-budget/prices";
import {
  formatGramsLabel,
  toGramsEquivalent,
} from "@/lib/food-budget/unit-convert";
import { analyzeIngredientPrice } from "@/lib/receipt/analytics";
import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import { isPantryIngredientType } from "@/types/ingredient-meta";
import type { FoodBudgetSettings, MealPlanScoreWeights } from "@/types/food-budget";
import type { IngredientPriceRecord } from "@/types/ingredient-price";
import type { InventoryItem } from "@/types/inventory";
import type { Recipe } from "@/types/recipe";
import type { StoreProfile } from "@/types/store-profile";
import type {
  SelectionReason,
  SelectionReasonBadge,
} from "@/types/weekly-meal-plan";

export type BudgetScoreContext = {
  settings: FoodBudgetSettings;
  store: StoreProfile;
  priceRecords: IngredientPriceRecord[];
  inventory: InventoryItem[];
  /** これまでに選んだレシピ（週内） */
  selectedRecipes: Recipe[];
  weeklyFoodBudgetYen: number | null;
  /** これまでに見積もった購入累計（円）。未登録は加算しない */
  runningPurchaseCostYen: number;
};

export type BudgetScoreResult = {
  scoreDelta: number;
  reasons: SelectionReason[];
  badges: SelectionReasonBadge[];
  /** このレシピ追加で増える見込み購入額（価格がある分のみ） */
  addedPurchaseCostYen: number;
};

function perishableIngredient(name: string): boolean {
  return /野菜|レタス|きゅうり|トマト|もやし|にら|ニラ|葉|きのこ|豆腐|肉|魚|鶏|豚|牛/.test(
    name,
  );
}

function freezableIngredient(name: string): boolean {
  return /肉|豚|牛|鶏|挽|ひき|魚|エビ|イカ/.test(name);
}

function recipeIngredientGrams(recipe: Recipe): Map<string, number> {
  const map = new Map<string, number>();
  for (const ingredient of recipe.ingredients) {
    if (isPantryIngredientType(ingredient.ingredientType)) continue;
    const grams = toGramsEquivalent(ingredient.quantity, ingredient.unit);
    if (grams == null || grams <= 0) continue;
    const key = normalizeIngredientName(ingredient.name);
    map.set(key, (map.get(key) ?? 0) + grams);
  }
  return map;
}

function inventoryHas(name: string, inventory: InventoryItem[]): boolean {
  const key = normalizeIngredientName(name);
  return inventory.some((item) => normalizeIngredientName(item.name) === key);
}

/**
 * 予算・大容量使い回し・在庫・傷みやすさの加点減点。
 * 価格未登録は 0 円扱いせず中立。
 */
export function scoreBudgetSupport(
  recipe: Recipe,
  ctx: BudgetScoreContext,
): BudgetScoreResult {
  const w: MealPlanScoreWeights = ctx.settings.scoreWeights;
  let scoreDelta = 0;
  const reasons: SelectionReason[] = [];
  const badges: SelectionReasonBadge[] = [];
  let addedPurchaseCostYen = 0;

  const recipeGrams = recipeIngredientGrams(recipe);
  const selectedKeys = new Map<string, number>();
  for (const selected of ctx.selectedRecipes) {
    for (const [key, grams] of recipeIngredientGrams(selected)) {
      selectedKeys.set(key, (selectedKeys.get(key) ?? 0) + grams);
    }
  }

  for (const ingredient of recipe.ingredients) {
    const key = normalizeIngredientName(ingredient.name);
    const grams = recipeGrams.get(key) ?? 0;

    // 常備品は新規購入額へ加算しない
    if (isPantryIngredientType(ingredient.ingredientType)) {
      continue;
    }

    const estimate = estimateIngredientPrice(
      ingredient.name,
      ctx.priceRecords,
      ctx.settings.primaryStoreName,
    );
    const analysis = analyzeIngredientPrice(
      ingredient.name,
      ctx.priceRecords,
      ctx.settings.primaryStoreName,
    );
    const recentPurchase = ctx.priceRecords.find(
      (r) =>
        r.normalizedIngredientName === key &&
        Date.now() - new Date(r.purchasedAt).getTime() <
          14 * 24 * 60 * 60 * 1000,
    );

    if (inventoryHas(ingredient.name, ctx.inventory)) {
      scoreDelta += 8 * w.fridge;
      const freezeHint = freezableIngredient(ingredient.name);
      reasons.push({
        detail: freezeHint
          ? `冷凍在庫の${ingredient.name}を活用`
          : `在庫の${ingredient.name}を活用`,
        badge: freezeHint ? "冷凍在庫を活用" : "冷蔵庫消費",
      });
      badges.push(freezeHint ? "冷凍在庫を活用" : "冷蔵庫消費");
    } else if (recentPurchase) {
      // 直近購入済みを活用（追加購入を避ける）
      scoreDelta += 14 * w.fridge;
      const storeLabel = recentPurchase.storeName || "店舗";
      const badge =
        /ロピア/.test(storeLabel) ? "ロピアで購入済み" : "購入済み食材";
      reasons.push({
        detail: `${storeLabel}で購入済みの${ingredient.name}を活用`,
        badge,
      });
      badges.push(badge);
    } else if (
      estimate.estimatedPurchasePriceYen != null &&
      estimate.gramsEquivalent != null &&
      estimate.gramsEquivalent > 0 &&
      grams > 0
    ) {
      const already = selectedKeys.get(key) ?? 0;
      if (already <= 0) {
        addedPurchaseCostYen += estimate.estimatedPurchasePriceYen;
      }
    }

    if (
      !analysis.sparseData &&
      analysis.vsMedianPercent != null &&
      analysis.vsMedianPercent <= -3
    ) {
      scoreDelta += 10 * w.budget;
      reasons.push({
        detail: `${ingredient.name}が普段より安く購入できる`,
        badge: "普段より安く購入",
      });
      badges.push("普段より安く購入");
    } else if (
      !analysis.sparseData &&
      analysis.vsMedianPercent != null &&
      analysis.vsMedianPercent >= 15
    ) {
      scoreDelta -= 12 * w.budget;
      reasons.push({ detail: `${ingredient.name}が普段より高め` });
    }

    // 大容量を複数料理で使い回し
    if (ctx.store.prefersBulkPurchase && grams > 0) {
      const already = selectedKeys.get(key) ?? 0;
      if (already > 0) {
        scoreDelta += 12 * w.bulkUsage;
        reasons.push({
          detail: `${ingredient.name}を他の料理と共有（大容量パック活用）`,
          badge: "まとめ買い向き",
        });
        badges.push("まとめ買い向き");
      } else if (
        estimate.gramsEquivalent != null &&
        estimate.gramsEquivalent >= 500 &&
        grams < estimate.gramsEquivalent * 0.35
      ) {
        scoreDelta -= 10 * w.bulkUsage;
        reasons.push({
          detail: `${ingredient.name}の大容量パックが余りやすい`,
        });
      }
    }

    // 傷みやすい食材を週内で使う
    if (perishableIngredient(ingredient.name) && !freezableIngredient(ingredient.name)) {
      scoreDelta += 4 * w.perishable;
    }
  }

  // 予算以内
  const budget = ctx.weeklyFoodBudgetYen;
  if (budget != null && budget > 0) {
    const projected = ctx.runningPurchaseCostYen + addedPurchaseCostYen;
    if (addedPurchaseCostYen === 0 && ctx.runningPurchaseCostYen === 0) {
      // 価格データ不足 → 中立（確定表示しない）
    } else if (projected <= budget) {
      scoreDelta += 15 * w.budget;
      reasons.push({
        detail: "週間予算内に収まりやすい",
        badge: "週間予算内",
      });
      badges.push("週間予算内");
      badges.push("予算内");
    } else if (projected > budget * 1.15) {
      scoreDelta -= 25 * w.budget;
      reasons.push({ detail: "週間予算を超えやすい" });
    } else {
      scoreDelta -= 10 * w.budget;
      reasons.push({ detail: "週間予算に余裕が少ない" });
    }
  }

  // 同じ主食材でもジャンル連続は variety 側で既に評価。ここでは味付けタグの連続を軽く見る
  const flavor = recipe.tags.find((tag) =>
    /生姜|味噌|みそ|醤油|しょうゆ|カレー|塩|胡椒|にんにく|キムチ/.test(tag),
  );
  if (flavor) {
    const sameFlavor = ctx.selectedRecipes.some((r) =>
      r.tags.some((tag) => tag === flavor),
    );
    if (sameFlavor) {
      scoreDelta -= 8 * w.variety;
      reasons.push({ detail: "近い味付けが続きやすい" });
    }
  }

  return {
    scoreDelta,
    reasons,
    badges: [...new Set(badges)],
    addedPurchaseCostYen,
  };
}

/** 表示用の短い配分ラベル */
export function formatBulkSummary(
  ingredientName: string,
  packGrams: number,
  dishCount: number,
  leftoverGrams: number,
  freeze: boolean,
): { summary: string; leftoverSummary: string } {
  return {
    summary: `${ingredientName}${formatGramsLabel(packGrams)}を${dishCount}品で使用`,
    leftoverSummary:
      leftoverGrams > 0
        ? freeze
          ? `残り${formatGramsLabel(leftoverGrams)}は冷凍予定`
          : `残り${formatGramsLabel(leftoverGrams)}`
        : "使い切り予定",
  };
}
