import { estimateIngredientPrice } from "@/lib/food-budget/prices";
import { analyzeIngredientPrice } from "@/lib/receipt/analytics";
import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import type { IngredientPriceRecord } from "@/types/ingredient-price";
import type { Store, WeekStorePlan } from "@/types/store";

export type StoreAssignReason =
  | "今週行く予定の店舗を優先"
  | "主な買い物先を優先"
  | "価格差が小さいため1店舗に集約"
  | "3品まとめて安いため他店を追加候補"
  | "大容量パックが必要なため主な店を推奨"
  | "価格未登録のため店舗未定"
  | "予定店舗の価格を優先";

export type IngredientStoreAssignment = {
  ingredientName: string;
  storeId: string | null;
  storeName: string | null;
  estimatedPriceYen: number | null;
  reasons: StoreAssignReason[];
  isReferenceOnly: boolean;
};

const SMALL_DIFF_YEN = 50;

/**
 * 最安値だけで決めず、予定店舗・主な店・店舗数上限を尊重する。
 */
export function assignStoresForShopping(input: {
  ingredientNames: string[];
  stores: Store[];
  weekPlan: WeekStorePlan;
  priceRecords: IngredientPriceRecord[];
}): IngredientStoreAssignment[] {
  const primary =
    input.stores.find((s) => s.id === input.weekPlan.primaryPlannedStoreId) ??
    input.stores.find((s) => s.isPrimary) ??
    null;
  const planned = input.stores.filter(
    (s) =>
      input.weekPlan.plannedStoreIds.includes(s.id) ||
      s.id === primary?.id,
  );
  const maxVisits = Math.max(1, input.weekPlan.maxStoreVisits);
  const allowMulti = input.weekPlan.allowMultiStoreShopping;

  const usedStoreIds = new Set<string>();
  if (primary) usedStoreIds.add(primary.id);

  return input.ingredientNames.map((name) => {
    const reasons: StoreAssignReason[] = [];
    const analysis = analyzeIngredientPrice(
      name,
      input.priceRecords,
      primary?.name,
    );

    const preferStore = planned[0] ?? primary;
    if (!preferStore) {
      return {
        ingredientName: name,
        storeId: null,
        storeName: null,
        estimatedPriceYen: null,
        reasons: ["価格未登録のため店舗未定"],
        isReferenceOnly: false,
      };
    }

    const preferEstimate = estimateIngredientPrice(
      name,
      input.priceRecords,
      preferStore.name,
    );

    // 予定店に価格があれば優先
    if (preferEstimate.source !== "none") {
      reasons.push("今週行く予定の店舗を優先");
      if (preferStore.isPrimary) reasons.push("主な買い物先を優先");
      usedStoreIds.add(preferStore.id);
      return {
        ingredientName: name,
        storeId: preferStore.id,
        storeName: preferStore.name,
        estimatedPriceYen: preferEstimate.estimatedPurchasePriceYen,
        reasons,
        isReferenceOnly: false,
      };
    }

    // 他店が安い場合でも、店舗数上限と価格差を見る
    const cheaper = analysis.byStore
      .filter((s) => !s.sparseData && s.latestPricePer100g != null)
      .sort(
        (a, b) =>
          (a.latestPricePer100g ?? Infinity) -
          (b.latestPricePer100g ?? Infinity),
      )[0];

    if (
      allowMulti &&
      cheaper &&
      preferEstimate.pricePer100g != null &&
      cheaper.latestPricePer100g != null &&
      preferEstimate.pricePer100g - cheaper.latestPricePer100g > SMALL_DIFF_YEN &&
      usedStoreIds.size < maxVisits
    ) {
      const store = input.stores.find((s) => s.name === cheaper.storeName);
      reasons.push("3品まとめて安いため他店を追加候補");
      return {
        ingredientName: name,
        storeId: store?.id ?? null,
        storeName: cheaper.storeName,
        estimatedPriceYen: null,
        reasons,
        isReferenceOnly: true,
      };
    }

    if (
      cheaper &&
      preferEstimate.pricePer100g != null &&
      cheaper.latestPricePer100g != null &&
      Math.abs(preferEstimate.pricePer100g - cheaper.latestPricePer100g) <=
        SMALL_DIFF_YEN
    ) {
      reasons.push("価格差が小さいため1店舗に集約");
    }

    reasons.push("予定店舗の価格を優先");
    if (preferEstimate.source === "none") {
      reasons.push("価格未登録のため店舗未定");
      return {
        ingredientName: name,
        storeId: null,
        storeName: null,
        estimatedPriceYen: null,
        reasons,
        isReferenceOnly: false,
      };
    }

    return {
      ingredientName: name,
      storeId: preferStore.id,
      storeName: preferStore.name,
      estimatedPriceYen: preferEstimate.estimatedPurchasePriceYen,
      reasons,
      isReferenceOnly: false,
    };
  });
}

export function groupAssignmentsByStore(
  assignments: IngredientStoreAssignment[],
): { storeName: string; items: IngredientStoreAssignment[] }[] {
  const map = new Map<string, IngredientStoreAssignment[]>();
  for (const item of assignments) {
    const key = item.storeName ?? "店舗未定";
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.entries()].map(([storeName, items]) => ({
    storeName,
    items,
  }));
}

export function normalizeNames(names: string[]): string[] {
  return [...new Set(names.map((n) => normalizeIngredientName(n)))];
}
