import {
  estimateIngredientPrice,
  loadIngredientPrices,
} from "@/lib/food-budget/prices";
import { getActiveStoreProfile, loadFoodBudgetSettings } from "@/lib/food-budget/settings";
import {
  ceilToPackCount,
  formatGramsLabel,
  formatQuantityWithUnit,
  toGramsEquivalent,
} from "@/lib/food-budget/unit-convert";
import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import { generateAggregatedIngredientsFromMealPlan } from "@/lib/shopping/generate-shopping-list";
import { isPantryIngredientType } from "@/types/ingredient-meta";
import type {
  BulkPackAllocationDay,
  BulkPackSuggestion,
  FoodBudgetSettings,
  IngredientCostLine,
  WeekBudgetSummary,
} from "@/types/food-budget";
import type { InventoryItem } from "@/types/inventory";
import type { MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import type { IngredientPriceRecord } from "@/types/ingredient-price";
import type { AggregatedIngredientGroup } from "@/types/shopping-list";
import type { StoreProfile } from "@/types/store-profile";
import { getPantryStockStatus } from "@/lib/pantry-stock";

export type WeekCostInput = {
  mealPlan: MealPlan;
  recipes: Recipe[];
  inventory?: InventoryItem[];
  priceRecords?: IngredientPriceRecord[];
  settings?: FoodBudgetSettings;
  /** 週ごとの予算上書き（null で世帯デフォルト） */
  weeklyFoodBudgetYenOverride?: number | null;
  /** テスト・上書き用の在庫状態取得 */
  getStockStatus?: (ingredientName: string) => ReturnType<
    typeof getPantryStockStatus
  >;
};

function inventoryGramsForName(
  name: string,
  inventory: InventoryItem[],
): number {
  const key = normalizeIngredientName(name);
  let total = 0;
  for (const item of inventory) {
    if (normalizeIngredientName(item.name) !== key) continue;
    if (item.amount?.kind === "quantity") {
      const grams = toGramsEquivalent(item.amount.value, item.unit);
      if (grams != null) total += grams;
      continue;
    }
    // プリセットは厳密換算しない（不足分購入を過大評価しないため 0）
  }
  return total;
}

function primaryConsumed(
  group: AggregatedIngredientGroup,
): { quantity: number | null; unit: string; grams: number | null } {
  const line = group.quantities[0];
  if (!line) {
    return { quantity: null, unit: "", grams: null };
  }
  // 複数行はグラム換算できるものだけ合算
  let gramsSum = 0;
  let hasGrams = false;
  for (const q of group.quantities) {
    const g = toGramsEquivalent(q.quantity, q.unit);
    if (g != null) {
      gramsSum += g;
      hasGrams = true;
    }
  }
  if (hasGrams) {
    return {
      quantity: gramsSum,
      unit: "g",
      grams: gramsSum,
    };
  }
  return {
    quantity: line.quantity,
    unit: line.unit,
    grams: null,
  };
}

function resolvePackGrams(
  estimate: ReturnType<typeof estimateIngredientPrice>,
  store: StoreProfile,
  neededGrams: number,
): { packGrams: number; packPriceYen: number | null; packLabel: string } {
  if (
    estimate.gramsEquivalent != null &&
    estimate.gramsEquivalent > 0 &&
    estimate.estimatedPurchasePriceYen != null
  ) {
    return {
      packGrams: estimate.gramsEquivalent,
      packPriceYen: estimate.estimatedPurchasePriceYen,
      packLabel: formatQuantityWithUnit(
        estimate.packageQuantity,
        estimate.packageUnit ?? "",
      ),
    };
  }

  // 価格履歴がない場合はパックサイズを推測しない（購入額は未登録）
  if (neededGrams <= 0) {
    return { packGrams: 0, packPriceYen: null, packLabel: "" };
  }

  // 大容量前提の仮パック（金額は未登録のまま）
  const multiplier = store.prefersBulkPurchase
    ? store.defaultPackSizeMultiplier
    : 1;
  const packGrams = Math.max(100, Math.round(neededGrams * multiplier));
  return {
    packGrams,
    packPriceYen: null,
    packLabel: formatGramsLabel(packGrams),
  };
}

function roundYen(value: number): number {
  return Math.round(value);
}

/**
 * 献立から購入額・使用原価・繰越価値を分離して計算する。
 */
export function calculateWeekBudgetSummary(
  input: WeekCostInput,
): WeekBudgetSummary {
  const settings = input.settings ?? loadFoodBudgetSettings();
  const store = getActiveStoreProfile(settings);
  const prices = input.priceRecords ?? loadIngredientPrices();
  const inventory = input.inventory ?? [];
  const aggregated = generateAggregatedIngredientsFromMealPlan(
    input.mealPlan,
    input.recipes,
  );

  const lines: IngredientCostLine[] = [];
  let purchaseSum = 0;
  let consumedSum = 0;
  let carrySum = 0;
  let hasPurchase = false;
  let hasConsumed = false;
  let hasCarry = false;
  let pricedLineCount = 0;
  let unpricedLineCount = 0;

  const usageByIngredient = new Map<
    string,
    { name: string; days: BulkPackAllocationDay[]; totalGrams: number }
  >();

  for (const group of aggregated) {
    const consumed = primaryConsumed(group);
    const estimate = estimateIngredientPrice(
      group.ingredientName,
      prices,
      settings.primaryStoreName,
    );
    const isPantry = isPantryIngredientType(group.ingredientType);
    const resolveStatus = input.getStockStatus ?? getPantryStockStatus;
    const pantryStatus = resolveStatus(group.ingredientName);
    const stockGrams = inventoryGramsForName(group.ingredientName, inventory);

    // 常備品で十分 → 新規購入なし・使用原価も計上しない（家にある前提）
    if (isPantry && pantryStatus === "enough") {
      lines.push({
        ingredientName: group.ingredientName,
        normalizedIngredientName: normalizeIngredientName(group.ingredientName),
        consumedQuantity: consumed.quantity,
        consumedUnit: consumed.unit,
        consumedGrams: consumed.grams,
        purchaseQuantity: 0,
        purchaseUnit: consumed.unit,
        purchaseGrams: 0,
        carryoverQuantity: 0,
        carryoverUnit: consumed.unit,
        carryoverGrams: 0,
        estimatedPurchaseCostYen: 0,
        estimatedConsumedCostYen: 0,
        estimatedCarryoverValueYen: 0,
        pricePer100g: estimate.pricePer100g,
        priceStoreName: estimate.storeName,
        pricePurchasedAt: estimate.purchasedAt,
        priceMissing: estimate.source === "none",
        isPantry: true,
        purchaseSkipped: true,
        freezeCarryover: false,
      });
      continue;
    }

    const neededGrams = consumed.grams ?? 0;
    const netNeededGrams = Math.max(0, neededGrams - stockGrams);

    const pack = resolvePackGrams(estimate, store, netNeededGrams);
    let purchaseGrams = 0;
    let purchaseCost: number | null = null;

    if (netNeededGrams <= 0) {
      purchaseGrams = 0;
      purchaseCost = 0;
    } else if (pack.packGrams > 0 && pack.packPriceYen != null) {
      const packs = ceilToPackCount(netNeededGrams, pack.packGrams);
      purchaseGrams = packs * pack.packGrams;
      purchaseCost = roundYen(packs * pack.packPriceYen);
    } else if (pack.packGrams > 0) {
      // パックサイズは分かるが価格未登録
      const packs = ceilToPackCount(netNeededGrams, pack.packGrams);
      purchaseGrams = packs * pack.packGrams;
      purchaseCost = null;
    } else {
      purchaseGrams = netNeededGrams;
      purchaseCost = null;
    }

    const carryoverGrams = Math.max(0, purchaseGrams + stockGrams - neededGrams);

    let consumedCost: number | null = null;
    let carryValue: number | null = null;

    if (estimate.pricePer100g != null && neededGrams > 0) {
      consumedCost = roundYen((neededGrams / 100) * estimate.pricePer100g);
      hasConsumed = true;
      consumedSum += consumedCost;
    } else if (
      purchaseCost != null &&
      purchaseGrams > 0 &&
      neededGrams > 0
    ) {
      consumedCost = roundYen(purchaseCost * (neededGrams / purchaseGrams));
      hasConsumed = true;
      consumedSum += consumedCost;
    }

    if (estimate.pricePer100g != null && carryoverGrams > 0) {
      carryValue = roundYen((carryoverGrams / 100) * estimate.pricePer100g);
      hasCarry = true;
      carrySum += carryValue;
    } else if (
      purchaseCost != null &&
      purchaseGrams > 0 &&
      carryoverGrams > 0
    ) {
      carryValue = roundYen(purchaseCost * (carryoverGrams / purchaseGrams));
      hasCarry = true;
      carrySum += carryValue;
    }

    if (purchaseCost != null) {
      hasPurchase = true;
      purchaseSum += purchaseCost;
      if (purchaseCost > 0 || netNeededGrams === 0) {
        // priced
      }
    }

    const priceMissing =
      estimate.source === "none" && netNeededGrams > 0 && !isPantry;
    if (priceMissing) {
      unpricedLineCount += 1;
    } else if (estimate.source !== "none") {
      pricedLineCount += 1;
    }

    const freezable =
      /肉|豚|牛|鶏|挽|ひき|魚|エビ|イカ/.test(group.ingredientName) ||
      group.ingredientType === "pantryFood";

    lines.push({
      ingredientName: group.ingredientName,
      normalizedIngredientName: normalizeIngredientName(group.ingredientName),
      consumedQuantity: consumed.quantity,
      consumedUnit: consumed.unit,
      consumedGrams: consumed.grams,
      purchaseQuantity:
        purchaseGrams > 0
          ? purchaseGrams >= 1000 && purchaseGrams % 1000 === 0
            ? purchaseGrams / 1000
            : purchaseGrams
          : 0,
      purchaseUnit:
        purchaseGrams >= 1000 && purchaseGrams % 1000 === 0 ? "kg" : "g",
      purchaseGrams,
      carryoverQuantity: carryoverGrams > 0 ? carryoverGrams : 0,
      carryoverUnit: "g",
      carryoverGrams,
      estimatedPurchaseCostYen: purchaseCost,
      estimatedConsumedCostYen: consumedCost,
      estimatedCarryoverValueYen: carryValue,
      pricePer100g: estimate.pricePer100g,
      priceStoreName: estimate.storeName,
      pricePurchasedAt: estimate.purchasedAt,
      priceMissing,
      isPantry,
      purchaseSkipped: netNeededGrams <= 0 || (isPantry && pantryStatus === "enough"),
      freezeCarryover: freezable && carryoverGrams > 0,
    });

    // 配分用: ソース日別
    if (neededGrams > 0 && store.prefersBulkPurchase && purchaseGrams >= neededGrams) {
      const days: BulkPackAllocationDay[] = group.sources.map((source) => {
        const g = toGramsEquivalent(source.quantity, source.unit) ?? 0;
        return {
          date: source.date,
          recipeName: source.recipeName,
          quantityGrams: g,
          quantityLabel:
            g > 0
              ? formatGramsLabel(g)
              : formatQuantityWithUnit(source.quantity, source.unit),
        };
      });
      usageByIngredient.set(normalizeIngredientName(group.ingredientName), {
        name: group.ingredientName,
        days,
        totalGrams: neededGrams,
      });
    }
  }

  const bulkSuggestions = buildBulkSuggestions(lines, usageByIngredient, store);

  const budgetYen =
    input.weeklyFoodBudgetYenOverride !== undefined
      ? input.weeklyFoodBudgetYenOverride
      : settings.weeklyFoodBudgetYen;

  const estimatedPurchaseCostYen = hasPurchase ? purchaseSum : null;
  // 価格が一部でもあれば合計を出す。未登録のみなら null
  const estimatedConsumedCostYen = hasConsumed ? consumedSum : null;
  const estimatedCarryoverValueYen = hasCarry ? carrySum : null;

  let remainingBudgetYen: number | null = null;
  if (budgetYen != null && estimatedPurchaseCostYen != null) {
    remainingBudgetYen = budgetYen - estimatedPurchaseCostYen;
  }

  return {
    weeklyFoodBudgetYen: budgetYen,
    budgetMode: settings.budgetMode,
    estimatedPurchaseCostYen,
    estimatedConsumedCostYen,
    estimatedCarryoverValueYen,
    remainingBudgetYen,
    pricedLineCount,
    unpricedLineCount,
    lines,
    bulkSuggestions,
  };
}

function buildBulkSuggestions(
  lines: IngredientCostLine[],
  usageByIngredient: Map<
    string,
    { name: string; days: BulkPackAllocationDay[]; totalGrams: number }
  >,
  store: StoreProfile,
): BulkPackSuggestion[] {
  if (!store.prefersBulkPurchase) return [];

  const suggestions: BulkPackSuggestion[] = [];
  for (const line of lines) {
    if (line.purchaseSkipped || line.purchaseGrams == null) continue;
    if (line.purchaseGrams < 500) continue;
    const usage = usageByIngredient.get(line.normalizedIngredientName);
    if (!usage || usage.days.length < 2) continue;

    const leftover = line.carryoverGrams ?? 0;
    const dishCount = new Set(usage.days.map((d) => d.recipeName)).size;
    suggestions.push({
      ingredientName: line.ingredientName,
      packLabel: formatGramsLabel(line.purchaseGrams),
      packGrams: line.purchaseGrams,
      usedGrams: usage.totalGrams,
      leftoverGrams: leftover,
      freezeLeftover: line.freezeCarryover,
      summary: `${line.ingredientName}${formatGramsLabel(line.purchaseGrams)}を${dishCount}品で使用`,
      leftoverSummary:
        leftover > 0
          ? line.freezeCarryover
            ? `残り${formatGramsLabel(leftover)}は冷凍予定`
            : `残り${formatGramsLabel(leftover)}`
          : "使い切り予定",
      days: usage.days,
    });
  }
  return suggestions.sort((a, b) => b.packGrams - a.packGrams);
}

/** テスト用: 1kg購入・600g使用の計算 */
export function computePackSplitCost(input: {
  purchasePriceYen: number;
  packageGrams: number;
  consumedGrams: number;
}): {
  estimatedPurchaseCost: number;
  estimatedConsumedCost: number;
  estimatedCarryoverValue: number;
} {
  const { purchasePriceYen, packageGrams, consumedGrams } = input;
  const used = Math.min(consumedGrams, packageGrams);
  const carry = Math.max(0, packageGrams - used);
  return {
    estimatedPurchaseCost: purchasePriceYen,
    estimatedConsumedCost: roundYen(purchasePriceYen * (used / packageGrams)),
    estimatedCarryoverValue: roundYen(purchasePriceYen * (carry / packageGrams)),
  };
}
