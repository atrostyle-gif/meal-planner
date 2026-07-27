import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeIngredientPrices,
  assessPriceVsMedian,
  calculateBuyScore,
  calculatePriceMedian,
  calculateUnitPrice,
  classifyDataQuality,
  classifyReceiptDuplicate,
  computeNetPriceYen,
} from "@/lib/price-learning";
import { makePriceRecord } from "@/lib/price-learning/test-fixtures";
import { buildReceiptConfirmState } from "@/lib/receipt/confirm";
import {
  LocalStoreProductMappingRepository,
  setMappingRepositoryForTest,
} from "@/lib/receipt/mapping-repository";
import {
  MockReceiptImportProvider,
  parseReceiptDraftJson,
} from "@/lib/receipt/provider";
import {
  LocalReceiptRepository,
  setReceiptRepositoryForTest,
} from "@/lib/receipt/receipt-repository";
import { saveConfirmedReceipt } from "@/lib/receipt/save";
import { deleteReceiptCascade } from "@/lib/food-expense/cascade";
import { getFoodExpenseRepository } from "@/lib/food-expense/repository";
import { loadIngredientPrices } from "@/lib/food-budget/prices";
import {
  LocalStoreRepository,
  setStoreRepositoryForTest,
} from "@/lib/stores/store-repository";
import { resolveStoreMatch } from "@/lib/stores/resolve-store";
import { recordStoreMerge, listStoreMergeHistory } from "@/lib/stores/merge-history";
import type { ReceiptDraft } from "@/types/receipt";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

const sampleDraft: ReceiptDraft = {
  storeRawName: "食生活♡♡ロピア",
  storeName: "ロピア寝屋川島忠ホームズ店",
  storeBrandName: "ロピア",
  storeBranchName: "寝屋川島忠ホームズ店",
  purchasedAt: "2026-07-20T00:00:00.000Z",
  subtotalYen: 2200,
  discountYen: 20,
  taxYen: 200,
  totalAmountYen: 2380,
  paymentMethod: null,
  items: [
    {
      rawName: "国産豚小間切落し",
      quantity: 1,
      unit: "パック",
      packageCount: 1,
      packageQuantity: 1,
      packageUnit: "kg",
      gramsEquivalent: 1000,
      unitPriceYen: null,
      totalPriceYen: 1198,
      discountYen: 0,
      taxIncluded: true,
      confidence: 0.9,
      warnings: [],
    },
    {
      rawName: "特売たまご",
      quantity: 1,
      unit: "パック",
      packageCount: 1,
      packageQuantity: 10,
      packageUnit: "個",
      gramsEquivalent: null,
      unitPriceYen: null,
      totalPriceYen: 198,
      discountYen: 20,
      taxIncluded: true,
      confidence: 0.7,
      warnings: [],
    },
  ],
  rawText: null,
  confidence: 0.85,
  warnings: [],
};

