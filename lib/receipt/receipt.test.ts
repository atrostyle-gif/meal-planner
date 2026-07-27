import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeIngredientPrice,
  computeNetPriceYen,
} from "@/lib/receipt/analytics";
import { buildReceiptConfirmState, netItemPriceYen } from "@/lib/receipt/confirm";
import { buildReceiptFingerprint } from "@/lib/receipt/fingerprint";
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
import {
  LocalStoreRepository,
  setStoreRepositoryForTest,
} from "@/lib/stores/store-repository";
import {
  assignStoresForShopping,
} from "@/lib/stores/store-assign";
import { scoreBudgetSupport } from "@/lib/food-budget/score";
import {
  DEFAULT_FOOD_BUDGET_SETTINGS,
  DEFAULT_MEAL_PLAN_SCORE_WEIGHTS,
} from "@/types/food-budget";
import { LOPIA_STORE_PROFILE } from "@/types/store-profile";
import type { IngredientPriceRecord } from "@/types/ingredient-price";
import type { Recipe } from "@/types/recipe";
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
  storeRawName: "ロピア寝屋川島忠ホームズ店",
  storeName: "ロピア寝屋川島忠ホームズ店",
  storeBrandName: "ロピア",
  storeBranchName: "寝屋川島忠ホームズ店",
  purchasedAt: "2026-07-20T00:00:00.000Z",
  subtotalYen: null,
  discountYen: null,
  taxYen: null,
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

