import {
  classifyFoodExpenseCategory,
  defaultFoodExpenseExcluded,
} from "@/lib/food-expense/classify";
import { classifyReceiptDuplicate } from "@/lib/price-learning/duplicate";
import { computeNetPriceYen } from "@/lib/price-learning/unit-price";
import { buildReceiptFingerprint } from "@/lib/receipt/fingerprint";
import { getMappingRepository } from "@/lib/receipt/mapping-repository";
import { getReceiptRepository } from "@/lib/receipt/receipt-repository";
import { toGramsEquivalent } from "@/lib/food-budget/unit-convert";
import { listStoreMergeHistory } from "@/lib/stores/merge-history";
import { resolveStoreMatch } from "@/lib/stores/resolve-store";
import { getStoreRepository } from "@/lib/stores/store-repository";
import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import type {
  ReceiptConfirmItem,
  ReceiptConfirmState,
  ReceiptDraft,
} from "@/types/receipt";

export async function buildReceiptConfirmState(
  draft: ReceiptDraft,
  imageBase64?: string | null,
): Promise<ReceiptConfirmState> {
  const storeRepo = getStoreRepository();
  const mappingRepo = getMappingRepository();
  const receiptRepo = getReceiptRepository();

  const storeRaw =
    draft.storeRawName?.trim() ||
    draft.storeName?.trim() ||
    "";
  const storeName = storeRaw || "店舗未設定";

  const resolvedStore = resolveStoreMatch({
    rawName: storeRaw || null,
    brandName: draft.storeBrandName,
    branchName: draft.storeBranchName,
    stores: storeRepo.list(),
    mergeHistory: listStoreMergeHistory(),
  });
  const matchedStore = resolvedStore.store;

  const items: ReceiptConfirmItem[] = draft.items.map((item, index) => {
    const resolved = mappingRepo.resolve({
      storeName,
      storeId: matchedStore?.id,
      rawProductName: item.rawName,
    });
    const grams =
      item.gramsEquivalent ??
      toGramsEquivalent(
        item.packageQuantity ?? item.quantity,
        item.packageUnit ?? item.unit ?? "",
      );
    const warnings: string[] = [...(item.warnings ?? [])];
    if (item.totalPriceYen == null && item.unitPriceYen == null) {
      warnings.push("価格が読み取れませんでした");
    }
    if (resolved.needsReview) {
      warnings.push("標準食材名の確認が必要です");
    }
    if ((item.confidence ?? 1) < 0.5) {
      warnings.push("認識信頼度が低めです");
    }
    const category = classifyFoodExpenseCategory(
      resolved.ingredientName || item.rawName,
    );
    return {
      ...item,
      warnings,
      key: `item-${index}-${item.rawName}`,
      ingredientName: resolved.ingredientName,
      normalizedIngredientName: resolved.normalizedIngredientName,
      foodCode: resolved.foodCode,
      include: item.totalPriceYen != null || item.unitPriceYen != null,
      foodExpenseExcluded: defaultFoodExpenseExcluded(category),
      addToInventory: false,
      addToPriceHistory: true,
      mappingConfidence: resolved.confidence,
      mappingSource: resolved.matchSource,
      needsReview: resolved.needsReview || warnings.length > 0,
      foodExpenseCategory: category,
      gramsEquivalent: grams,
    };
  });

  const fingerprint = await buildReceiptFingerprint({
    storeName,
    purchasedAt: draft.purchasedAt,
    totalAmountYen: draft.totalAmountYen,
    itemNames: draft.items.map((i) => i.rawName),
    itemPrices: draft.items.map((i) => ({
      name: i.rawName,
      totalPriceYen: i.totalPriceYen,
    })),
    imageBase64,
  });

  const dup = classifyReceiptDuplicate({
    fingerprint,
    storeName,
    purchasedAt: draft.purchasedAt,
    totalAmountYen: draft.totalAmountYen,
    itemNames: draft.items.map((i) => i.rawName),
    existingReceipts: receiptRepo.listReceipts(),
    existingItems: receiptRepo.listItems(),
  });

  return {
    draft,
    storeId: matchedStore?.id ?? null,
    storeName,
    storeAction: matchedStore ? "link_existing" : "pending",
    purchasedAt: draft.purchasedAt,
    items,
    fingerprint,
    duplicateReceiptId: dup.matchedReceiptId,
    duplicateStatus: dup.kind,
    duplicateReason: dup.reason,
  };
}

export function netItemPriceYen(item: ReceiptConfirmItem): number | null {
  const total = item.totalPriceYen ?? item.unitPriceYen;
  return computeNetPriceYen(total, item.discountYen);
}

export function unitPriceDisplay(item: ReceiptConfirmItem): string {
  const net = netItemPriceYen(item);
  const grams = item.gramsEquivalent;
  if (net != null && grams != null && grams > 0) {
    const per100 = (net / grams) * 100;
    return `${Math.round(per100 * 10) / 10}円／100g`;
  }
  if (net != null && (item.packageQuantity ?? item.quantity) === 1) {
    return `${Math.round(net)}円／1個`;
  }
  if (net != null) return `${Math.round(net)}円`;
  return "価格未登録";
}

export { normalizeIngredientName };
