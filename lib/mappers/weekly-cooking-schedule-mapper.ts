import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import { isDayOfWeek, isEffortLevel, type WeeklyCookingSchedule } from "@/types/weekly-lifestyle";

type Row = Tables<"weekly_cooking_schedules">;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function weeklyCookingScheduleFromRow(row: Row): WeeklyCookingSchedule | null {
  if (!isDayOfWeek(row.day_of_week)) return null;
  return {
    id: row.id, householdId: row.household_id, dayOfWeek: row.day_of_week, defaultCookMemberId: row.default_cook_member_id,
    backupCookMemberIds: strings(row.backup_cook_member_ids), cookingTimeLimitMinutes: row.cooking_time_limit_minutes,
    effortLevel: isEffortLevel(row.effort_level) ? row.effort_level : "normal", shoppingAvailable: row.shopping_available,
    isShoppingDay: row.is_shopping_day, allowNewRecipes: row.allow_new_recipes, preferFamiliarRecipes: row.prefer_familiar_recipes,
    allowBatchCooking: row.allow_batch_cooking, preferLowCleanup: row.prefer_low_cleanup, maxStepCount: row.max_step_count,
    avoidDeepFrying: row.avoid_deep_frying, preferMakeAhead: row.prefer_make_ahead, notes: row.notes, isActive: row.is_active,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function weeklyCookingScheduleToUpsert(schedule: WeeklyCookingSchedule, householdId: string): TablesInsert<"weekly_cooking_schedules"> {
  return {
    id: schedule.id, household_id: householdId, day_of_week: schedule.dayOfWeek, default_cook_member_id: schedule.defaultCookMemberId,
    backup_cook_member_ids: schedule.backupCookMemberIds, cooking_time_limit_minutes: schedule.cookingTimeLimitMinutes,
    effort_level: schedule.effortLevel, shopping_available: schedule.shoppingAvailable, is_shopping_day: schedule.isShoppingDay,
    allow_new_recipes: schedule.allowNewRecipes, prefer_familiar_recipes: schedule.preferFamiliarRecipes,
    allow_batch_cooking: schedule.allowBatchCooking, prefer_low_cleanup: schedule.preferLowCleanup, max_step_count: schedule.maxStepCount,
    avoid_deep_frying: schedule.avoidDeepFrying, prefer_make_ahead: schedule.preferMakeAhead, notes: schedule.notes,
    is_active: schedule.isActive, created_at: schedule.createdAt, updated_at: schedule.updatedAt,
  };
}
