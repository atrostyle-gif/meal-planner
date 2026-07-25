import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import {
  isAgeGroup,
  isDietaryRestriction,
  isMemberGoal,
  isProfileActivityLevel,
  type FamilyMemberProfile,
} from "@/types/family-member-profile";

type Row = Tables<"family_member_profiles">;
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function familyMemberProfileFromRow(row: Row): FamilyMemberProfile {
  return {
    id: row.id, householdId: row.household_id, userId: row.user_id, displayName: row.display_name,
    birthYear: row.birth_year, ageGroup: isAgeGroup(row.age_group) ? row.age_group : "未設定",
    sex: row.sex === "男性" || row.sex === "女性" || row.sex === "その他" || row.sex === "未設定" ? row.sex : "未設定",
    activityLevel: isProfileActivityLevel(row.activity_level) ? row.activity_level : "未設定",
    calorieTarget: row.calorie_target, proteinTarget: row.protein_target, saltLimit: row.salt_limit,
    goals: strings(row.goals).filter(isMemberGoal), allergies: strings(row.allergies),
    dislikedIngredients: strings(row.disliked_ingredients),
    dietaryRestrictions: strings(row.dietary_restrictions).filter(isDietaryRestriction),
    notes: row.notes, isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function familyMemberProfileToUpsert(profile: FamilyMemberProfile, householdId: string): TablesInsert<"family_member_profiles"> {
  return {
    id: profile.id, household_id: householdId, user_id: profile.userId ?? null, display_name: profile.displayName,
    birth_year: profile.birthYear ?? null, age_group: profile.ageGroup, sex: profile.sex ?? null,
    activity_level: profile.activityLevel, calorie_target: profile.calorieTarget ?? null,
    protein_target: profile.proteinTarget ?? null, salt_limit: profile.saltLimit ?? null,
    goals: profile.goals, allergies: profile.allergies, disliked_ingredients: profile.dislikedIngredients,
    dietary_restrictions: profile.dietaryRestrictions, notes: profile.notes ?? null, is_active: profile.isActive,
    created_at: profile.createdAt, updated_at: profile.updatedAt,
  };
}
