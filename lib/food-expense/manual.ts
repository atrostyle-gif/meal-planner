import {
  classifyFoodExpenseCategory,
  defaultFoodExpenseExcluded,
} from "@/lib/food-expense/classify";
import { getFoodExpenseRepository } from "@/lib/food-expense/repository";
import { addIngredientPrice } from "@/lib/food-budget/prices";
import { createInventoryItem } from "@/lib/inventory";
import { getStoreRepository } from "@/lib/stores/store-repository";
import { toGramsEquivalent } from "@/lib/food-budget/unit-convert";
import type {
  DetailCompleteness,
  FoodExpenseCategory,
  FoodExpenseLineInput,
  FoodExpenseTransaction,
  PaymentMethod,
} from "@/types/food-expense";

export type ManualExpenseInput = {
  purchasedAt: string;
  storeName: string;
  storeId?: string | null;
  totalAmountYen: number;
  category?: FoodExpenseCategory;
  paymentMethod?: PaymentMethod;
  memo?: string;
  householdId?: string;
  createdBy?: string | null;
  lines?: FoodExpenseLineInput[];
};

export type ManualExpensePreview = {
  foodExpenseTotalYen: number;
  priceHistoryCandidateCount: number;
  inventoryCandidateCount: number;
  detailCompleteness: DetailCompleteness;
  lineSumYen: number;
  amountMismatch: boolean;
};

export function previewManualExpense(
  input: ManualExpenseInput,
): ManualExpensePreview {
  const lines = input.lines ?? [];
  const lineSumYen = lines.reduce((sum, line) => sum + line.amountYen, 0);
  const foodLines = lines.filter((line) => {
    const category =
      line.category ?? classifyFoodExpenseCategory(line.name);
    const excluded =
      line.foodExpenseExcluded ?? defaultFoodExpenseExcluded(category);
    return !excluded;
  });
  const foodFromLines = foodLines.reduce((sum, line) => sum + line.amountYen, 0);

  let detailCompleteness: DetailCompleteness = "amount_only";
  if (lines.length > 0) {
    const withQty = lines.filter(
      (line) =>
        line.quantity != null &&
        Number.isFinite(line.quantity) &&
        (line.unit?.trim() || ""),
    );
    detailCompleteness =
      withQty.length === lines.length ? "full_items" : "partial_items";
  }

  const foodExpenseTotalYen =
    lines.length === 0 ? input.totalAmountYen : foodFromLines;

  return {
    foodExpenseTotalYen,
    priceHistoryCandidateCount: lines.filter(
      (line) =>
        line.registerPrice !== false &&
        line.quantity != null &&
        Number.isFinite(line.quantity) &&
        Boolean(line.unit?.trim()),
    ).length,
    inventoryCandidateCount: lines.filter((line) => line.addToInventory === true)
      .length,
    detailCompleteness,
    lineSumYen,
    amountMismatch:
      lines.length > 0 &&
      Math.abs(lineSumYen - input.totalAmountYen) > 1,
  };
}

/**
 * 手動支出登録。
 * 金額のみ: 取引だけ作成（価格履歴・在庫は作らない）。
 * 明細あり: 数量・単位があるものだけ価格履歴候補。在庫は明示ONのみ。
 */
export function createManualExpense(
  input: ManualExpenseInput,
): FoodExpenseTransaction {
  const preview = previewManualExpense(input);
  const storeRepo = getStoreRepository();
  let storeId = input.storeId ?? null;
  let storeName = input.storeName.trim() || "店舗未設定";
  if (!storeId && storeName) {
    const found = storeRepo.findByNameOrAlias(storeName);
    if (found) {
      storeId = found.id;
      storeName = found.name;
    }
  }

  const lines = input.lines ?? [];
  const breakdown =
    lines.length === 0
      ? [
          {
            category: input.category ?? ("unclassified" as const),
            amountYen: input.totalAmountYen,
            excluded: defaultFoodExpenseExcluded(
              input.category ?? "unclassified",
            ),
          },
        ]
      : (() => {
          const map = new Map<
            string,
            { category: FoodExpenseCategory; amountYen: number; excluded: boolean }
          >();
          for (const line of lines) {
            const category =
              line.category ?? classifyFoodExpenseCategory(line.name);
            const excluded =
              line.foodExpenseExcluded ?? defaultFoodExpenseExcluded(category);
            const key = `${category}:${excluded ? "x" : "i"}`;
            const prev = map.get(key);
            if (prev) prev.amountYen += line.amountYen;
            else map.set(key, { category, amountYen: line.amountYen, excluded });
          }
          return [...map.values()];
        })();

  const now = new Date().toISOString();
  const tx: FoodExpenseTransaction = {
    id: crypto.randomUUID(),
    householdId: input.householdId ?? "local",
    receiptId: null,
    storeId,
    storeName,
    purchasedAt: input.purchasedAt || now,
    subtotalYen: null,
    discountYen: null,
    taxYen: null,
    totalAmountYen: input.totalAmountYen,
    paymentMethod: input.paymentMethod ?? "unknown",
    categoryBreakdown: breakdown,
    source: "manual",
    detailCompleteness: preview.detailCompleteness,
    memo: input.memo?.trim() ?? "",
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const saved = getFoodExpenseRepository().upsert(tx);

  // 価格履歴: 数量・単位がある項目のみ。在庫は明示ONのみ
  for (const line of lines) {
    const hasQtyUnit =
      line.quantity != null &&
      Number.isFinite(line.quantity) &&
      Boolean(line.unit?.trim());
    if (line.registerPrice !== false && hasQtyUnit) {
      const grams = toGramsEquivalent(line.quantity!, line.unit!);
      addIngredientPrice({
        ingredientName: line.ingredientName?.trim() || line.name,
        storeName,
        storeId,
        purchasePriceYen: line.amountYen,
        packageQuantity: line.quantity!,
        packageUnit: line.unit!.trim(),
        gramsEquivalent: grams,
        purchasedAt: saved.purchasedAt,
        source: "manual",
        memo: "手動明細から登録",
      });
    }
    if (line.addToInventory === true && hasQtyUnit) {
      createInventoryItem({
        name: line.ingredientName?.trim() || line.name,
        amount: {
          kind: "quantity",
          value: line.quantity!,
        },
        unit: line.unit!.trim(),
        priority: false,
      });
    }
  }

  return saved;
}
