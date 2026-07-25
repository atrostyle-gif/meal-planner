/**
 * Supabase Database 型（手動定義）。
 * CLI がなくても build できるようにする。
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type HouseholdRole = "owner" | "member";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      households: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      household_members: {
        Row: {
          household_id: string;
          user_id: string;
          role: HouseholdRole;
          joined_at: string;
        };
        Insert: {
          household_id: string;
          user_id: string;
          role?: HouseholdRole;
          joined_at?: string;
        };
        Update: {
          household_id?: string;
          user_id?: string;
          role?: HouseholdRole;
          joined_at?: string;
        };
        Relationships: [];
      };
      household_invites: {
        Row: {
          id: string;
          household_id: string;
          code: string;
          created_by: string;
          expires_at: string;
          used_by: string | null;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          code: string;
          created_by: string;
          expires_at: string;
          used_by?: string | null;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          code?: string;
          created_by?: string;
          expires_at?: string;
          used_by?: string | null;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      recipes: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          category: string;
          course: string;
          servings: number;
          cooking_time_minutes: number | null;
          tags: Json;
          ingredients: Json;
          steps: Json;
          cooking_profile: Json | null;
          import_method: string | null;
          source: Json | null;
          meal_affinity: Json | null;
          extraction_warnings: Json | null;
          notes: string | null;
          is_sample: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          category: string;
          course: string;
          servings?: number;
          cooking_time_minutes?: number | null;
          tags?: Json;
          ingredients?: Json;
          steps?: Json;
          cooking_profile?: Json | null;
          import_method?: string | null;
          source?: Json | null;
          meal_affinity?: Json | null;
          extraction_warnings?: Json | null;
          notes?: string | null;
          is_sample?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recipes"]["Insert"]>;
        Relationships: [];
      };
      meal_plans: {
        Row: {
          id: string;
          household_id: string;
          week_start: string;
          days: Json;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          week_start: string;
          days?: Json;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["meal_plans"]["Insert"]>;
        Relationships: [];
      };
      shopping_lists: {
        Row: {
          id: string;
          household_id: string;
          week_start: string;
          items: Json;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          week_start: string;
          items?: Json;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shopping_lists"]["Insert"]>;
        Relationships: [];
      };
      inventory_items: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          amount: Json | null;
          unit: string;
          priority: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          amount?: Json | null;
          unit?: string;
          priority?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory_items"]["Insert"]>;
        Relationships: [];
      };
      leftover_ingredients: {
        Row: {
          id: string; household_id: string; name: string; food_master_id: string | null;
          quantity: number | null; unit: string | null; priority: string; notes: string | null;
          source: string; status: string; planned_for_dates: Json; migrated_from_inventory_id: string | null;
          include_in_proposal: boolean; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; household_id: string; name: string; food_master_id?: string | null;
          quantity?: number | null; unit?: string | null; priority?: string; notes?: string | null;
          source?: string; status?: string; planned_for_dates?: Json; migrated_from_inventory_id?: string | null;
          include_in_proposal?: boolean; created_at?: string; updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leftover_ingredients"]["Insert"]>;
        Relationships: [];
      };
      pantry_items: {
        Row: {
          key: string;
          household_id: string;
          display_name: string;
          ingredient_type: string;
          stock_status: string;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          household_id: string;
          display_name: string;
          ingredient_type: string;
          stock_status?: string;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pantry_items"]["Insert"]>;
        Relationships: [];
      };
      family_member_profiles: {
        Row: {
          id: string; household_id: string; user_id: string | null; display_name: string;
          birth_year: number | null; age_group: string; sex: string | null; activity_level: string;
          calorie_target: number | null; protein_target: number | null; salt_limit: number | null;
          goals: Json; allergies: Json; disliked_ingredients: Json; dietary_restrictions: Json;
          notes: string | null; is_active: boolean; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; household_id: string; user_id?: string | null; display_name: string;
          birth_year?: number | null; age_group?: string; sex?: string | null; activity_level?: string;
          calorie_target?: number | null; protein_target?: number | null; salt_limit?: number | null;
          goals?: Json; allergies?: Json; disliked_ingredients?: Json; dietary_restrictions?: Json;
          notes?: string | null; is_active?: boolean; created_at?: string; updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["family_member_profiles"]["Insert"]>;
        Relationships: [];
      };
      household_nutrition_preferences: {
        Row: { household_id: string; default_auto_fill_mode: string; show_nutrition_disclaimer: boolean; settings: Json; updated_at: string; };
        Insert: { household_id: string; default_auto_fill_mode?: string; show_nutrition_disclaimer?: boolean; settings?: Json; updated_at?: string; };
        Update: Partial<Database["public"]["Tables"]["household_nutrition_preferences"]["Insert"]>;
        Relationships: [];
      };
      daily_conditions: {
        Row: { household_id: string; date: string; selected_conditions: Json; notes: string | null; updated_at: string; };
        Insert: { household_id: string; date: string; selected_conditions?: Json; notes?: string | null; updated_at?: string; };
        Update: Partial<Database["public"]["Tables"]["daily_conditions"]["Insert"]>;
        Relationships: [];
      };
      food_alias_mappings: {
        Row: { id: string; household_id: string; alias_name: string; master_id: string; exclude_from_nutrition: boolean; created_at: string; updated_at: string; };
        Insert: { id?: string; household_id: string; alias_name: string; master_id: string; exclude_from_nutrition?: boolean; created_at?: string; updated_at?: string; };
        Update: Partial<Database["public"]["Tables"]["food_alias_mappings"]["Insert"]>;
        Relationships: [];
      };
      weekly_cooking_schedules: {
        Row: {
          id: string; household_id: string; day_of_week: string; default_cook_member_id: string | null; backup_cook_member_ids: Json;
          cooking_time_limit_minutes: number | null; effort_level: string; shopping_available: boolean; is_shopping_day: boolean;
          allow_new_recipes: boolean; prefer_familiar_recipes: boolean; allow_batch_cooking: boolean; prefer_low_cleanup: boolean;
          max_step_count: number | null; avoid_deep_frying: boolean; prefer_make_ahead: boolean; notes: string | null;
          is_active: boolean; created_at: string; updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["weekly_cooking_schedules"]["Row"], "id" | "household_id">> & { id?: string; household_id: string; day_of_week: string; };
        Update: Partial<Database["public"]["Tables"]["weekly_cooking_schedules"]["Insert"]>;
        Relationships: [];
      };
      cooking_member_profiles: {
        Row: {
          id: string; household_id: string; family_member_profile_id: string; cooking_level: string;
          default_max_cooking_minutes: number | null; max_comfortable_step_count: number | null; can_deep_fry: boolean; can_use_oven: boolean;
          can_use_pressure_cooker: boolean; can_handle_raw_fish: boolean; prefers_low_cleanup: boolean; preferred_recipe_ids: Json;
          avoid_recipe_ids: Json; mastered_recipe_ids: Json; learning_recipe_ids: Json; preferred_categories: Json;
          disliked_cooking_methods: Json; notes: string | null; is_active: boolean; created_at: string; updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["cooking_member_profiles"]["Row"], "id" | "household_id" | "family_member_profile_id">> & { id?: string; household_id: string; family_member_profile_id: string; };
        Update: Partial<Database["public"]["Tables"]["cooking_member_profiles"]["Insert"]>;
        Relationships: [];
      };
      daily_cooking_overrides: {
        Row: {
          id: string; household_id: string; date: string; cook_member_id: string | null; is_eating_out: boolean; skip_meal_planning: boolean;
          cooking_time_limit_minutes: number | null; effort_level: string | null; shopping_available: boolean | null;
          allow_new_recipes: boolean | null; participant_member_ids: Json; notes: string | null; updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["daily_cooking_overrides"]["Row"], "id" | "household_id" | "date">> & { id?: string; household_id: string; date: string; };
        Update: Partial<Database["public"]["Tables"]["daily_cooking_overrides"]["Insert"]>;
        Relationships: [];
      };
      cooking_history: {
        Row: { id: string; household_id: string; recipe_id: string; cooked_by_member_id: string | null; cooked_at: string; difficulty_feedback: string | null; duration_minutes: number | null; success_rating: number | null; notes: string | null; };
        Insert: { id?: string; household_id: string; recipe_id: string; cooked_by_member_id?: string | null; cooked_at?: string; difficulty_feedback?: string | null; duration_minutes?: number | null; success_rating?: number | null; notes?: string | null; };
        Update: Partial<Database["public"]["Tables"]["cooking_history"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_household_with_owner: {
        Args: { p_name: string; p_display_name: string };
        Returns: string;
      };
      create_household_invite: {
        Args: { p_household_id: string; p_expires_hours?: number };
        Returns: {
          id: string;
          code: string;
          expires_at: string;
        };
      };
      join_household_with_invite: {
        Args: { p_code: string; p_display_name?: string };
        Returns: string;
      };
      get_my_household_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
    };
    Enums: {
      household_role: HouseholdRole;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
