import { getWeekStartFromDate } from "@/lib/date";
import { loadFoodBudgetSettings } from "@/lib/food-budget/settings";
import { loadIngredientPrices } from "@/lib/food-budget/prices";
import { toGramsEquivalent } from "@/lib/food-budget/unit-convert";
import { getFoodExpenseRepository } from "@/lib/food-expense/repository";
import { getStoreRepository } from "@/lib/stores/store-repository";
import { loadInventory } from "@/lib/inventory";
import type { FoodBudgetSettings } from "@/types/food-budget";
import {
  FOOD_EXPENSE_CATEGORY_LABELS,
  type DetailCompleteness,
  type FoodExpenseCategory,
  type FoodExpenseTransaction,
} from "@/types/food-expense";

export type MonthWindow = {
  start: Date;
  end: Date;
  label: string;
};

export function getBudgetMonthWindow(
  reference = new Date(),
  startDay = 1,
): MonthWindow {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  const day = reference.getDate();
  let start: Date;
  let end: Date;
  if (day >= startDay) {
    start = new Date(y, m, startDay, 0, 0, 0, 0);
    end = new Date(y, m + 1, startDay, 0, 0, 0, 0);
  } else {
    start = new Date(y, m - 1, startDay, 0, 0, 0, 0);
    end = new Date(y, m, startDay, 0, 0, 0, 0);
  }
  return {
    start,
    end,
    label: `${start.getFullYear()}/${start.getMonth() + 1}`,
  };
}

function inWindow(iso: string, window: MonthWindow): boolean {
  const t = new Date(iso).getTime();
  return t >= window.start.getTime() && t < window.end.getTime();
}

function isCategoryCounted(
  category: FoodExpenseCategory,
  excluded: boolean,
  settings: FoodBudgetSettings,
): boolean {
  if (excluded) return false;
  if (!settings.includeHouseholdGoods && category === "household_mixed") {
    return false;
  }
  if (!settings.includePreparedFood && category === "prepared_food") {
    return false;
  }
  return true;
}

function isEatingOutExcluded(
  tx: FoodExpenseTransaction,
  settings: FoodBudgetSettings,
): boolean {
  if (settings.includeEatingOut) return false;
  return /外食|テイクアウト|出前|デリバリー/.test(tx.memo);
}

/** 家計簿用の実支払（除外・設定反映後） */
export function foodAmount(
  tx: FoodExpenseTransaction,
  settings: FoodBudgetSettings = loadFoodBudgetSettings(),
): number {
  if (isEatingOutExcluded(tx, settings)) return 0;
  if (tx.categoryBreakdown.length === 0) {
    return tx.totalAmountYen;
  }
  const excludedYen = tx.categoryBreakdown
    .filter((row) => !isCategoryCounted(row.category, row.excluded, settings))
    .reduce((sum, row) => sum + row.amountYen, 0);
  if (excludedYen > 0) {
    return Math.max(0, tx.totalAmountYen - excludedYen);
  }
  return tx.totalAmountYen;
}

export type StoreAggregate = {
  storeId: string | null;
  storeName: string;
  brandName: string;
  amountYen: number;
  percent: number;
};

export type CategoryAggregate = {
  category: FoodExpenseCategory;
  label: string;
  amountYen: number;
  percent: number;
};

export type WeekAggregate = {
  weekStart: string;
  amountYen: number;
};

export type FoodExpenseReport = {
  monthLabel: string;
  actualPurchaseAmount: number;
  monthlyBudgetYen: number | null;
  remainingBudgetYen: number | null;
  previousMonthAmount: number;
  monthOverMonthPercent: number | null;
  weekSpendYen: number;
  monthElapsedPercent: number;
  budgetUsedPercent: number | null;
  projectedMonthEndYen: number | null;
  projectionSparse: boolean;
  byStore: StoreAggregate[];
  byBrand: StoreAggregate[];
  byCategory: CategoryAggregate[];
  byWeek: WeekAggregate[];
  byDay: { date: string; amountYen: number }[];
  transactions: FoodExpenseTransaction[];
  detailCoverage: {
    amountOnlyCount: number;
    partialCount: number;
    fullCount: number;
    priceAnalysisCoveragePercent: number;
  };
  inventoryValue: {
    fridgeYen: number | null;
    coveragePercent: number;
    purchasedUnusedYen: number | null;
    estimatedConsumedYen: number | null;
  };
};

function completenessRank(value: DetailCompleteness): number {
  if (value === "full_items") return 2;
  if (value === "partial_items") return 1;
  return 0;
}

