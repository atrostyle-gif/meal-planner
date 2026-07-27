import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadIngredientPrices } from "@/lib/food-budget/prices";
import { DEFAULT_FOOD_BUDGET_SETTINGS } from "@/types/food-budget";
import {
  deleteReceiptCascade,
  previewReceiptDeleteImpact,
} from "@/lib/food-expense/cascade";
import { classifyFoodExpenseCategory } from "@/lib/food-expense/classify";
import {
  createManualExpense,
  previewManualExpense,
} from "@/lib/food-expense/manual";
import {
  LocalFoodExpenseRepository,
  getFoodExpenseRepository,
  setFoodExpenseRepositoryForTest,
} from "@/lib/food-expense/repository";
import {
  buildFoodExpenseReport,
  foodAmount,
  getBudgetMonthWindow,
} from "@/lib/food-expense/report";
import {
  refreshExpenseFromReceiptItems,
  upsertExpenseFromReceipt,
} from "@/lib/food-expense/from-receipt";
import { buildReceiptConfirmState } from "@/lib/receipt/confirm";
import {
  LocalReceiptRepository,
  setReceiptRepositoryForTest,
} from "@/lib/receipt/receipt-repository";
import { saveConfirmedReceipt } from "@/lib/receipt/save";
import {
  LocalStoreProductMappingRepository,
  setMappingRepositoryForTest,
} from "@/lib/receipt/mapping-repository";
import {
  LocalStoreRepository,
  setStoreRepositoryForTest,
} from "@/lib/stores/store-repository";
import type { ReceiptDraft } from "@/types/receipt";
import type { FoodExpenseTransaction } from "@/types/food-expense";

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
  storeName: "ロピア寝屋川",
  storeBrandName: "ロピア",
  storeBranchName: "寝屋川",
  purchasedAt: "2026-07-20T00:00:00.000Z",
  totalAmountYen: 2500,
  items: [
    {
      rawName: "国産豚小間",
      quantity: 1,
      unit: "パック",
      packageCount: 1,
      packageQuantity: 1,
      packageUnit: "kg",
      gramsEquivalent: 1000,
      unitPriceYen: null,
      totalPriceYen: 1200,
      discountYen: 0,
      taxIncluded: true,
      confidence: 0.9,
    },
    {
      rawName: "洗剤",
      quantity: 1,
      unit: "本",
      packageCount: 1,
      packageQuantity: 1,
      packageUnit: "本",
      gramsEquivalent: null,
      unitPriceYen: null,
      totalPriceYen: 300,
      discountYen: 0,
      taxIncluded: true,
      confidence: 0.8,
    },
    {
      rawName: "謎の商品XYZ",
      quantity: 1,
      unit: "個",
      packageCount: 1,
      packageQuantity: 1,
      packageUnit: "個",
      gramsEquivalent: null,
      unitPriceYen: null,
      totalPriceYen: 1000,
      discountYen: 100,
      taxIncluded: true,
      confidence: 0.5,
    },
  ],
  rawText: null,
  confidence: 0.8,
  warnings: [],
};

