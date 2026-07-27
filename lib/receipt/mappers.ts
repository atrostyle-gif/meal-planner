/**
 * camelCase ローカル型 ↔ snake_case Supabase 行
 */
import type { IngredientPriceRecord } from "@/types/ingredient-price";
import type { Receipt, ReceiptItem } from "@/types/receipt";
import type { Store } from "@/types/store";
import type { StoreProductMapping } from "@/types/store-product-mapping";
import { isMatchSource, normalizeMatchSource } from "@/types/store-product-mapping";
import { isStoreType } from "@/types/store";

type Json = unknown;

export function storeFromRow(row: Record<string, Json>): Store | null {
  if (typeof row.id !== "string" || typeof row.name !== "string") return null;
  const now = new Date().toISOString();
  return {
    id: row.id,
    name: row.name,
    normalizedName:
      typeof row.normalized_name === "string" ? row.normalized_name : "",
    aliases: Array.isArray(row.aliases)
      ? row.aliases.filter((a): a is string => typeof a === "string")
      : [],
    storeType: isStoreType(row.store_type) ? row.store_type : "supermarket",
    isPrimary: row.is_primary === true,
    prefersBulkPurchase: row.prefers_bulk_purchase === true,
    defaultPackSizeMultiplier:
      typeof row.default_pack_size_multiplier === "number"
        ? row.default_pack_size_multiplier
        : 1.5,
    storeBrandName:
      typeof row.store_brand_name === "string" ? row.store_brand_name : null,
    storeBranchName:
      typeof row.store_branch_name === "string" ? row.store_branch_name : null,
    notes: typeof row.notes === "string" ? row.notes : "",
    createdAt: typeof row.created_at === "string" ? row.created_at : now,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : now,
  };
}

export function storeToUpsert(store: Store, householdId: string) {
  return {
    id: store.id,
    household_id: householdId,
    name: store.name,
    normalized_name: store.normalizedName,
    aliases: store.aliases,
    store_type: store.storeType,
    is_primary: store.isPrimary,
    prefers_bulk_purchase: store.prefersBulkPurchase,
    default_pack_size_multiplier: store.defaultPackSizeMultiplier,
    store_brand_name: store.storeBrandName,
    store_branch_name: store.storeBranchName,
    notes: store.notes,
    created_at: store.createdAt,
    updated_at: store.updatedAt,
  };
}

export function receiptFromRow(row: Record<string, Json>): Receipt | null {
  if (
    typeof row.id !== "string" ||
    typeof row.receipt_fingerprint !== "string"
  ) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: row.id,
    storeId: typeof row.store_id === "string" ? row.store_id : null,
    storeName: typeof row.store_name === "string" ? row.store_name : "",
    purchasedAt: typeof row.purchased_at === "string" ? row.purchased_at : null,
    totalAmountYen:
      typeof row.total_amount_yen === "number" ? row.total_amount_yen : null,
    receiptFingerprint: row.receipt_fingerprint,
    keepImage: row.keep_image === true,
    confidence: typeof row.confidence === "number" ? row.confidence : null,
    warnings: Array.isArray(row.warnings)
      ? row.warnings.filter((w): w is string => typeof w === "string")
      : [],
    rawText: typeof row.raw_text === "string" ? row.raw_text : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : now,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : now,
  };
}

export function receiptToUpsert(receipt: Receipt, householdId: string) {
  return {
    id: receipt.id,
    household_id: householdId,
    store_id: receipt.storeId,
    store_name: receipt.storeName,
    purchased_at: receipt.purchasedAt,
    total_amount_yen: receipt.totalAmountYen,
    receipt_fingerprint: receipt.receiptFingerprint,
    keep_image: false,
    confidence: receipt.confidence,
    warnings: receipt.warnings,
    raw_text: null,
    created_at: receipt.createdAt,
    updated_at: receipt.updatedAt,
  };
}

