import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import {
  isLeftoverPriority,
  isLeftoverSource,
  isLeftoverStatus,
  type LeftoverIngredient,
} from "@/types/leftover-ingredient";

type LeftoverRow = Tables<"leftover_ingredients">;

export function leftoverIngredientFromRow(row: LeftoverRow): LeftoverIngredient {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    foodMasterId: row.food_master_id,
    quantity: row.quantity,
    unit: row.unit,
    priority: isLeftoverPriority(row.priority) ? row.priority : "normal",
    notes: row.notes,
    source: isLeftoverSource(row.source) ? row.source : "manual",
    status: isLeftoverStatus(row.status) ? row.status : "active",
    plannedForDates: Array.isArray(row.planned_for_dates)
      ? row.planned_for_dates.filter((value): value is string => typeof value === "string")
      : [],
    migratedFromInventoryId: row.migrated_from_inventory_id,
    includeInProposal: row.include_in_proposal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function leftoverIngredientToUpsert(
  item: LeftoverIngredient,
  householdId: string,
): TablesInsert<"leftover_ingredients"> {
  return {
    id: item.id,
    household_id: householdId,
    name: item.name,
    food_master_id: item.foodMasterId,
    quantity: item.quantity,
    unit: item.unit,
    priority: item.priority,
    notes: item.notes,
    source: item.source,
    status: item.status,
    planned_for_dates: item.plannedForDates,
    migrated_from_inventory_id: item.migratedFromInventoryId,
    include_in_proposal: item.includeInProposal,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}
