import { addIngredientPrice } from "@/lib/food-budget/prices";
import { calculateUnitPrice } from "@/lib/price-learning/unit-price";
import { upsertExpenseFromReceipt } from "@/lib/food-expense/from-receipt";
import { getWeekStartFromDate, getToday } from "@/lib/date";
import { netItemPriceYen } from "@/lib/receipt/confirm";
import { getMappingRepository } from "@/lib/receipt/mapping-repository";
import { getReceiptRepository } from "@/lib/receipt/receipt-repository";
import { recordStoreMerge } from "@/lib/stores/merge-history";
import { getStoreRepository } from "@/lib/stores/store-repository";
import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import { checkShoppingItemsMatchingNames } from "@/lib/shopping-lists";
import type { ReceiptConfirmState } from "@/types/receipt";
import type { ReceiptItem } from "@/types/receipt";

export type SaveReceiptResult = {
  receiptId: string;
  savedPriceCount: number;
  skippedDuplicate: boolean;
  expenseTransactionId: string | null;
  /** 買い物リストで自動チェックした件数 */
  checkedShoppingCount: number;
};

/**
 * 確認済みレシートのみ、価格・マッピング・食費を一貫して保存する。
 * 画像は既定で保存しない（keepImage=false）。
 */
export function saveConfirmedReceipt(
  state: ReceiptConfirmState,
  options?: { forceDuplicate?: boolean },
): SaveReceiptResult {
  const receiptRepo = getReceiptRepository();
  const storeRepo = getStoreRepository();
  const mappingRepo = getMappingRepository();

  const isDuplicate =
    state.duplicateStatus === "exact_duplicate" ||
    (!!state.duplicateReceiptId &&
      state.duplicateStatus !== "new_receipt" &&
      !options?.forceDuplicate);

  const existing =
    receiptRepo.findByFingerprint(state.fingerprint) ??
    (state.duplicateReceiptId
      ? receiptRepo
          .listReceipts()
          .find((r) => r.id === state.duplicateReceiptId) ?? null
      : null);

  if (existing && !options?.forceDuplicate) {
    return {
      receiptId: existing.id,
      savedPriceCount: 0,
      skippedDuplicate: true,
      expenseTransactionId: null,
      checkedShoppingCount: 0,
    };
  }

  // exact / probable でも force なしならスキップ（上で処理済み）
  void isDuplicate;

  let storeId = state.storeId;
  let storeName = state.storeName.trim() || "店舗未設定";
  let storeBrandName = state.draft.storeBrandName;
  let storeBranchName = state.draft.storeBranchName;

  if (state.storeAction === "create_new") {
    const created = storeRepo.upsert({
      name: storeName,
      storeBrandName: storeBrandName ?? storeName,
      storeBranchName: storeBranchName,
      isPrimary: storeRepo.list().length === 0,
      prefersBulkPurchase: /ロピア|業務スーパー|コストコ/.test(storeName),
    });
    storeId = created.id;
    storeName = created.name;
    storeBrandName = created.storeBrandName;
    storeBranchName = created.storeBranchName;
  } else if (state.storeAction === "link_existing" && storeId) {
    const linked = storeRepo.getById(storeId);
    if (linked) {
      const alias =
        state.draft.storeRawName?.trim() ||
        state.draft.storeName?.trim() ||
        "";
      if (
        alias &&
        normalizeLoose(alias) !== normalizeLoose(linked.name) &&
        !linked.aliases.includes(alias)
      ) {
        storeRepo.mergeAlias(linked.id, alias);
      }
      recordStoreMerge(alias || storeName, linked.id);
      storeName = linked.name;
      storeBrandName = linked.storeBrandName;
      storeBranchName = linked.storeBranchName;
    }
  } else if (!storeId) {
    // pending のまま保存された場合のみ新規（確認画面で意図的に進んだケース）
    const created = storeRepo.upsert({
      name: storeName,
      storeBrandName: storeBrandName ?? storeName,
      storeBranchName,
      isPrimary: storeRepo.list().length === 0,
    });
    storeId = created.id;
    storeName = created.name;
  }

  const included = state.items.filter((item) => item.include);
  const { receipt, items } = receiptRepo.saveConfirmed({
    receipt: {
      storeId,
      storeName,
      purchasedAt: state.purchasedAt,
      totalAmountYen: state.draft.totalAmountYen,
      receiptFingerprint: state.fingerprint,
      keepImage: false,
      confidence: state.draft.confidence,
      warnings: state.draft.warnings,
      rawText: null,
    },
    items: included.map((item) => ({
      rawProductName: item.rawName,
      normalizedIngredientName: normalizeIngredientName(item.ingredientName),
      ingredientName: item.ingredientName.trim(),
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
      priceRecordId: null,
    })),
  });

  let savedPriceCount = 0;
  const updatedItems: ReceiptItem[] = [];

  for (let i = 0; i < included.length; i += 1) {
    const item = included[i];
    const savedItem = items[i];
    if (!savedItem) continue;

    mappingRepo.confirm({
      storeName,
      storeId,
      rawProductName: item.rawName,
      ingredientName: item.ingredientName,
      foodCode: item.foodCode,
      previousIngredientName:
        item.mappingSource === "user_confirmed"
          ? null
          : item.normalizedIngredientName,
    });

    if (!item.addToPriceHistory) {
      updatedItems.push(savedItem);
      continue;
    }

    const net = netItemPriceYen(item);
    if (net == null || net <= 0) {
      updatedItems.push(savedItem);
      continue;
    }

    const packageQuantity =
      item.packageQuantity ?? item.quantity ?? item.packageCount ?? 1;
    const packageUnit = item.packageUnit ?? item.unit ?? "";
    const unitCalc = calculateUnitPrice({
      purchasePriceYen: item.totalPriceYen ?? item.unitPriceYen,
      discountYen: item.discountYen,
      gramsEquivalent: item.gramsEquivalent,
      packageQuantity,
      unitCountEquivalent:
        packageUnit.includes("個") || packageUnit === "個"
          ? packageQuantity
          : null,
    });

    const priceRecord = addIngredientPrice({
      ingredientName: item.ingredientName,
      storeName,
      storeId,
      storeBrandName,
      storeBranchName,
      foodCode: item.foodCode,
      purchasePriceYen: net,
      originalPriceYen: item.totalPriceYen,
      packageQuantity,
      packageCount: item.packageCount,
      packageUnit,
      gramsEquivalent: item.gramsEquivalent,
      unitCountEquivalent: unitCalc.pricePerUnit != null ? packageQuantity : null,
      purchasedAt: state.purchasedAt ?? new Date().toISOString(),
      isSalePrice: (item.discountYen ?? 0) > 0,
      source: "receipt",
      receiptId: receipt.id,
      rawProductName: item.rawName,
      discountYen: item.discountYen,
      confidence: item.confidence,
      memo: "",
    });
    savedPriceCount += 1;
    updatedItems.push({
      ...savedItem,
      priceRecordId: priceRecord.id,
    });
  }

  // priceRecordId を明細へ反映
  const otherItems = receiptRepo
    .listItems()
    .filter((i) => i.receiptId !== receipt.id);
  receiptRepo.replaceAll(receiptRepo.listReceipts(), [
    ...otherItems,
    ...updatedItems,
  ]);

  const expense = upsertExpenseFromReceipt({
    receipt,
    confirmItems: state.items,
    subtotalYen: state.draft.subtotalYen,
    discountYen: state.draft.discountYen,
    taxYen: state.draft.taxYen,
  });

  const purchasedAt = state.purchasedAt ?? getToday();
  const weekStart = getWeekStartFromDate(purchasedAt.slice(0, 10));
  const checkedShoppingCount = checkShoppingItemsMatchingNames(
    weekStart,
    included.map((item) => item.ingredientName),
  );

  return {
    receiptId: receipt.id,
    savedPriceCount,
    skippedDuplicate: false,
    expenseTransactionId: expense.id,
    checkedShoppingCount,
  };
}

function normalizeLoose(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}
