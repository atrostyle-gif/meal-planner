import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import { isEffortLevel, type DailyCookingOverride } from "@/types/weekly-lifestyle";

type Row = Tables<"daily_cooking_overrides">;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function dailyCookingOverrideFromRow(row: Row): DailyCookingOverride {
  return {
    id: row.id, householdId: row.household_id, date: row.date, cookMemberId: row.cook_member_id,
    isEatingOut: row.is_eating_out, skipMealPlanning: row.skip_meal_planning,
    cookingTimeLimitMinutes: row.cooking_time_limit_minutes,
    effortLevel: isEffortLevel(row.effort_level) ? row.effort_level : null,
    shoppingAvailable: row.shopping_available, allowNewRecipes: row.allow_new_recipes,
    participantMemberIds: strings(row.participant_member_ids), notes: row.notes, updatedAt: row.updated_at,
  };
}

export function dailyCookingOverrideToUpsert(override: DailyCookingOverride, householdId: string): TablesInsert<"daily_cooking_overrides"> {
  return {
    id: override.id, household_id: householdId, date: override.date, cook_member_id: override.cookMemberId,
    is_eating_out: override.isEatingOut, skip_meal_planning: override.skipMealPlanning,
    cooking_time_limit_minutes: override.cookingTimeLimitMinutes, effort_level: override.effortLevel,
    shopping_available: override.shoppingAvailable, allow_new_recipes: override.allowNewRecipes,
    participant_member_ids: override.participantMemberIds, notes: override.notes, updated_at: override.updatedAt,
  };
}