export function buildFoodExpenseReport(
  reference = new Date(),
  settings: FoodBudgetSettings = loadFoodBudgetSettings(),
  transactions: FoodExpenseTransaction[] = getFoodExpenseRepository().list(),
): FoodExpenseReport {
  const window = getBudgetMonthWindow(
    reference,
    settings.monthlyBudgetStartDay,
  );
  const prevWindow = getBudgetMonthWindow(
    new Date(window.start.getTime() - 24 * 60 * 60 * 1000),
    settings.monthlyBudgetStartDay,
  );

  const monthTx = transactions.filter((tx) =>
    inWindow(tx.purchasedAt, window),
  );
  const prevTx = transactions.filter((tx) =>
    inWindow(tx.purchasedAt, prevWindow),
  );

  const actualPurchaseAmount = monthTx.reduce(
    (sum, tx) => sum + foodAmount(tx, settings),
    0,
  );
  const previousMonthAmount = prevTx.reduce(
    (sum, tx) => sum + foodAmount(tx, settings),
    0,
  );

  const monthlyBudgetYen = settings.monthlyFoodBudgetYen;
  const remainingBudgetYen =
    monthlyBudgetYen == null
      ? null
      : monthlyBudgetYen - actualPurchaseAmount;

  const monthOverMonthPercent =
    previousMonthAmount <= 0
      ? null
      : ((actualPurchaseAmount - previousMonthAmount) / previousMonthAmount) *
        100;

  const weekStart = getWeekStartFromDate(
    reference.toISOString().slice(0, 10),
  );
  const weekSpendYen = transactions
    .filter((tx) => {
      try {
        return getWeekStartFromDate(tx.purchasedAt.slice(0, 10)) === weekStart;
      } catch {
        return false;
      }
    })
    .reduce((sum, tx) => sum + foodAmount(tx, settings), 0);

  const totalMs = window.end.getTime() - window.start.getTime();
  const elapsedMs = Math.min(
    totalMs,
    Math.max(0, reference.getTime() - window.start.getTime()),
  );
  const monthElapsedPercent =
    totalMs > 0 ? Math.round((elapsedMs / totalMs) * 100) : 0;

  const budgetUsedPercent =
    monthlyBudgetYen != null && monthlyBudgetYen > 0
      ? Math.round((actualPurchaseAmount / monthlyBudgetYen) * 100)
      : null;

  const projectionSparse = monthTx.length < 3 || monthElapsedPercent < 10;
  const projectedMonthEndYen =
    projectionSparse || monthElapsedPercent <= 0
      ? null
      : Math.round(
          actualPurchaseAmount / (monthElapsedPercent / 100),
        );

  const storeMap = new Map<string, StoreAggregate>();
  const brandMap = new Map<string, StoreAggregate>();
  const storeRepo = getStoreRepository();
  for (const tx of monthTx) {
    const amount = foodAmount(tx, settings);
    const store = tx.storeId ? storeRepo.getById(tx.storeId) : null;
    const storeKey = tx.storeId || tx.storeName || "unknown";
    const brandName = store?.storeBrandName || tx.storeName || "未設定";
    const prev = storeMap.get(storeKey);
    if (prev) prev.amountYen += amount;
    else {
      storeMap.set(storeKey, {
        storeId: tx.storeId,
        storeName: tx.storeName || "未設定",
        brandName,
        amountYen: amount,
        percent: 0,
      });
    }
    const bPrev = brandMap.get(brandName);
    if (bPrev) bPrev.amountYen += amount;
    else {
      brandMap.set(brandName, {
        storeId: null,
        storeName: brandName,
        brandName,
        amountYen: amount,
        percent: 0,
      });
    }
  }
  const byStore = [...storeMap.values()]
    .map((row) => ({
      ...row,
      percent:
        actualPurchaseAmount > 0
          ? Math.round((row.amountYen / actualPurchaseAmount) * 100)
          : 0,
    }))
    .sort((a, b) => b.amountYen - a.amountYen);
  const byBrand = [...brandMap.values()]
    .map((row) => ({
      ...row,
      percent:
        actualPurchaseAmount > 0
          ? Math.round((row.amountYen / actualPurchaseAmount) * 100)
          : 0,
    }))
    .sort((a, b) => b.amountYen - a.amountYen);

  const catMap = new Map<FoodExpenseCategory, number>();
  for (const tx of monthTx) {
    if (tx.categoryBreakdown.length === 0) {
      catMap.set(
        "unclassified",
        (catMap.get("unclassified") ?? 0) + foodAmount(tx, settings),
      );
      continue;
    }
    for (const row of tx.categoryBreakdown) {
      if (!isCategoryCounted(row.category, row.excluded, settings)) continue;
      catMap.set(row.category, (catMap.get(row.category) ?? 0) + row.amountYen);
    }
  }
  const categoryTotal = [...catMap.values()].reduce((a, b) => a + b, 0);
  const byCategory = [...catMap.entries()]
    .map(([category, amountYen]) => ({
      category,
      label: FOOD_EXPENSE_CATEGORY_LABELS[category],
      amountYen,
      percent:
        categoryTotal > 0 ? Math.round((amountYen / categoryTotal) * 100) : 0,
    }))
    .sort((a, b) => b.amountYen - a.amountYen);

  const weekMap = new Map<string, number>();
  const dayMap = new Map<string, number>();
  for (const tx of monthTx) {
    const amount = foodAmount(tx, settings);
    const date = tx.purchasedAt.slice(0, 10);
    dayMap.set(date, (dayMap.get(date) ?? 0) + amount);
    try {
      const ws = getWeekStartFromDate(date);
      weekMap.set(ws, (weekMap.get(ws) ?? 0) + amount);
    } catch {
      // skip
    }
  }

  const amountOnlyCount = monthTx.filter(
    (tx) => tx.detailCompleteness === "amount_only",
  ).length;
  const partialCount = monthTx.filter(
    (tx) => tx.detailCompleteness === "partial_items",
  ).length;
  const fullCount = monthTx.filter(
    (tx) => tx.detailCompleteness === "full_items",
  ).length;
  const weightSum = monthTx.reduce(
    (sum, tx) => sum + completenessRank(tx.detailCompleteness),
    0,
  );
  const priceAnalysisCoveragePercent =
    monthTx.length === 0
      ? 0
      : Math.round((weightSum / (monthTx.length * 2)) * 100);

  const inventoryValue = estimateInventoryValue(
    actualPurchaseAmount,
    monthTx,
  );

  return {
    monthLabel: window.label,
    actualPurchaseAmount,
    monthlyBudgetYen,
    remainingBudgetYen,
    previousMonthAmount,
    monthOverMonthPercent,
    weekSpendYen,
    monthElapsedPercent,
    budgetUsedPercent,
    projectedMonthEndYen,
    projectionSparse,
    byStore,
    byBrand,
    byCategory,
    byWeek: [...weekMap.entries()]
      .map(([weekStartKey, amountYen]) => ({
        weekStart: weekStartKey,
        amountYen,
      }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    byDay: [...dayMap.entries()]
      .map(([date, amountYen]) => ({ date, amountYen }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    transactions: monthTx,
    detailCoverage: {
      amountOnlyCount,
      partialCount,
      fullCount,
      priceAnalysisCoveragePercent,
    },
    inventoryValue,
  };
}

function estimateInventoryValue(
  monthPurchaseYen: number,
  monthTx: FoodExpenseTransaction[],
): FoodExpenseReport["inventoryValue"] {
  const inventory = loadInventory();
  const prices = loadIngredientPrices();
  let valued = 0;
  let covered = 0;
  for (const item of inventory) {
    if (item.amount?.kind !== "quantity") continue;
    const grams = toGramsEquivalent(item.amount.value, item.unit);
    if (grams == null) continue;
    const recent = prices.find(
      (p) =>
        p.normalizedIngredientName ===
          item.name.trim().toLowerCase().replace(/\s+/g, " ") ||
        p.ingredientName === item.name,
    );
    if (!recent?.pricePer100g) continue;
    valued += (grams / 100) * recent.pricePer100g;
    covered += 1;
  }
  const quantityItems = inventory.filter((i) => i.amount?.kind === "quantity");
  const coveragePercent =
    quantityItems.length === 0
      ? 0
      : Math.round((covered / quantityItems.length) * 100);

  const fridgeYen = covered > 0 ? Math.round(valued) : null;
  // 粗い近似: 明細あり取引の一部を未使用とみなさない。カバーがあるときのみ参考表示
  const purchasedUnusedYen =
    fridgeYen != null && monthPurchaseYen > 0
      ? Math.min(fridgeYen, Math.round(monthPurchaseYen * 0.2))
      : null;
  const estimatedConsumedYen =
    purchasedUnusedYen != null
      ? Math.max(0, monthPurchaseYen - purchasedUnusedYen)
      : null;

  void monthTx;
  return {
    fridgeYen,
    coveragePercent,
    purchasedUnusedYen,
    estimatedConsumedYen,
  };
}