describe("レシート取込・価格学習", () => {
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

  it("レシート商品を抽出できる（Mock）", async () => {
    const payload = Buffer.from(JSON.stringify(sampleDraft)).toString("base64");
    const draft = await new MockReceiptImportProvider().importFromImage([
      { order: 0, mimeType: "application/json", base64: payload },
    ]);
    expect(draft.items).toHaveLength(2);
    expect(draft.items[0]?.rawName).toBe("国産豚小間切落し");
    expect(draft.totalAmountYen).toBe(2380);
  });

  it("null値を0円扱いしない", () => {
    const draft = parseReceiptDraftJson({
      storeName: "イオン",
      purchasedAt: null,
      totalAmountYen: null,
      items: [
        {
          rawName: "バジル",
          quantity: null,
          unit: null,
          packageCount: null,
          packageQuantity: null,
          packageUnit: null,
          gramsEquivalent: null,
          unitPriceYen: null,
          totalPriceYen: null,
          discountYen: null,
          taxIncluded: null,
          confidence: null,
          warnings: [],
        },
      ],
      rawText: null,
      confidence: null,
      warnings: [],
    });
    expect(draft.totalAmountYen).toBeNull();
    expect(draft.items[0]?.totalPriceYen).toBeNull();
    expect(computeNetPriceYen(null, null)).toBeNull();
  });

  it("確認前に価格履歴へ保存されない / 確認後に保存される", async () => {
    const { loadIngredientPrices } = await import("@/lib/food-budget/prices");
    expect(loadIngredientPrices()).toHaveLength(0);
    const state = await buildReceiptConfirmState(sampleDraft);
    expect(loadIngredientPrices()).toHaveLength(0);
    state.storeAction = "create_new";
    const result = saveConfirmedReceipt(state);
    expect(result.skippedDuplicate).toBe(false);
    expect(result.savedPriceCount).toBeGreaterThan(0);
    expect(loadIngredientPrices().length).toBe(result.savedPriceCount);
  });

  it("ユーザー確認済みマッピングが次回優先され、修正が学習される", async () => {
    const mapping = new LocalStoreProductMappingRepository();
    setMappingRepositoryForTest(mapping);
    mapping.confirm({
      storeName: "ロピア",
      rawProductName: "国産豚小間切落し",
      ingredientName: "豚こま切れ",
    });
    const first = mapping.resolve({
      storeName: "ロピア",
      rawProductName: "国産豚小間切落し",
    });
    expect(first.matchSource).toBe("user_confirmed");
    expect(first.normalizedIngredientName).toBe("豚こま切れ");

    mapping.confirm({
      storeName: "ロピア",
      rawProductName: "国産豚小間切落し",
      ingredientName: "豚こま",
      previousIngredientName: "豚こま切れ",
    });
    const second = mapping.resolve({
      storeName: "ロピア",
      rawProductName: "国産豚小間切落し",
    });
    expect(second.normalizedIngredientName).toBe("豚こま");
    const stored = mapping.list()[0];
    expect(stored?.correctionCount).toBeGreaterThan(0);
  });

  it("店舗別に同じ商品名を別学習できる", () => {
    const mapping = new LocalStoreProductMappingRepository();
    mapping.confirm({
      storeName: "ロピア",
      storeId: "s1",
      rawProductName: "豚切落し",
      ingredientName: "豚こま切れ",
    });
    mapping.confirm({
      storeName: "イオン",
      storeId: "s2",
      rawProductName: "豚切落し",
      ingredientName: "豚こま",
    });
    expect(
      mapping.resolve({
        storeName: "ロピア",
        storeId: "s1",
        rawProductName: "豚切落し",
      }).normalizedIngredientName,
    ).toBe("豚こま切れ");
    expect(
      mapping.resolve({
        storeName: "イオン",
        storeId: "s2",
        rawProductName: "豚切落し",
      }).normalizedIngredientName,
    ).toBe("豚こま");
  });

  it("同一レシートを重複登録しない", async () => {
    const state = await buildReceiptConfirmState(sampleDraft, "img-hash");
    state.storeAction = "create_new";
    const first = saveConfirmedReceipt(state);
    expect(first.skippedDuplicate).toBe(false);
    const second = saveConfirmedReceipt(state);
    expect(second.skippedDuplicate).toBe(true);
  });

  it("100g単価と割引後価格を計算できる", async () => {
    const state = await buildReceiptConfirmState(sampleDraft);
    const pork = state.items[0];
    const egg = state.items[1];
    expect(pork).toBeTruthy();
    expect(egg).toBeTruthy();
    if (!pork || !egg) return;
    expect(netItemPriceYen(egg)).toBe(178);
    const per100 = ((pork.totalPriceYen ?? 0) / (pork.gramsEquivalent ?? 1)) * 100;
    expect(Math.round(per100)).toBe(120);
  });

  it("直近・30/90日中央値と安い判定、データ不足警告", () => {
    const now = Date.now();
    const records: IngredientPriceRecord[] = [1, 2, 3, 4].map((n) => ({
      id: `p${n}`,
      ingredientName: "豚こま切れ",
      normalizedIngredientName: "豚こま切れ",
      storeId: "s1",
      storeName: "ロピア",
      purchasePriceYen: 1000 + n * 50,
      packageQuantity: 1,
      packageUnit: "kg",
      gramsEquivalent: 1000,
      pricePer100g: 100 + n * 5,
      purchasedAt: new Date(now - n * 10 * 24 * 60 * 60 * 1000).toISOString(),
      isSalePrice: false,
      memo: "",
      source: "receipt" as const,
      receiptId: null,
      rawProductName: "国産豚小間切落し",
      discountYen: null,
      confidence: 0.9,
    }));
    const analysis = analyzeIngredientPrice("豚こま切れ", records, "ロピア");
    expect(analysis.sampleCount).toBe(4);
    expect(analysis.sparseData).toBe(false);
    expect(analysis.medianPrice90Days).not.toBeNull();
    expect(analysis.latestPricePer100g).toBe(105);

    const sparse = analyzeIngredientPrice("にんじん", [
      {
        ...records[0],
        id: "x",
        ingredientName: "にんじん",
        normalizedIngredientName: "にんじん",
        pricePer100g: 40,
      },
    ]);
    expect(sparse.sparseData).toBe(true);
    expect(sparse.vsMedianPercent).toBeNull();
  });

  it("店舗aliasを既存店舗へ統合できる", () => {
    const stores = new LocalStoreRepository();
    const base = stores.upsert({
      name: "ロピア",
      isPrimary: true,
      storeBrandName: "ロピア",
    });
    stores.mergeAlias(base.id, "食生活♡♡ロピア");
    const found = stores.findByNameOrAlias("食生活♡♡ロピア");
    expect(found?.id).toBe(base.id);
  });

  it("未登録店舗を確認前に勝手に登録しない", async () => {
    const stores = new LocalStoreRepository();
    setStoreRepositoryForTest(stores);
    expect(stores.list()).toHaveLength(0);
    await buildReceiptConfirmState(sampleDraft);
    expect(stores.list()).toHaveLength(0);
  });

  it("主な店・予定店を優先し、価格差が小さいと店舗を増やさない", () => {
    const stores = new LocalStoreRepository();
    const lopia = stores.upsert({
      name: "ロピア",
      isPrimary: true,
      prefersBulkPurchase: true,
    });
    const aeon = stores.upsert({ name: "イオン", isPrimary: false });
    const records: IngredientPriceRecord[] = [
      {
        id: "1",
        ingredientName: "豚こま",
        normalizedIngredientName: "豚こま",
        storeId: lopia.id,
        storeName: "ロピア",
        purchasePriceYen: 1200,
        packageQuantity: 1,
        packageUnit: "kg",
        gramsEquivalent: 1000,
        pricePer100g: 120,
        purchasedAt: "2026-07-20T00:00:00.000Z",
        isSalePrice: false,
        memo: "",
        source: "receipt",
        receiptId: null,
        rawProductName: null,
        discountYen: null,
        confidence: null,
      },
      {
        id: "2",
        ingredientName: "豚こま",
        normalizedIngredientName: "豚こま",
        storeId: aeon.id,
        storeName: "イオン",
        purchasePriceYen: 1250,
        packageQuantity: 1,
        packageUnit: "kg",
        gramsEquivalent: 1000,
        pricePer100g: 125,
        purchasedAt: "2026-07-18T00:00:00.000Z",
        isSalePrice: false,
        memo: "",
        source: "receipt",
        receiptId: null,
        rawProductName: null,
        discountYen: null,
        confidence: null,
      },
    ];
    const assigned = assignStoresForShopping({
      ingredientNames: ["豚こま"],
      stores: stores.list(),
      weekPlan: {
        weekStart: "2026-07-20",
        plannedStoreIds: [lopia.id],
        primaryPlannedStoreId: lopia.id,
        allowMultiStoreShopping: true,
        maxStoreVisits: 1,
      },
      priceRecords: records,
    });
    expect(assigned[0]?.storeName).toBe("ロピア");
    expect(
      assigned[0]?.reasons.some((r) => r.includes("予定") || r.includes("主な")),
    ).toBe(true);
  });

  it("価格履歴が献立スコアへ反映される", () => {
    const recipe: Recipe = {
      id: "r1",
      name: "生姜焼き",
      category: "和食",
      course: "主菜",
      servings: 2,
      cookingTimeMinutes: 20,
      ingredients: [
        {
          id: "i1",
          name: "豚こま",
          quantity: 300,
          unit: "g",
          note: "",
          ingredientType: "normal",
        },
      ],
      steps: [{ id: "s1", order: 1, text: "焼く" }],
      tags: [],
      memo: "",
      favoriteScore: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };
    const prices: IngredientPriceRecord[] = [
      {
        id: "p1",
        ingredientName: "豚こま",
        normalizedIngredientName: "豚こま",
        storeId: null,
        storeName: "ロピア",
        purchasePriceYen: 1100,
        packageQuantity: 1,
        packageUnit: "kg",
        gramsEquivalent: 1000,
        pricePer100g: 110,
        purchasedAt: new Date().toISOString(),
        isSalePrice: true,
        memo: "",
        source: "receipt",
        receiptId: "r",
        rawProductName: "国産豚小間切落し",
        discountYen: 100,
        confidence: 0.9,
      },
    ];
    const scored = scoreBudgetSupport(recipe, {
      settings: {
        ...DEFAULT_FOOD_BUDGET_SETTINGS,
        primaryStoreName: "ロピア",
        scoreWeights: { ...DEFAULT_MEAL_PLAN_SCORE_WEIGHTS },
        updatedAt: "",
      },
      store: LOPIA_STORE_PROFILE,
      priceRecords: prices,
      inventory: [],
      selectedRecipes: [],
      weeklyFoodBudgetYen: 7000,
      runningPurchaseCostYen: 0,
    });
    expect(
      scored.badges.some(
        (b) => b === "ロピアで購入済み" || b === "購入済み食材",
      ),
    ).toBe(true);
  });

  it("解析画像を既定で永続保存しない", async () => {
    const state = await buildReceiptConfirmState(sampleDraft, "secret-image");
    state.storeAction = "create_new";
    saveConfirmedReceipt(state);
    const receipts = new LocalReceiptRepository().listReceipts();
    expect(receipts[0]?.keepImage).toBe(false);
    expect(JSON.stringify(receipts)).not.toContain("secret-image");
  });

  it("フィンガープリントが安定している", async () => {
    const a = await buildReceiptFingerprint({
      storeName: "ロピア",
      purchasedAt: "2026-07-20",
      totalAmountYen: 1000,
      itemNames: ["A", "B"],
    });
    const b = await buildReceiptFingerprint({
      storeName: "ロピア",
      purchasedAt: "2026-07-20",
      totalAmountYen: 1000,
      itemNames: ["B", "A"],
    });
    expect(a).toBe(b);
  });
});