describe("食費家計簿・レポート", () => {
  beforeEach(() => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", {
      localStorage: storage,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    });
    setReceiptRepositoryForTest(new LocalReceiptRepository());
    setStoreRepositoryForTest(new LocalStoreRepository());
    setMappingRepositoryForTest(new LocalStoreProductMappingRepository());
    setFoodExpenseRepositoryForTest(new LocalFoodExpenseRepository());
  });

  it("レシート確認時に食費取引が1件生成される", async () => {
    const state = await buildReceiptConfirmState(sampleDraft);
    state.storeAction = "create_new";
    const result = saveConfirmedReceipt(state);
    expect(result.expenseTransactionId).toBeTruthy();
    const list = getFoodExpenseRepository().list();
    expect(list).toHaveLength(1);
    expect(list[0]?.receiptId).toBe(result.receiptId);
    expect(list[0]?.totalAmountYen).toBe(2500);
    expect(list[0]?.source).toBe("receipt");
  });

  it("同一レシートで重複生成されない", async () => {
    const state = await buildReceiptConfirmState(sampleDraft);
    state.storeAction = "create_new";
    const first = saveConfirmedReceipt(state);
    expect(
      getFoodExpenseRepository().findByReceiptId(first.receiptId),
    ).toBeTruthy();
    // upsert を直接呼んでも id は同じ・件数は1のまま
    const again = upsertExpenseFromReceipt({
      receipt: {
        id: first.receiptId,
        storeId: null,
        storeName: "ロピア",
        purchasedAt: "2026-07-20T00:00:00.000Z",
        totalAmountYen: 2500,
        receiptFingerprint: "fp",
        keepImage: false,
        confidence: null,
        warnings: [],
        rawText: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      confirmItems: state.items,
    });
    expect(again.id).toBe(first.expenseTransactionId);
    expect(getFoodExpenseRepository().list()).toHaveLength(1);
  });

  it("支払額と使用原価を混同しない（actualPurchaseAmount）", async () => {
    const state = await buildReceiptConfirmState(sampleDraft);
    state.storeAction = "create_new";
    saveConfirmedReceipt(state);
    const report = buildFoodExpenseReport(
      new Date("2026-07-24T12:00:00"),
      {
        ...DEFAULT_FOOD_BUDGET_SETTINGS,
        monthlyFoodBudgetYen: 40000,
        monthlyBudgetStartDay: 1,
        includeHouseholdGoods: false,
      },
      getFoodExpenseRepository().list(),
    );
    // 洗剤除外後: 2500 - 300 = 2200（支払額ベース）
    expect(report.actualPurchaseAmount).toBe(2200);
  });

  it("日用品は初期除外で、未分類は0円扱いにしない", async () => {
    expect(classifyFoodExpenseCategory("洗剤")).toBe("household_mixed");
    const state = await buildReceiptConfirmState(sampleDraft);
    const detergent = state.items.find((i) => i.rawName === "洗剤");
    const unknown = state.items.find((i) => i.rawName.includes("謎"));
    expect(detergent?.foodExpenseExcluded).toBe(true);
    expect(unknown?.foodExpenseExcluded).toBe(false);
    state.storeAction = "create_new";
    saveConfirmedReceipt(state);
    const tx = getFoodExpenseRepository().list()[0];
    expect(tx).toBeTruthy();
    if (!tx) return;
    const detergentRow = tx.categoryBreakdown.find(
      (r) => r.category === "household_mixed",
    );
    expect(detergentRow?.excluded).toBe(true);
    expect(detergentRow?.amountYen).toBe(300);
    const unknownRow = tx.categoryBreakdown.find(
      (r) => r.category === "unclassified",
    );
    // 未分類は0円扱いや自動除外をしない
    expect(unknownRow?.amountYen).toBeGreaterThan(0);
    expect(unknownRow?.excluded).toBe(false);
  });

  it("店舗別・カテゴリ別・月別・週別に集計できる", async () => {
    createManualExpense({
      purchasedAt: "2026-07-10T12:00:00.000Z",
      storeName: "イオン",
      totalAmountYen: 9300,
      category: "vegetables",
    });
    createManualExpense({
      purchasedAt: "2026-07-12T12:00:00.000Z",
      storeName: "業務スーパー",
      totalAmountYen: 5600,
      category: "meat",
    });
    const state = await buildReceiptConfirmState(sampleDraft);
    state.storeAction = "create_new";
    saveConfirmedReceipt(state);

    const report = buildFoodExpenseReport(
      new Date("2026-07-24T12:00:00"),
      {
        ...DEFAULT_FOOD_BUDGET_SETTINGS,
        monthlyFoodBudgetYen: 50000,
        includeHouseholdGoods: false,
      },
      getFoodExpenseRepository().list(),
    );
    expect(report.byStore.length).toBeGreaterThanOrEqual(2);
    expect(report.byCategory.length).toBeGreaterThanOrEqual(1);
    expect(report.byWeek.length).toBeGreaterThanOrEqual(1);
    expect(report.byDay.length).toBeGreaterThanOrEqual(1);
    expect(report.actualPurchaseAmount).toBeGreaterThan(0);
  });

  it("割引・税・合計を保持する", async () => {
    const state = await buildReceiptConfirmState(sampleDraft);
    state.storeAction = "create_new";
    saveConfirmedReceipt(state);
    const tx = getFoodExpenseRepository().list()[0];
    expect(tx?.discountYen).toBe(100);
    expect(tx?.totalAmountYen).toBe(2500);
  });

  it("レシート修正時に取引も更新される", async () => {
    const state = await buildReceiptConfirmState(sampleDraft);
    state.storeAction = "create_new";
    const saved = saveConfirmedReceipt(state);
    const receiptRepo = new LocalReceiptRepository();
    setReceiptRepositoryForTest(receiptRepo);
    // 再取得（同じ storage）
    const receipt = receiptRepo
      .listReceipts()
      .find((r) => r.id === saved.receiptId);
    expect(receipt).toBeTruthy();
    if (!receipt) return;
    const items = receiptRepo
      .listItems()
      .filter((i) => i.receiptId === receipt.id);
    const updatedReceipt = { ...receipt, totalAmountYen: 2600 };
    receiptRepo.replaceAll(
      receiptRepo
        .listReceipts()
        .map((r) => (r.id === receipt.id ? updatedReceipt : r)),
      items,
    );
    const refreshed = refreshExpenseFromReceiptItems(updatedReceipt, items);
    expect(refreshed?.totalAmountYen).toBe(2600);
  });

  it("レシート削除時に取引・価格も削除される", async () => {
    const state = await buildReceiptConfirmState(sampleDraft);
    state.storeAction = "create_new";
    const saved = saveConfirmedReceipt(state);
    expect(loadIngredientPrices().length).toBeGreaterThan(0);
    const impact = previewReceiptDeleteImpact(saved.receiptId);
    expect(impact?.expenseTransactionId).toBeTruthy();
    expect(impact?.priceRecordCount).toBeGreaterThan(0);
    deleteReceiptCascade(saved.receiptId);
    expect(getFoodExpenseRepository().list()).toHaveLength(0);
    expect(loadIngredientPrices()).toHaveLength(0);
  });

  it("金額だけでも食費へ反映され、価格履歴は作らない", () => {
    const before = loadIngredientPrices().length;
    createManualExpense({
      purchasedAt: "2026-07-15T12:00:00.000Z",
      storeName: "八百屋",
      totalAmountYen: 800,
      category: "vegetables",
      paymentMethod: "cash",
      memo: "現金のみ",
    });
    const tx = getFoodExpenseRepository().list()[0];
    expect(tx?.detailCompleteness).toBe("amount_only");
    expect(tx?.totalAmountYen).toBe(800);
    expect(loadIngredientPrices().length).toBe(before);
    const report = buildFoodExpenseReport(
      new Date("2026-07-20"),
      DEFAULT_FOOD_BUDGET_SETTINGS,
      getFoodExpenseRepository().list(),
    );
    expect(report.actualPurchaseAmount).toBe(800);
  });

  it("商品・容量ありの場合だけ単価計算する", () => {
    const preview = previewManualExpense({
      purchasedAt: "2026-07-15T12:00:00.000Z",
      storeName: "市場",
      totalAmountYen: 1000,
      lines: [
        {
          name: "キャベツ",
          amountYen: 200,
          quantity: 1,
          unit: "玉",
        },
        {
          name: "ねぎ",
          amountYen: 100,
        },
      ],
    });
    expect(preview.priceHistoryCandidateCount).toBe(1);
    expect(preview.detailCompleteness).toBe("partial_items");
    expect(preview.inventoryCandidateCount).toBe(0);

    createManualExpense({
      purchasedAt: "2026-07-15T12:00:00.000Z",
      storeName: "市場",
      totalAmountYen: 1000,
      lines: [
        {
          name: "キャベツ",
          amountYen: 200,
          quantity: 500,
          unit: "g",
          addToInventory: false,
        },
        { name: "ねぎ", amountYen: 100 },
      ],
    });
    expect(loadIngredientPrices()).toHaveLength(1);
  });

  it("内訳合計と支払額が違う場合に警告する", () => {
    const preview = previewManualExpense({
      purchasedAt: "2026-07-15T12:00:00.000Z",
      storeName: "店",
      totalAmountYen: 1000,
      lines: [
        { name: "A", amountYen: 300 },
        { name: "B", amountYen: 400 },
      ],
    });
    expect(preview.amountMismatch).toBe(true);
  });

  it("月間予算進捗とデータ不足時の予測非断定", () => {
    const settings = {
      ...DEFAULT_FOOD_BUDGET_SETTINGS,
      monthlyFoodBudgetYen: 40000,
      monthlyBudgetStartDay: 1,
    };
    const sparse: FoodExpenseTransaction[] = [
      {
        id: "1",
        householdId: "local",
        receiptId: null,
        storeId: null,
        storeName: "店",
        purchasedAt: "2026-07-02T12:00:00.000Z",
        subtotalYen: null,
        discountYen: null,
        taxYen: null,
        totalAmountYen: 2000,
        paymentMethod: "cash",
        categoryBreakdown: [
          { category: "vegetables", amountYen: 2000, excluded: false },
        ],
        source: "manual",
        detailCompleteness: "amount_only",
        memo: "",
        createdBy: null,
        createdAt: "2026-07-02T12:00:00.000Z",
        updatedAt: "2026-07-02T12:00:00.000Z",
      },
    ];
    const report = buildFoodExpenseReport(
      new Date("2026-07-03T12:00:00"),
      settings,
      sparse,
    );
    expect(report.budgetUsedPercent).toBe(5);
    expect(report.projectionSparse).toBe(true);
    expect(report.projectedMonthEndYen).toBeNull();
  });

  it("detailCompleteness別のカバー率が正しい", () => {
    const txs: FoodExpenseTransaction[] = [
      makeTx("a", "amount_only", 1000),
      makeTx("b", "partial_items", 1000),
      makeTx("c", "full_items", 1000),
    ];
    const report = buildFoodExpenseReport(
      new Date("2026-07-20"),
      DEFAULT_FOOD_BUDGET_SETTINGS,
      txs,
    );
    // ranks 0+1+2 = 3 / (3*2) = 50%
    expect(report.detailCoverage.priceAnalysisCoveragePercent).toBe(50);
    expect(report.detailCoverage.amountOnlyCount).toBe(1);
  });

  it("在庫価値のカバー率を出せる（不明は推測しない）", () => {
    const report = buildFoodExpenseReport(
      new Date("2026-07-20"),
      DEFAULT_FOOD_BUDGET_SETTINGS,
      [],
    );
    expect(report.inventoryValue.coveragePercent).toBe(0);
    expect(report.inventoryValue.fridgeYen).toBeNull();
  });

  it("家族同期Repositoryの upsert / replaceAll が動く", () => {
    const repo = getFoodExpenseRepository();
    const tx = createManualExpense({
      purchasedAt: "2026-07-01T12:00:00.000Z",
      storeName: "店",
      totalAmountYen: 500,
    });
    repo.replaceAll([{ ...tx, totalAmountYen: 600 }]);
    expect(repo.list()[0]?.totalAmountYen).toBe(600);
    repo.remove(tx.id);
    expect(repo.list()).toHaveLength(0);
  });

  it("月ウィンドウ計算ができる", () => {
    const window = getBudgetMonthWindow(new Date("2026-07-15"), 1);
    expect(window.start.getMonth()).toBe(6);
    expect(window.end.getMonth()).toBe(7);
  });

  it("foodAmount は除外後の支払額を返す", () => {
    const tx: FoodExpenseTransaction = {
      id: "x",
      householdId: "local",
      receiptId: null,
      storeId: null,
      storeName: "店",
      purchasedAt: "2026-07-01T00:00:00.000Z",
      subtotalYen: null,
      discountYen: null,
      taxYen: null,
      totalAmountYen: 1000,
      paymentMethod: "cash",
      categoryBreakdown: [
        { category: "meat", amountYen: 700, excluded: false },
        { category: "household_mixed", amountYen: 300, excluded: true },
      ],
      source: "manual",
      detailCompleteness: "partial_items",
      memo: "",
      createdBy: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };
    expect(foodAmount(tx, DEFAULT_FOOD_BUDGET_SETTINGS)).toBe(700);
  });
});

function makeTx(
  id: string,
  completeness: FoodExpenseTransaction["detailCompleteness"],
  amount: number,
): FoodExpenseTransaction {
  return {
    id,
    householdId: "local",
    receiptId: null,
    storeId: null,
    storeName: "店",
    purchasedAt: "2026-07-10T12:00:00.000Z",
    subtotalYen: null,
    discountYen: null,
    taxYen: null,
    totalAmountYen: amount,
    paymentMethod: "cash",
    categoryBreakdown: [
      { category: "other", amountYen: amount, excluded: false },
    ],
    source: "manual",
    detailCompleteness: completeness,
    memo: "",
    createdBy: null,
    createdAt: "2026-07-10T12:00:00.000Z",
    updatedAt: "2026-07-10T12:00:00.000Z",
  };
}
