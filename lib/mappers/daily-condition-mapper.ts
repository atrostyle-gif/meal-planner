import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import { isDailyConditionOption, type DailyCondition } from "@/types/daily-condition";

type Row = Tables<"daily_conditions">;

export function dailyConditionFromRow(row: Row): DailyCondition {
  return {
    date: row.date,
    selectedConditions: Array.isArray(row.selected_conditions)
      ? row.selected_conditions.filter(isDailyConditionOption)
      : ["通常"],
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

export function dailyConditionToUpsert(
  condition: DailyCondition,
  householdId: string,
): TablesInsert<"daily_conditions"> {
  return {
    household_id: householdId,
    date: condition.date,
    selected_conditions: condition.selectedConditions,
    notes: condition.notes ?? null,
    updated_at: condition.updatedAt,
  };
}