describe("価格分析エンジン・レシート学習", () => {
  beforeEach(() => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", {
      localStorage: storage,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    });
    setStoreRepositoryForTest(new LocalStoreRepository());
    setMappingRepositoryForTest(new LocalStoreProductMappingRepository());
    setReceiptRepositoryForTest(new LocalReceiptRepository());
  });

  it("Zod: 不正JSONは空Draft + 警告", () => {
    const draft = parseReceiptDraftJson({ broken: true });
    expect(draft.items).toHaveLength(0);
    expect(draft.warnings.length).toBeGreaterThan(0);
  });

  it("nullを0円扱いしない", () => {
    expect(computeNetPriceYen(null, null)).toBeNull();
    expect(
      calculateUnitPrice({ purchasePriceYen: null }).pricePer100g,
    ).toBeNull();
  });

  it("100g単価・個数単価・割引後価格", () => {
    const per100 = calculateUnitPrice({
      purchasePriceYen: 1198,
      gramsEquivalent: 1000,
    });
    expect(Math.round(per100.pricePer100g ?? 0)).toBe(120);

    const perUnit = calculateUnitPrice({
      purchasePriceYen: 198,
      discountYen: 20,
      unitCountEquivalent: 10,
    });
    expect(perUnit.netPriceYen).toBe(178);
    expect(perUnit.pricePerUnit).toBe(17.8);
  });

  it("容量不明は100g単価を推測しない", () => {
    const result = calculateUnitPrice({
      purchasePriceYen: 300,
      gramsEquivalent: null,
    });
    expect(result.pricePer100g).toBeNull();
  });

  it("30/90日中央値・最安・最高・トレンド", () => {
    const now = Date.now();
    const records = [1, 2, 3, 4, 5].map((n) =>
      makePriceRecord({
        id: `p${n}`,
        ingredientName: "豚こま切れ",
        normalizedIngredientName: "豚こま切れ",
        purchasePriceYen: 1000 + n * 50,
        pricePer100g: 100 + n * 5,
        purchasedAt: new Date(now - n * 10 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    );
    const analysis = analyzeIngredientPrices("豚こま切れ", records);
    expect(analysis.medianPrice30Days).not.toBeNull();
    expect(analysis.medianPrice90Days).not.toBeNull();
    expect(analysis.lowestPrice90Days).not.toBeNull();
    expect(analysis.highestPrice90Days).not.toBeNull();
    expect(analysis.priceTrend).not.toBe("insufficient_data");
  });

  it("データ不足時は断定しない", () => {
    expect(classifyDataQuality(1)).toBe("reference_only");
    expect(assessPriceVsMedian(100, 120, 1)).toBe("insufficient_data");
    const sparse = analyzeIngredientPrices("にんじん", [
      makePriceRecord({
        id: "x",
        ingredientName: "にんじん",
        normalizedIngredientName: "にんじん",
        purchasePriceYen: 100,
        pricePer100g: 40,
        purchasedAt: new Date().toISOString(),
      }),
    ]);
    expect(sparse.priceAssessment).toBe("insufficient_data");
    expect(sparse.vsMedianPercent).toBeNull();
  });

  it("価格評価閾値（very_cheap〜very_expensive）", () => {
    expect(assessPriceVsMedian(80, 100, 5)).toBe("very_cheap");
    expect(assessPriceVsMedian(92, 100, 5)).toBe("cheap");
    expect(assessPriceVsMedian(100, 100, 5)).toBe("normal");
    expect(assessPriceVsMedian(110, 100, 5)).toBe("expensive");
    expect(assessPriceVsMedian(120, 100, 5)).toBe("very_expensive");
  });

  it("買い時スコア: 安いと上がり、在庫十分なら下がる", () => {
    const now = Date.now();
    const records = [1, 2, 3, 4].map((n) =>
      makePriceRecord({
        id: `b${n}`,
        ingredientName: "豚こま",
        normalizedIngredientName: "豚こま",
        purchasePriceYen: 1200,
        pricePer100g: n === 1 ? 110 : 125,
        purchasedAt: new Date(now - n * 5 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    );
    const buy = calculateBuyScore({
      ingredientName: "豚こま",
      priceRecords: records,
      plannedRecipeCount: 1,
    });
    expect(buy.stars).toBeGreaterThanOrEqual(2);

    const withStock = calculateBuyScore({
      ingredientName: "豚こま",
      priceRecords: records,
      plannedRecipeCount: 1,
      inventory: [
        {
          id: "inv1",
          name: "豚こま",
          amount: { kind: "quantity", value: 500, unitCode: "g" },
          unit: "g",
          priority: false,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    expect(withStock.score).toBeLessThan(buy.score);
    expect(withStock.reasons.some((r) => r.includes("在庫"))).toBe(true);
  });

  it("店舗alias統合履歴を優先し、未登録は確定しない", () => {
    const stores = new LocalStoreRepository();
    const base = stores.upsert({
      name: "我が家の店",
      storeBrandName: "我が家の店",
      isPrimary: true,
    });
    recordStoreMerge("レシート表記ABCマート寝屋川", base.id);
    const resolved = resolveStoreMatch({
      rawName: "レシート表記ABCマート寝屋川",
      stores: stores.list(),
      mergeHistory: listStoreMergeHistory(),
    });
    expect(resolved.store?.id).toBe(base.id);
    expect(resolved.matchSource).toBe("merge_history");

    const unknown = resolveStoreMatch({
      rawName: "未知のスーパーXYZ",
      stores: stores.list(),
      mergeHistory: [],
    });
    expect(unknown.store).toBeNull();
    expect(unknown.matchSource).toBe("unregistered");
  });

  it("確認前に保存されず、確認後に価格・食費・マッピングが一貫保存", async () => {
    expect(loadIngredientPrices()).toHaveLength(0);
    const state = await buildReceiptConfirmState(sampleDraft);
    expect(loadIngredientPrices()).toHaveLength(0);
    expect(getFoodExpenseRepository().list()).toHaveLength(0);
    state.storeAction = "create_new";
    const result = saveConfirmedReceipt(state);
    expect(result.skippedDuplicate).toBe(false);
    expect(loadIngredientPrices().length).toBe(result.savedPriceCount);
    expect(result.expenseTransactionId).not.toBeNull();
    expect(getFoodExpenseRepository().list()).toHaveLength(1);
    const mappings = new LocalStoreProductMappingRepository().list();
    expect(mappings.length).toBeGreaterThan(0);
  });

  it("exact / probable 重複を勝手に登録しない", async () => {
    const state = await buildReceiptConfirmState(sampleDraft, "img");
    state.storeAction = "create_new";
    saveConfirmedReceipt(state);
    const again = await buildReceiptConfirmState(sampleDraft, "img");
    expect(again.duplicateStatus).toBe("exact_duplicate");
    const skipped = saveConfirmedReceipt(again);
    expect(skipped.skippedDuplicate).toBe(true);

    const repo = new LocalReceiptRepository();
    const existing = repo.listReceipts()[0];
    expect(existing).toBeTruthy();
    const probable = classifyReceiptDuplicate({
      fingerprint: "different-fp",
      storeName: existing!.storeName,
      purchasedAt: existing!.purchasedAt,
      totalAmountYen: existing!.totalAmountYen,
      itemNames: repo.listItems().map((i) => i.rawProductName),
      existingReceipts: repo.listReceipts(),
      existingItems: repo.listItems(),
    });
    expect(probable.kind).toBe("probable_duplicate");
  });

  it("レシート削除で価格・食費は消すがマッピングは残す", async () => {
    const state = await buildReceiptConfirmState(sampleDraft);
    state.storeAction = "create_new";
    const saved = saveConfirmedReceipt(state);
    expect(loadIngredientPrices().length).toBeGreaterThan(0);
    const mappingCount = new LocalStoreProductMappingRepository().list().length;
    deleteReceiptCascade(saved.receiptId);
    expect(loadIngredientPrices()).toHaveLength(0);
    expect(getFoodExpenseRepository().list()).toHaveLength(0);
    expect(new LocalStoreProductMappingRepository().list().length).toBe(
      mappingCount,
    );
  });

  it("MockProviderはOpenAIを呼ばず構造化できる", async () => {
    const payload = Buffer.from(JSON.stringify(sampleDraft)).toString("base64");
    const draft = await new MockReceiptImportProvider().importFromImage([
      { order: 0, mimeType: "application/json", base64: payload },
    ]);
    expect(draft.storeBrandName).toBe("ロピア");
    expect(draft.items[0]?.gramsEquivalent).toBe(1000);
  });

  it("中央値計算", () => {
    expect(calculatePriceMedian([1, 3, 2])).toBe(2);
    expect(calculatePriceMedian([1, 2, 3, 4])).toBe(2.5);
    expect(calculatePriceMedian([])).toBeNull();
  });

  it("correctionCountが増え修正後が優先される", () => {
    const mapping = new LocalStoreProductMappingRepository();
    mapping.confirm({
      storeName: "ロピア",
      rawProductName: "国産豚小間切落し",
      ingredientName: "豚こま切れ",
    });
    mapping.confirm({
      storeName: "ロピア",
      rawProductName: "国産豚小間切落し",
      ingredientName: "豚こま",
      previousIngredientName: "豚こま切れ",
    });
    const resolved = mapping.resolve({
      storeName: "ロピア",
      rawProductName: "国産豚小間切落し",
    });
    expect(resolved.normalizedIngredientName).toBe("豚こま");
    expect(mapping.list()[0]?.correctionCount).toBeGreaterThan(0);
  });

  it("画像を既定で永続保存しない", async () => {
    const state = await buildReceiptConfirmState(sampleDraft, "secret-bytes");
    state.storeAction = "create_new";
    saveConfirmedReceipt(state);
    const receipts = new LocalReceiptRepository().listReceipts();
    expect(receipts[0]?.keepImage).toBe(false);
    expect(JSON.stringify(receipts)).not.toContain("secret-bytes");
  });
});
