import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import { normalizeIngredientName } from "@/lib/food-master/normalize";
import {
  isDayOfWeek,
  isRecurringPurchaseFrequency,
  type RecurringPurchaseIngredient,
} from "@/types/recurring-purchase-ingredient";

type RecurringRow = Tables<"recurring_purchase_ingredients">;

export function recurringPurchaseIngredientFromRow(
  row: RecurringRow,
): RecurringPurchaseIngredient {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    rawName: row.raw_name ?? row.name,
    normalizedName: normalizeIngredientName(row.name),
    foodMasterId: row.food_master_id,
    foodCode: row.food_code,
    quantity: row.quantity,
    unit: row.unit,
    storeId: row.store_id,
    storeName: row.store_name,
    arrivalDayOfWeek: isDayOfWeek(row.arrival_day_of_week)
      ? row.arrival_day_of_week
      : "friday",
    frequency: isRecurringPurchaseFrequency(row.frequency)
      ? row.frequency
      : "weekly",
    active: row.active,
    preferInMealPlan: row.prefer_in_meal_plan,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function recurringPurchaseIngredientToUpsert(
  item: RecurringPurchaseIngredient,
  householdId: string,
): TablesInsert<"recurring_purchase_ingredients"> {
  return {
    id: item.id,
    household_id: householdId,
    name: item.name,
    raw_name: item.rawName,
    food_master_id: item.foodMasterId ?? item.foodCode,
    food_code: item.foodCode,
    quantity: item.quantity,
    unit: item.unit,
    store_id: item.storeId,
    store_name: item.storeName,
    arrival_day_of_week: item.arrivalDayOfWeek,
    frequency: item.frequency,
    active: item.active,
    prefer_in_meal_plan: item.preferInMealPlan,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}
