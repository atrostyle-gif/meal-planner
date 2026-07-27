/**
 * レシート・店舗・価格の家族同期。
 * Supabase テーブル未整備時はエラーを返してローカルを維持する。
 */
import { loadIngredientPrices, replaceIngredientPrices } from "@/lib/food-budget/prices";
import {
  mappingFromRow,
  mappingToUpsert,
  priceFromRow,
  priceToUpsert,
  receiptFromRow,
  receiptItemFromRow,
  receiptItemToUpsert,
  receiptToUpsert,
  storeFromRow,
  storeToUpsert,
} from "@/lib/receipt/mappers";
import { getMappingRepository } from "@/lib/receipt/mapping-repository";
import { getReceiptRepository } from "@/lib/receipt/receipt-repository";
import { getStoreRepository } from "@/lib/stores/store-repository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { IngredientPriceRecord } from "@/types/ingredient-price";
import type { StoreProductMapping } from "@/types/store-product-mapping";

type Client = SupabaseClient<Database>;

export type ReceiptDomainSyncResult = {
  stores: number;
  receipts: number;
  receiptItems: number;
  mappings: number;
  prices: number;
  errors: string[];
};

function mergeMappings(
  local: StoreProductMapping[],
  remote: StoreProductMapping[],
): StoreProductMapping[] {
  const map = new Map<string, StoreProductMapping>();
  for (const item of [...remote, ...local]) {
    const key = `${item.storeName}::${item.normalizedRawProductName}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      continue;
    }
    const prevScore =
      (prev.matchSource === "user_confirmed" ? 100 : 0) +
      prev.correctionCount * 2 +
      prev.confirmationCount +
      new Date(prev.updatedAt).getTime() / 1e15;
    const nextScore =
      (item.matchSource === "user_confirmed" ? 100 : 0) +
      item.correctionCount * 2 +
      item.confirmationCount +
      new Date(item.updatedAt).getTime() / 1e15;
    map.set(key, nextScore >= prevScore ? item : prev);
  }
  return [...map.values()];
}

export async function pullReceiptDomain(
  client: Client,
  householdId: string,
): Promise<ReceiptDomainSyncResult> {
  const errors: string[] = [];
  const result: ReceiptDomainSyncResult = {
    stores: 0,
    receipts: 0,
    receiptItems: 0,
    mappings: 0,
    prices: 0,
    errors,
  };

  try {
    const storesRes = await client
      .from("stores")
      .select("*")
      .eq("household_id", householdId);
    if (storesRes.error) throw storesRes.error;
    const remoteStores = (storesRes.data ?? [])
      .map((row) => storeFromRow(row as unknown as Record<string, unknown>))
      .filter((s): s is NonNullable<typeof s> => s !== null);
    if (remoteStores.length > 0) {
      const repo = getStoreRepository();
      for (const store of remoteStores) {
        repo.upsert({ ...store, id: store.id });
      }
      result.stores = remoteStores.length;
    }
  } catch (error) {
    errors.push(
      `stores: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  try {
    const pricesRes = await client
      .from("ingredient_prices")
      .select("*")
      .eq("household_id", householdId);
    if (pricesRes.error) throw pricesRes.error;
    const remote = (pricesRes.data ?? [])
      .map((row) => priceFromRow(row as unknown as Record<string, unknown>))
      .filter((p): p is IngredientPriceRecord => p !== null);
    if (remote.length > 0) {
      const local = loadIngredientPrices();
      const byId = new Map<string, IngredientPriceRecord>();
      for (const item of [...local, ...remote]) {
        const prev = byId.get(item.id);
        if (!prev || (item.updatedAt ?? "") >= (prev.updatedAt ?? "")) {
          byId.set(item.id, item);
        }
      }
      replaceIngredientPrices([...byId.values()]);
      result.prices = byId.size;
    }
  } catch (error) {
    errors.push(
      `ingredient_prices: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  try {
    const mapRes = await client
      .from("store_product_mappings")
      .select("*")
      .eq("household_id", householdId);
    if (mapRes.error) throw mapRes.error;
    const remote = (mapRes.data ?? [])
      .map((row) => mappingFromRow(row as unknown as Record<string, unknown>))
      .filter((m): m is StoreProductMapping => m !== null);
    const merged = mergeMappings(getMappingRepository().list(), remote);
    getMappingRepository().replaceAll(merged);
    result.mappings = merged.length;
  } catch (error) {
    errors.push(
      `store_product_mappings: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  try {
    const [rRes, iRes] = await Promise.all([
      client.from("receipts").select("*").eq("household_id", householdId),
      client.from("receipt_items").select("*").eq("household_id", householdId),
    ]);
    if (rRes.error) throw rRes.error;
    if (iRes.error) throw iRes.error;
    const receipts = (rRes.data ?? [])
      .map((row) => receiptFromRow(row as unknown as Record<string, unknown>))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const items = (iRes.data ?? [])
      .map((row) =>
        receiptItemFromRow(row as unknown as Record<string, unknown>),
      )
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const localRepo = getReceiptRepository();
    const byFp = new Map(
      localRepo.listReceipts().map((r) => [r.receiptFingerprint, r]),
    );
    for (const remote of receipts) {
      if (!byFp.has(remote.receiptFingerprint)) {
        byFp.set(remote.receiptFingerprint, remote);
      }
    }
    localRepo.replaceAll(
      [...byFp.values()],
      [
        ...localRepo.listItems(),
        ...items.filter(
          (item) =>
            !localRepo.listItems().some((local) => local.id === item.id),
        ),
      ],
    );
    result.receipts = byFp.size;
    result.receiptItems = localRepo.listItems().length;
  } catch (error) {
    errors.push(
      `receipts: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  return result;
}

export async function pushReceiptDomain(
  client: Client,
  householdId: string,
): Promise<ReceiptDomainSyncResult> {
  const errors: string[] = [];
  const result: ReceiptDomainSyncResult = {
    stores: 0,
    receipts: 0,
    receiptItems: 0,
    mappings: 0,
    prices: 0,
    errors,
  };

  try {
    const stores = getStoreRepository().list();
    const { error } = await client
      .from("stores")
      .upsert(stores.map((s) => storeToUpsert(s, householdId)) as never);
    if (error) throw error;
    result.stores = stores.length;
  } catch (error) {
    errors.push(
      `stores: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  try {
    const prices = loadIngredientPrices();
    const { error } = await client
      .from("ingredient_prices")
      .upsert(prices.map((p) => priceToUpsert(p, householdId)) as never);
    if (error) throw error;
    result.prices = prices.length;
  } catch (error) {
    errors.push(
      `ingredient_prices: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  try {
    const mappings = getMappingRepository().list();
    const { error } = await client
      .from("store_product_mappings")
      .upsert(mappings.map((m) => mappingToUpsert(m, householdId)) as never);
    if (error) throw error;
    result.mappings = mappings.length;
  } catch (error) {
    errors.push(
      `store_product_mappings: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  try {
    const receipts = getReceiptRepository().listReceipts();
    const items = getReceiptRepository().listItems();
    const rErr = await client
      .from("receipts")
      .upsert(receipts.map((r) => receiptToUpsert(r, householdId)) as never);
    if (rErr.error) throw rErr.error;
    const iErr = await client
      .from("receipt_items")
      .upsert(items.map((i) => receiptItemToUpsert(i, householdId)) as never);
    if (iErr.error) throw iErr.error;
    result.receipts = receipts.length;
    result.receiptItems = items.length;
  } catch (error) {
    errors.push(
      `receipts: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  return result;
}
