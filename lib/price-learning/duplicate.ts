import { DUPLICATE_THRESHOLDS } from "@/lib/price-learning/thresholds";
import { normalizeStoreName } from "@/lib/stores/normalize-store-name";
import type { Receipt, ReceiptItem } from "@/types/receipt";

export type DuplicateKind = "exact_duplicate" | "probable_duplicate" | "new_receipt";

export type DuplicateCheckResult = {
  kind: DuplicateKind;
  matchedReceiptId: string | null;
  reason: string | null;
};

/**
 * 完全一致（fingerprint）または高確率重複を判定する。
 * 勝手に登録せず、呼び出し側で確認を出す。
 */
export function classifyReceiptDuplicate(input: {
  fingerprint: string;
  storeName: string;
  purchasedAt: string | null;
  totalAmountYen: number | null;
  itemNames: string[];
  itemPrices?: Array<{ name: string; totalPriceYen: number | null }>;
  existingReceipts: Receipt[];
  existingItems: ReceiptItem[];
}): DuplicateCheckResult {
  const exact = input.existingReceipts.find(
    (r) => r.receiptFingerprint === input.fingerprint,
  );
  if (exact) {
    return {
      kind: "exact_duplicate",
      matchedReceiptId: exact.id,
      reason: "同じレシートの指紋が一致しました",
    };
  }

  const dateKey = input.purchasedAt?.slice(0, 10) ?? "";
  const storeKey = normalizeStoreName(input.storeName);
  const names = new Set(
    input.itemNames.map((n) => n.trim().toLowerCase()).filter(Boolean),
  );

  for (const receipt of input.existingReceipts) {
    if (normalizeStoreName(receipt.storeName) !== storeKey) continue;
    const receiptDate = receipt.purchasedAt?.slice(0, 10) ?? "";
    if (dateKey && receiptDate && dateKey !== receiptDate) continue;

    const totalDiff =
      input.totalAmountYen != null && receipt.totalAmountYen != null
        ? Math.abs(input.totalAmountYen - receipt.totalAmountYen)
        : null;
    if (
      totalDiff != null &&
      totalDiff > DUPLICATE_THRESHOLDS.probableTotalDiffYen
    ) {
      continue;
    }

    const items = input.existingItems.filter((i) => i.receiptId === receipt.id);
    const existingNames = new Set(
      items.map((i) => i.rawProductName.trim().toLowerCase()),
    );
    if (names.size === 0 || existingNames.size === 0) continue;

    let overlap = 0;
    for (const name of names) {
      if (existingNames.has(name)) overlap += 1;
    }
    const ratio = overlap / Math.max(names.size, existingNames.size);
    if (ratio >= DUPLICATE_THRESHOLDS.probableItemOverlap) {
      return {
        kind: "probable_duplicate",
        matchedReceiptId: receipt.id,
        reason: "店舗・日付・商品内容がよく似ています",
      };
    }

    // 合計金額が同一で商品が半分以上一致
    if (
      input.totalAmountYen != null &&
      receipt.totalAmountYen === input.totalAmountYen &&
      ratio >= 0.5
    ) {
      return {
        kind: "probable_duplicate",
        matchedReceiptId: receipt.id,
        reason: "合計金額と商品が似ています",
      };
    }
  }

  return { kind: "new_receipt", matchedReceiptId: null, reason: null };
}
