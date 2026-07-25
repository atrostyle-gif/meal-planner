import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import { SUITABILITY_LEVELS, type CookingHistory, type SuitabilityLevel } from "@/types/weekly-lifestyle";

type Row = Tables<"cooking_history">;
function isSuitability(value: unknown): value is SuitabilityLevel {
  return typeof value === "string" && (SUITABILITY_LEVELS as readonly string[]).includes(value);
}

export function cookingHistoryFromRow(row: Row): CookingHistory {
  return {
    id: row.id, householdId: row.household_id, recipeId: row.recipe_id, cookedByMemberId: row.cooked_by_member_id,
    cookedAt: row.cooked_at, difficultyFeedback: isSuitability(row.difficulty_feedback) ? row.difficulty_feedback : null,
    durationMinutes: row.duration_minutes, successRating: row.success_rating, notes: row.notes,
  };
}

export function cookingHistoryToInsert(entry: CookingHistory, householdId: string): TablesInsert<"cooking_history"> {
  return {
    id: entry.id, household_id: householdId, recipe_id: entry.recipeId, cooked_by_member_id: entry.cookedByMemberId,
    cooked_at: entry.cookedAt, difficulty_feedback: entry.difficultyFeedback, duration_minutes: entry.durationMinutes,
    success_rating: entry.successRating, notes: entry.notes,
  };
}