export function receiptItemFromRow(row: Record<string, Json>): ReceiptItem | null {
  if (
    typeof row.id !== "string" ||
    typeof row.receipt_id !== "string" ||
    typeof row.raw_product_name !== "string"
  ) {
    return null;
  }
  return {
    id: row.id,
    receiptId: row.receipt_id,
    rawProductName: row.raw_product_name,
    normalizedIngredientName:
      typeof row.normalized_ingredient_name === "string"
        ? row.normalized_ingredient_name
        : "",
    ingredientName:
      typeof row.ingredient_name === "string" ? row.ingredient_name : "",
    quantity: typeof row.quantity === "number" ? row.quantity : null,
    unit: typeof row.unit === "string" ? row.unit : null,
    packageCount:
      typeof row.package_count === "number" ? row.package_count : null,
    packageQuantity:
      typeof row.package_quantity === "number" ? row.package_quantity : null,
    packageUnit:
      typeof row.package_unit === "string" ? row.package_unit : null,
    gramsEquivalent:
      typeof row.grams_equivalent === "number" ? row.grams_equivalent : null,
    unitPriceYen:
      typeof row.unit_price_yen === "number" ? row.unit_price_yen : null,
    totalPriceYen:
      typeof row.total_price_yen === "number" ? row.total_price_yen : null,
    discountYen:
      typeof row.discount_yen === "number" ? row.discount_yen : null,
    taxIncluded:
      typeof row.tax_included === "boolean" ? row.tax_included : null,
    confidence: typeof row.confidence === "number" ? row.confidence : null,
    priceRecordId:
      typeof row.price_record_id === "string" ? row.price_record_id : null,
  };
}

export function receiptItemToUpsert(item: ReceiptItem, householdId: string) {
  return {
    id: item.id,
    household_id: householdId,
    receipt_id: item.receiptId,
    raw_product_name: item.rawProductName,
    normalized_ingredient_name: item.normalizedIngredientName,
    ingredient_name: item.ingredientName,
    quantity: item.quantity,
    unit: item.unit,
    package_count: item.packageCount,
    package_quantity: item.packageQuantity,
    package_unit: item.packageUnit,
    grams_equivalent: item.gramsEquivalent,
    unit_price_yen: item.unitPriceYen,
    total_price_yen: item.totalPriceYen,
    discount_yen: item.discountYen,
    tax_included: item.taxIncluded,
    confidence: item.confidence,
    price_record_id: item.priceRecordId,
  };
}

export function mappingFromRow(
  row: Record<string, Json>,
): StoreProductMapping | null {
  if (
    typeof row.id !== "string" ||
    typeof row.raw_product_name !== "string" ||
    typeof row.normalized_ingredient_name !== "string"
  ) {
    return null;
  }
  const now = new Date().toISOString();
  const source = isMatchSource(row.match_source)
    ? normalizeMatchSource(row.match_source)
    : "unknown";
  return {
    id: row.id,
    storeId: typeof row.store_id === "string" ? row.store_id : null,
    storeName: typeof row.store_name === "string" ? row.store_name : "",
    rawProductName: row.raw_product_name,
    normalizedRawProductName:
      typeof row.normalized_raw_product_name === "string"
        ? row.normalized_raw_product_name
        : "",
    normalizedIngredientName: row.normalized_ingredient_name,
    foodCode: typeof row.food_code === "string" ? row.food_code : null,
    matchSource: source,
    confirmationCount:
      typeof row.confirmation_count === "number" ? row.confirmation_count : 0,
    correctionCount:
      typeof row.correction_count === "number" ? row.correction_count : 0,
    confidence: typeof row.confidence === "number" ? row.confidence : 0,
    firstSeenAt:
      typeof row.first_seen_at === "string" ? row.first_seen_at : now,
    lastSeenAt: typeof row.last_seen_at === "string" ? row.last_seen_at : now,
    createdBy: typeof row.created_by === "string" ? row.created_by : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : now,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : now,
  };
}

