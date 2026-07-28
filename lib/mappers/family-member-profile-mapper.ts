import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import { packProfileNotes, unpackProfileNotes, parseExtraFromUnknown, migrateHealthFlagsFromGoals, resolveAge, estimateStandardNutrition } from "@/lib/family-profile-helpers";
import {
  isAgeGroup,
  isDietaryRestriction,
  isFoodPreferenceTag,
  isCookingDayKey,
  isHealthConditionFlagId,
  isMemberGoal,
  isProfileActivityLevel,
  isServingPortion,
  type FamilyMemberProfile,
} from "@/types/family-member-profile";

type Row = Tables<"family_member_profiles">;
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function familyMemberProfileFromRow(row: Row): FamilyMemberProfile {
  const unpacked = unpackProfileNotes(row.notes);
  const extra = parseExtraFromUnknown(unpacked.extra);
  const goals = strings(row.goals).filter(isMemberGoal);
  const sex =
    row.sex === "男性" || row.sex === "女性" || row.sex === "その他" || row.sex === "未設定"
      ? row.sex
      : "未設定";
  const activityLevel = isProfileActivityLevel(row.activity_level)
    ? row.activity_level
    : "未設定";
  const servingPortion = isServingPortion(extra.servingPortion)
    ? extra.servingPortion
    : "普通";
  const age = resolveAge(extra.age, row.birth_year);
  const useStandardNutrition =
    typeof extra.useStandardNutrition === "boolean"
      ? extra.useStandardNutrition
      : !(row.calorie_target != null || row.protein_target != null);
  let calorieTarget = row.calorie_target;
  let proteinTarget = row.protein_target;
  let fatTarget = extra.fatTarget;
  let carbTarget = extra.carbTarget;
  if (useStandardNutrition) {
    const estimated = estimateStandardNutrition({
      age,
      sex,
      activityLevel,
      servingPortion,
    });
    calorieTarget = estimated.calorieTarget;
    proteinTarget = estimated.proteinTarget;
    fatTarget = estimated.fatTarget;
    carbTarget = estimated.carbTarget;
  }

  return {
    id: row.id,
    householdId: row.household_id,
    userId: row.user_id,
    displayName: row.display_name,
    age,
    birthYear: row.birth_year,
    ageGroup: isAgeGroup(row.age_group) ? row.age_group : "未設定",
    sex,
    activityLevel,
    servingPortion,
    calorieTarget,
    proteinTarget,
    fatTarget,
    carbTarget,
    saltLimit: row.salt_limit,
    useStandardNutrition,
    goals,
    healthFlags: migrateHealthFlagsFromGoals(
      goals,
      extra.healthFlags.filter(isHealthConditionFlagId),
    ),
    allergies: strings(row.allergies),
    dislikedIngredients: strings(row.disliked_ingredients),
    likedIngredients: extra.likedIngredients,
    dietaryRestrictions: strings(row.dietary_restrictions).filter(isDietaryRestriction),
    foodPreferences: extra.foodPreferences.filter(isFoodPreferenceTag),
    cookingDays: extra.cookingDays.filter(isCookingDayKey),
    notes: unpacked.notes,
    healthNotes: extra.healthNotes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function familyMemberProfileToUpsert(
  profile: FamilyMemberProfile,
  householdId: string,
): TablesInsert<"family_member_profiles"> {
  return {
    id: profile.id,
    household_id: householdId,
    user_id: profile.userId ?? null,
    display_name: profile.displayName,
    birth_year: profile.birthYear ?? null,
    age_group: profile.ageGroup,
    sex: profile.sex ?? null,
    activity_level: profile.activityLevel,
    calorie_target: profile.calorieTarget ?? null,
    protein_target: profile.proteinTarget ?? null,
    salt_limit: profile.saltLimit ?? null,
    goals: profile.goals,
    allergies: profile.allergies,
    disliked_ingredients: profile.dislikedIngredients,
    dietary_restrictions: profile.dietaryRestrictions,
    notes: packProfileNotes(profile.notes, {
      age: profile.age,
      servingPortion: profile.servingPortion,
      fatTarget: profile.fatTarget,
      carbTarget: profile.carbTarget,
      useStandardNutrition: profile.useStandardNutrition,
      healthFlags: profile.healthFlags,
      likedIngredients: profile.likedIngredients,
      foodPreferences: profile.foodPreferences,
      cookingDays: profile.cookingDays,
      healthNotes: profile.healthNotes,
    }),
    is_active: profile.isActive,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}
