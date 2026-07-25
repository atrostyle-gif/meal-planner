import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import type { FoodAliasMapping } from "@/types/food-master";

type Row = Tables<"food_alias_mappings">;

export function foodAliasFromRow(row: Row): FoodAliasMapping {
  return {
    id: row.id, householdId: row.household_id, aliasName: row.alias_name,
    masterId: row.master_id, excludeFromNutrition: row.exclude_from_nutrition,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function foodAliasToUpsert(
  mapping: FoodAliasMapping,
  householdId: string,
): TablesInsert<"food_alias_mappings"> {
  return {
    id: mapping.id, household_id: householdId, alias_name: mapping.aliasName,
    master_id: mapping.masterId, exclude_from_nutrition: mapping.excludeFromNutrition ?? false,
    created_at: mapping.createdAt, updated_at: mapping.updatedAt,
  };
}
