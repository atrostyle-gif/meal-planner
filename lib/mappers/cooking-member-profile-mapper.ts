import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import { isCookingLevel, type CookingMemberProfile } from "@/types/weekly-lifestyle";

type Row = Tables<"cooking_member_profiles">;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function cookingMemberProfileFromRow(row: Row): CookingMemberProfile {
  return {
    id: row.id, householdId: row.household_id, familyMemberProfileId: row.family_member_profile_id,
    cookingLevel: isCookingLevel(row.cooking_level) ? row.cooking_level : "basic",
    defaultMaxCookingMinutes: row.default_max_cooking_minutes, maxComfortableStepCount: row.max_comfortable_step_count,
    canDeepFry: row.can_deep_fry, canUseOven: row.can_use_oven, canUsePressureCooker: row.can_use_pressure_cooker,
    canHandleRawFish: row.can_handle_raw_fish, prefersLowCleanup: row.prefers_low_cleanup,
    preferredRecipeIds: strings(row.preferred_recipe_ids), avoidRecipeIds: strings(row.avoid_recipe_ids),
    masteredRecipeIds: strings(row.mastered_recipe_ids), learningRecipeIds: strings(row.learning_recipe_ids),
    preferredCategories: strings(row.preferred_categories), dislikedCookingMethods: strings(row.disliked_cooking_methods),
    notes: row.notes, isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function cookingMemberProfileToUpsert(profile: CookingMemberProfile, householdId: string): TablesInsert<"cooking_member_profiles"> {
  return {
    id: profile.id, household_id: householdId, family_member_profile_id: profile.familyMemberProfileId,
    cooking_level: profile.cookingLevel, default_max_cooking_minutes: profile.defaultMaxCookingMinutes,
    max_comfortable_step_count: profile.maxComfortableStepCount, can_deep_fry: profile.canDeepFry, can_use_oven: profile.canUseOven,
    can_use_pressure_cooker: profile.canUsePressureCooker, can_handle_raw_fish: profile.canHandleRawFish,
    prefers_low_cleanup: profile.prefersLowCleanup, preferred_recipe_ids: profile.preferredRecipeIds,
    avoid_recipe_ids: profile.avoidRecipeIds, mastered_recipe_ids: profile.masteredRecipeIds, learning_recipe_ids: profile.learningRecipeIds,
    preferred_categories: profile.preferredCategories, disliked_cooking_methods: profile.dislikedCookingMethods,
    notes: profile.notes, is_active: profile.isActive, created_at: profile.createdAt, updated_at: profile.updatedAt,
  };
}
