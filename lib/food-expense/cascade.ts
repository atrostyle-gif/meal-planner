import { loadIngredientPrices, replaceIngredientPrices } from "@/lib/food-budget/prices";
import { removeExpenseByReceiptId } from "@/lib/food-expense/from-receipt";
import { getFoodExpenseRepository } from "@/lib/food-expense/repository";
import { getReceiptRepository } from "@/lib/receipt/receipt-repository";

export type ReceiptDeleteImpact = {
  receiptId: string;
  storeName: string;
  purchasedAt: string | null;
  totalAmountYen: number | null;
  receiptItemCount: number;
  priceRecordCount: number;
  expenseTransactionId: string | null;
  expenseAmountYen: number | null;
};

/** レシート削除前に影響範囲を集計 */
export function previewReceiptDeleteImpact(
  receiptId: string,
): ReceiptDeleteImpact | null {
  const receiptRepo = getReceiptRepository();
  const receipt = receiptRepo.listReceipts().find((r) => r.id === receiptId);
  if (!receipt) return null;

  const items = receiptRepo
    .listItems()
    .filter((item) => item.receiptId === receiptId);
  const prices = loadIngredientPrices().filter((p) => p.receiptId === receiptId);
  const expense = getFoodExpenseRepository().findByReceiptId(receiptId);

  return {
    receiptId,
    storeName: receipt.storeName,
    purchasedAt: receipt.purchasedAt,
    totalAmountYen: receipt.totalAmountYen,
    receiptItemCount: items.length,
    priceRecordCount: prices.length,
    expenseTransactionId: expense?.id ?? null,
    expenseAmountYen: expense?.totalAmountYen ?? null,
  };
}

/**
 * レシート・明細・価格履歴・食費取引をまとめて削除する。
 * 片方だけ残らないようにする。
 */
export function deleteReceiptCascade(receiptId: string): ReceiptDeleteImpact | null {
  const impact = previewReceiptDeleteImpact(receiptId);
  if (!impact) return null;

  const receiptRepo = getReceiptRepository();
  const receipts = receiptRepo
    .listReceipts()
    .filter((r) => r.id !== receiptId);
  const items = receiptRepo
    .listItems()
    .filter((item) => item.receiptId !== receiptId);
  receiptRepo.replaceAll(receipts, items);

  replaceIngredientPrices(
    loadIngredientPrices().filter((p) => p.receiptId !== receiptId),
  );
  removeExpenseByReceiptId(receiptId);

  return impact;
}

/** 手動支出削除前の影響（価格履歴は紐付けない） */
export function previewManualExpenseDeleteImpact(expenseId: string): {
  expenseId: string;
  storeName: string;
  totalAmountYen: number;
  source: string;
} | null {
  const tx = getFoodExpenseRepository().getById(expenseId);
  if (!tx || tx.source !== "manual") return null;
  return {
    expenseId: tx.id,
    storeName: tx.storeName,
    totalAmountYen: tx.totalAmountYen,
    source: tx.source,
  };
}

export function deleteManualExpense(expenseId: string): boolean {
  const repo = getFoodExpenseRepository();
  const tx = repo.getById(expenseId);
  if (!tx || tx.source !== "manual") return false;
  repo.remove(expenseId);
  return true;
}
