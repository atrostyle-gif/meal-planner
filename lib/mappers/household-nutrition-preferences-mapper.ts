import type { HouseholdNutritionPreferences } from "@/lib/household-nutrition-preferences";
import type { Tables, TablesInsert } from "@/lib/supabase/database.types";

type Row = Tables<"household_nutrition_preferences">;

export function householdNutritionPreferencesFromRow(
  row: Row,
): HouseholdNutritionPreferences {
  return {
    defaultAutoFillMode: row.default_auto_fill_mode,
    showNutritionDisclaimer: row.show_nutrition_disclaimer,
    settings: row.settings,
    updatedAt: row.updated_at,
  };
}

export function householdNutritionPreferencesToUpsert(
  preferences: HouseholdNutritionPreferences,
  householdId: string,
): TablesInsert<"household_nutrition_preferences"> {
  return {
    household_id: householdId,
    default_auto_fill_mode: preferences.defaultAutoFillMode,
    show_nutrition_disclaimer: preferences.showNutritionDisclaimer,
    settings: preferences.settings,
    updated_at: preferences.updatedAt,
  };
}
