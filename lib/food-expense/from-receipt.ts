import {
  classifyFoodExpenseCategory,
  defaultFoodExpenseExcluded,
} from "@/lib/food-expense/classify";
import { getFoodExpenseRepository } from "@/lib/food-expense/repository";
import { netItemPriceYen } from "@/lib/receipt/confirm";
import type { FoodExpenseCategoryAmount, FoodExpenseTransaction } from "@/types/food-expense";
import type { Receipt, ReceiptItem } from "@/types/receipt";
import type { ReceiptConfirmItem } from "@/types/receipt";

function buildBreakdownFromConfirmItems(
  items: ReceiptConfirmItem[],
): FoodExpenseCategoryAmount[] {
  const map = new Map<string, FoodExpenseCategoryAmount>();
  for (const item of items) {
    if (!item.include) continue;
    const net = netItemPriceYen(item);
    if (net == null) continue;
    const category = classifyFoodExpenseCategory(
      item.ingredientName || item.rawName,
    );
    const excluded =
      item.foodExpenseExcluded ?? defaultFoodExpenseExcluded(category);
    const key = `${category}:${excluded ? "x" : "i"}`;
    const prev = map.get(key);
    if (prev) {
      prev.amountYen += net;
    } else {
      map.set(key, { category, amountYen: net, excluded });
    }
  }
  return [...map.values()];
}

function includedFoodTotal(breakdown: FoodExpenseCategoryAmount[]): number {
  return breakdown
    .filter((row) => !row.excluded)
    .reduce((sum, row) => sum + row.amountYen, 0);
}

/**
 * レシート確認完了時に食費取引を1件生成（同一receiptIdは重複しない）。
 */
export function upsertExpenseFromReceipt(input: {
  receipt: Receipt;
  confirmItems: ReceiptConfirmItem[];
  householdId?: string;
  createdBy?: string | null;
  paymentMethod?: FoodExpenseTransaction["paymentMethod"];
  subtotalYen?: number | null;
  discountYen?: number | null;
  taxYen?: number | null;
}): FoodExpenseTransaction {
  const repo = getFoodExpenseRepository();
  const existing = repo.findByReceiptId(input.receipt.id);
  const breakdown = buildBreakdownFromConfirmItems(input.confirmItems);
  const foodTotal = includedFoodTotal(breakdown);
  const totalAmountYen =
    input.receipt.totalAmountYen != null &&
    Number.isFinite(input.receipt.totalAmountYen)
      ? input.receipt.totalAmountYen
      : foodTotal;

  const itemDiscount =
    input.confirmItems.reduce(
      (sum, item) => sum + (item.discountYen ?? 0),
      0,
    ) || null;

  const now = new Date().toISOString();
  const tx: FoodExpenseTransaction = {
    id: existing?.id ?? crypto.randomUUID(),
    householdId: input.householdId ?? existing?.householdId ?? "local",
    receiptId: input.receipt.id,
    storeId: input.receipt.storeId,
    storeName: input.receipt.storeName,
    purchasedAt:
      input.receipt.purchasedAt ?? existing?.purchasedAt ?? now,
    subtotalYen: input.subtotalYen ?? existing?.subtotalYen ?? null,
    discountYen: input.discountYen ?? itemDiscount,
    taxYen: input.taxYen ?? existing?.taxYen ?? null,
    totalAmountYen,
    paymentMethod: input.paymentMethod ?? existing?.paymentMethod ?? "unknown",
    categoryBreakdown: breakdown,
    source: "receipt",
    detailCompleteness: "full_items",
    memo: existing?.memo ?? "",
    createdBy: input.createdBy ?? existing?.createdBy ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  return repo.upsert(tx);
}

/** レシート削除時に取引も削除 */
export function removeExpenseByReceiptId(receiptId: string): void {
  getFoodExpenseRepository().removeByReceiptId(receiptId);
}

/** レシート明細から再集計して更新 */
export function refreshExpenseFromReceiptItems(
  receipt: Receipt,
  items: ReceiptItem[],
): FoodExpenseTransaction | null {
  const repo = getFoodExpenseRepository();
  const existing = repo.findByReceiptId(receipt.id);
  if (!existing) return null;

  const confirmLike: ReceiptConfirmItem[] = items.map((item, index) => {
    const category = classifyFoodExpenseCategory(
      item.ingredientName || item.rawProductName,
    );
    return {
      rawName: item.rawProductName,
      quantity: item.quantity,
      unit: item.unit,
      packageCount: item.packageCount,
      packageQuantity: item.packageQuantity,
      packageUnit: item.packageUnit,
      gramsEquivalent: item.gramsEquivalent,
      unitPriceYen: item.unitPriceYen,
      totalPriceYen: item.totalPriceYen,
      discountYen: item.discountYen,
      taxIncluded: item.taxIncluded,
      confidence: item.confidence,
      warnings: [],
      key: `r-${index}`,
      ingredientName: item.ingredientName,
      normalizedIngredientName: item.normalizedIngredientName,
      foodCode: null,
      include: true,
      foodExpenseExcluded: defaultFoodExpenseExcluded(category),
      addToInventory: false,
      addToPriceHistory: true,
      mappingConfidence: null,
      mappingSource: null,
      needsReview: false,
      foodExpenseCategory: category,
    };
  });

  return upsertExpenseFromReceipt({
    receipt,
    confirmItems: confirmLike,
    householdId: existing.householdId,
    createdBy: existing.createdBy,
    paymentMethod: existing.paymentMethod,
  });
}