export function mappingToUpsert(
  mapping: StoreProductMapping,
  householdId: string,
) {
  return {
    id: mapping.id,
    household_id: householdId,
    store_id: mapping.storeId,
    store_name: mapping.storeName,
    raw_product_name: mapping.rawProductName,
    normalized_raw_product_name: mapping.normalizedRawProductName,
    normalized_ingredient_name: mapping.normalizedIngredientName,
    food_code: mapping.foodCode,
    match_source: mapping.matchSource,
    confirmation_count: mapping.confirmationCount,
    correction_count: mapping.correctionCount,
    confidence: mapping.confidence,
    first_seen_at: mapping.firstSeenAt,
    last_seen_at: mapping.lastSeenAt,
    created_by: mapping.createdBy,
    created_at: mapping.createdAt,
    updated_at: mapping.updatedAt,
  };
}

export function priceFromRow(
  row: Record<string, Json>,
): IngredientPriceRecord | null {
  if (
    typeof row.id !== "string" ||
    typeof row.ingredient_name !== "string" ||
    typeof row.purchase_price_yen !== "number"
  ) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: row.id,
    ingredientName: row.ingredient_name,
    normalizedIngredientName:
      typeof row.normalized_ingredient_name === "string"
        ? row.normalized_ingredient_name
        : row.ingredient_name,
    foodCode: typeof row.food_code === "string" ? row.food_code : null,
    storeId: typeof row.store_id === "string" ? row.store_id : null,
    storeBrandName:
      typeof row.store_brand_name === "string" ? row.store_brand_name : null,
    storeBranchName:
      typeof row.store_branch_name === "string" ? row.store_branch_name : null,
    storeName: typeof row.store_name === "string" ? row.store_name : "",
    purchasePriceYen: row.purchase_price_yen,
    originalPriceYen:
      typeof row.original_price_yen === "number" ? row.original_price_yen : null,
    packageQuantity:
      typeof row.package_quantity === "number" ? row.package_quantity : 1,
    packageCount:
      typeof row.package_count === "number" ? row.package_count : null,
    packageUnit:
      typeof row.package_unit === "string" ? row.package_unit : "",
    gramsEquivalent:
      typeof row.grams_equivalent === "number" ? row.grams_equivalent : null,
    unitCountEquivalent:
      typeof row.unit_count_equivalent === "number"
        ? row.unit_count_equivalent
        : null,
    pricePer100g:
      typeof row.price_per_100g === "number" ? row.price_per_100g : null,
    pricePerUnit:
      typeof row.price_per_unit === "number" ? row.price_per_unit : null,
    purchasedAt:
      typeof row.purchased_at === "string" ? row.purchased_at : now,
    isSalePrice: row.is_sale_price === true,
    memo: typeof row.memo === "string" ? row.memo : "",
    source: row.source === "receipt" ? "receipt" : "manual",
    receiptId: typeof row.receipt_id === "string" ? row.receipt_id : null,
    rawProductName:
      typeof row.raw_product_name === "string" ? row.raw_product_name : null,
    discountYen:
      typeof row.discount_yen === "number" ? row.discount_yen : null,
    confidence: typeof row.confidence === "number" ? row.confidence : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : now,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : now,
  };
}

export function priceToUpsert(
  price: IngredientPriceRecord,
  householdId: string,
) {
  return {
    id: price.id,
    household_id: householdId,
    ingredient_name: price.ingredientName,
    normalized_ingredient_name: price.normalizedIngredientName,
    food_code: price.foodCode,
    store_id: price.storeId,
    store_name: price.storeName,
    store_brand_name: price.storeBrandName,
    store_branch_name: price.storeBranchName,
    purchase_price_yen: price.purchasePriceYen,
    original_price_yen: price.originalPriceYen,
    package_quantity: price.packageQuantity,
    package_count: price.packageCount,
    package_unit: price.packageUnit,
    grams_equivalent: price.gramsEquivalent,
    unit_count_equivalent: price.unitCountEquivalent,
    price_per_100g: price.pricePer100g,
    price_per_unit: price.pricePerUnit,
    purchased_at: price.purchasedAt,
    is_sale_price: price.isSalePrice,
    memo: price.memo,
    source: price.source,
    receipt_id: price.receiptId,
    raw_product_name: price.rawProductName,
    discount_yen: price.discountYen,
    confidence: price.confidence,
    created_at: price.createdAt,
    updated_at: price.updatedAt,
  };
}
