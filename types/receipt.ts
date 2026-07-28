/** レシート取込の下書き（解析直後・未保存） */
export type ReceiptDraft = {
  /** レシート上の店舗名（生） */
  storeRawName: string | null;
  /** 互換・表示用。storeRawName または brand+branch */
  storeName: string | null;
  storeBrandName: string | null;
  storeBranchName: string | null;
  purchasedAt: string | null;
  subtotalYen: number | null;
  discountYen: number | null;
  taxYen: number | null;
  totalAmountYen: number | null;
  paymentMethod: string | null;
  /** ポイント（取得できれば） */
  points?: number | null;
  items: ReceiptItemDraft[];
  rawText: string | null;
  confidence: number | null;
  warnings: string[];
};

export type ReceiptItemDraft = {
  rawName: string;
  quantity: number | null;
  unit: string | null;
  packageCount: number | null;
  packageQuantity: number | null;
  packageUnit: string | null;
  gramsEquivalent: number | null;
  unitPriceYen: number | null;
  totalPriceYen: number | null;
  discountYen: number | null;
  taxIncluded: boolean | null;
  /** 軽減税率対象なら true */
  reducedTax?: boolean | null;
  confidence: number | null;
  warnings: string[];
};

/** 確認後に保存するレシート */
export type Receipt = {
  id: string;
  storeId: string | null;
  storeName: string;
  purchasedAt: string | null;
  totalAmountYen: number | null;
  receiptFingerprint: string;
  /** 画像は既定で保存しない */
  keepImage: boolean;
  confidence: number | null;
  warnings: string[];
  rawText: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReceiptItem = {
  id: string;
  receiptId: string;
  rawProductName: string;
  normalizedIngredientName: string;
  ingredientName: string;
  quantity: number | null;
  unit: string | null;
  packageCount: number | null;
  packageQuantity: number | null;
  packageUnit: string | null;
  gramsEquivalent: number | null;
  unitPriceYen: number | null;
  totalPriceYen: number | null;
  discountYen: number | null;
  taxIncluded: boolean | null;
  confidence: number | null;
  priceRecordId: string | null;
};

/** 確認画面で編集する行 */
export type ReceiptConfirmItem = ReceiptItemDraft & {
  key: string;
  ingredientName: string;
  normalizedIngredientName: string;
  foodCode: string | null;
  include: boolean;
  /** 食費家計簿から除外（日用品など。初期は日用品のみ true） */
  foodExpenseExcluded: boolean;
  /** 在庫へ追加（将来拡張。現状はフラグ保持） */
  addToInventory: boolean;
  /** 価格履歴へ追加 */
  addToPriceHistory: boolean;
  mappingConfidence: number | null;
  mappingSource: string | null;
  needsReview: boolean;
  foodExpenseCategory: string | null;
};

export type ReceiptDuplicateStatus =
  | "exact_duplicate"
  | "probable_duplicate"
  | "new_receipt";

export type ReceiptConfirmState = {
  draft: ReceiptDraft;
  storeId: string | null;
  storeName: string;
  storeAction: "link_existing" | "create_new" | "pending";
  purchasedAt: string | null;
  items: ReceiptConfirmItem[];
  fingerprint: string;
  duplicateReceiptId: string | null;
  duplicateStatus: ReceiptDuplicateStatus;
  duplicateReason: string | null;
};
