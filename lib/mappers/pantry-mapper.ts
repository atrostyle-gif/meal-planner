import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import {
  DEFAULT_STOCK_STATUS,
  isIngredientType,
  isPantryIngredientType,
  isStockStatus,
} from "@/types/ingredient-meta";
import type { PantryStockItem } from "@/types/pantry-stock";

type PantryRow = Tables<"pantry_items">;

export function pantryFromRow(row: PantryRow): PantryStockItem | null {
  if (!isIngredientType(row.ingredient_type)) {
    return null;
  }
  if (!isPantryIngredientType(row.ingredient_type)) {
    return null;
  }
  return {
    key: row.key,
    displayName: row.display_name,
    ingredientType: row.ingredient_type,
    stockStatus: isStockStatus(row.stock_status)
      ? row.stock_status
      : DEFAULT_STOCK_STATUS,
    updatedAt: row.updated_at,
  };
}

export function pantryToUpsert(
  item: PantryStockItem,
  householdId: string,
  userId: string | null,
): TablesInsert<"pantry_items"> {
  return {
    household_id: householdId,
    key: item.key,
    display_name: item.displayName,
    ingredient_type: item.ingredientType,
    stock_status: item.stockStatus,
    updated_by: userId,
    updated_at: item.updatedAt,
  };
}
