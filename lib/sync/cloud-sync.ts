/**
 * Supabase と localStorage の同期。
 * 既存 UI は localStorage を読み続け、共有時はここ経由でクラウドと揃える。
 */
import { inventoryFromRow, inventoryToInsert } from "@/lib/mappers/inventory-mapper";
import { familyMemberProfileFromRow, familyMemberProfileToUpsert } from "@/lib/mappers/family-member-profile-mapper";
import { householdNutritionPreferencesFromRow, householdNutritionPreferencesToUpsert } from "@/lib/mappers/household-nutrition-preferences-mapper";
import { dailyConditionFromRow, dailyConditionToUpsert } from "@/lib/mappers/daily-condition-mapper";
import { foodAliasFromRow, foodAliasToUpsert } from "@/lib/mappers/food-alias-mapper";
import { weeklyCookingScheduleFromRow, weeklyCookingScheduleToUpsert } from "@/lib/mappers/weekly-cooking-schedule-mapper";
import { cookingMemberProfileFromRow, cookingMemberProfileToUpsert } from "@/lib/mappers/cooking-member-profile-mapper";
import { dailyCookingOverrideFromRow, dailyCookingOverrideToUpsert } from "@/lib/mappers/daily-cooking-override-mapper";
import { cookingHistoryFromRow, cookingHistoryToInsert } from "@/lib/mappers/cooking-history-mapper";
import { leftoverIngredientFromRow, leftoverIngredientToUpsert } from "@/lib/mappers/leftover-ingredient-mapper";
import { mealPlanFromRow, mealPlanToUpsert } from "@/lib/mappers/meal-plan-mapper";
import { pantryFromRow, pantryToUpsert } from "@/lib/mappers/pantry-mapper";
import { recipeFromRow, recipeToInsert } from "@/lib/mappers/recipe-mapper";
import {
  shoppingListFromRow,
  shoppingListToUpsert,
} from "@/lib/mappers/shopping-list-mapper";
import { replaceInventory } from "@/lib/inventory";
import { loadLeftoverIngredients, replaceLeftoverIngredients } from "@/lib/leftover-ingredients";
import { replaceMealPlans } from "@/lib/meal-plans";
import { replacePantryStock } from "@/lib/pantry-stock";
import {
  areSampleRecipesDismissed,
  loadRecipes,
  replaceRecipes,
} from "@/lib/recipes";
import { replaceShoppingLists } from "@/lib/shopping-lists";
import { loadInventory } from "@/lib/inventory";
import { loadMealPlans } from "@/lib/meal-plans";
import { loadPantryStock } from "@/lib/pantry-stock";
import { loadShoppingLists } from "@/lib/shopping-lists";
import { loadFamilyMemberProfiles, replaceFamilyMemberProfiles } from "@/lib/family-member-profiles";
import { loadHouseholdNutritionPreferences, replaceHouseholdNutritionPreferences } from "@/lib/household-nutrition-preferences";
import { loadDailyConditions, replaceDailyConditions } from "@/lib/daily-conditions";
import { loadFoodAliasMappings, replaceFoodAliasMappings } from "@/lib/food-master/store";
import { loadWeeklyCookingSchedules, replaceWeeklyCookingSchedules } from "@/lib/weekly-cooking-schedules";
import { loadCookingMemberProfiles, replaceCookingMemberProfiles } from "@/lib/cooking-member-profiles";
import { loadDailyCookingOverrides, replaceDailyCookingOverrides } from "@/lib/daily-cooking-overrides";
import { loadCookingHistory, replaceCookingHistory } from "@/lib/cooking-history";
import {
  pullFoodExpenseDomain,
  pushFoodExpenseDomain,
} from "@/lib/food-expense/sync";
import {
  pullRecipeLearningDomain,
  pushRecipeLearningDomain,
} from "@/lib/recipe-learning/sync";
import {
  pullReceiptDomain,
  pushReceiptDomain,
} from "@/lib/receipt/sync";
import { getLastSyncableLocalWriteAt } from "@/lib/storage";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

/** pull 中の local 書き込みで push が連鎖しないようにする */
let suppressLocalPush = false;

export function isLocalPushSuppressed(): boolean {
  return suppressLocalPush;
}

/**
 * 端末で献立などを消した直後に、古いクラウドデータで上書きしない。
 * push 完了前の pull をスキップする。
 */
export function shouldSkipCloudPull(graceMs = 3000): boolean {
  const lastWrite = getLastSyncableLocalWriteAt();
  if (lastWrite === 0) {
    return false;
  }
  return Date.now() - lastWrite < graceMs;
}

export type PullResult = {
  recipes: number;
  mealPlans: number;
  shoppingLists: number;
  inventory: number;
  pantry: number;
  familyMemberProfiles: number;
  householdNutritionPreferences: number;
  dailyConditions: number;
  foodAliasMappings: number;
  weeklyCookingSchedules: number;
  cookingMemberProfiles: number;
  dailyCookingOverrides: number;
  cookingHistory: number;
  leftovers: number;
};

export type PushResult = {
  recipes: number;
  mealPlans: number;
  shoppingLists: number;
  inventory: number;
  pantry: number;
  familyMemberProfiles: number;
  householdNutritionPreferences: number;
  dailyConditions: number;
  foodAliasMappings: number;
  weeklyCookingSchedules: number;
  cookingMemberProfiles: number;
  dailyCookingOverrides: number;
  cookingHistory: number;
  leftovers: number;
  errors: string[];
};

/** クラウド → 端末 */
export async function pullCloudToLocal(
  client: Client,
  householdId: string,
): Promise<PullResult> {
  if (shouldSkipCloudPull()) {
    return {
      recipes: loadRecipes().length,
      mealPlans: loadMealPlans().length,
      shoppingLists: loadShoppingLists().length,
      inventory: loadInventory().length,
      pantry: loadPantryStock().length,
      familyMemberProfiles: loadFamilyMemberProfiles().length,
      householdNutritionPreferences: 1,
      dailyConditions: loadDailyConditions().length,
      foodAliasMappings: loadFoodAliasMappings().length,
      weeklyCookingSchedules: loadWeeklyCookingSchedules().length,
      cookingMemberProfiles: loadCookingMemberProfiles().length,
      dailyCookingOverrides: loadDailyCookingOverrides().length,
      cookingHistory: loadCookingHistory().length,
      leftovers: loadLeftoverIngredients().length,
    };
  }

  suppressLocalPush = true;
  try {
    const [recipesRes, mealsRes, shoppingRes, inventoryRes, pantryRes, familyProfilesRes, nutritionPreferencesRes, dailyConditionsRes, foodAliasesRes, weeklySchedulesRes, cookingProfilesRes, dailyOverridesRes, cookingHistoryRes, leftoversRes] =
      await Promise.all([
        client.from("recipes").select("*").eq("household_id", householdId),
        client.from("meal_plans").select("*").eq("household_id", householdId),
        client
          .from("shopping_lists")
          .select("*")
          .eq("household_id", householdId),
        client
          .from("inventory_items")
          .select("*")
          .eq("household_id", householdId),
        client.from("pantry_items").select("*").eq("household_id", householdId),
        client.from("family_member_profiles").select("*").eq("household_id", householdId),
        client.from("household_nutrition_preferences").select("*").eq("household_id", householdId),
        client.from("daily_conditions").select("*").eq("household_id", householdId),
        client.from("food_alias_mappings").select("*").eq("household_id", householdId),
        client.from("weekly_cooking_schedules").select("*").eq("household_id", householdId),
        client.from("cooking_member_profiles").select("*").eq("household_id", householdId),
        client.from("daily_cooking_overrides").select("*").eq("household_id", householdId),
        client.from("cooking_history").select("*").eq("household_id", householdId),
        client.from("leftover_ingredients").select("*").eq("household_id", householdId),
      ]);

    if (recipesRes.error) throw recipesRes.error;
    if (mealsRes.error) throw mealsRes.error;
    if (shoppingRes.error) throw shoppingRes.error;
    if (inventoryRes.error) throw inventoryRes.error;
    if (pantryRes.error) throw pantryRes.error;
    if (familyProfilesRes.error) throw familyProfilesRes.error;
    if (nutritionPreferencesRes.error) throw nutritionPreferencesRes.error;
    if (dailyConditionsRes.error) throw dailyConditionsRes.error;
    if (foodAliasesRes.error) throw foodAliasesRes.error;
    if (weeklySchedulesRes.error) throw weeklySchedulesRes.error;
    if (cookingProfilesRes.error) throw cookingProfilesRes.error;
    if (dailyOverridesRes.error) throw dailyOverridesRes.error;
    if (cookingHistoryRes.error) throw cookingHistoryRes.error;
    if (leftoversRes.error) throw leftoversRes.error;

    // ユーザーがサンプルを削除済みなら、クラウドのサンプルで上書き復活させない
    const recipes = (recipesRes.data ?? [])
      .map(recipeFromRow)
      .filter((recipe) => !(areSampleRecipesDismissed() && recipe.isSample));
    const mealPlans = (mealsRes.data ?? []).map(mealPlanFromRow);
    const shoppingLists = (shoppingRes.data ?? []).map(shoppingListFromRow);
    const inventory = (inventoryRes.data ?? []).map(inventoryFromRow);
    const pantry = (pantryRes.data ?? [])
      .map(pantryFromRow)
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const familyMemberProfiles = (familyProfilesRes.data ?? []).map(familyMemberProfileFromRow);
    const dailyConditions = (dailyConditionsRes.data ?? []).map(dailyConditionFromRow);
    const foodAliasMappings = (foodAliasesRes.data ?? []).map(foodAliasFromRow);
    const weeklyCookingSchedules = (weeklySchedulesRes.data ?? [])
      .map(weeklyCookingScheduleFromRow)
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const cookingMemberProfiles = (cookingProfilesRes.data ?? []).map(cookingMemberProfileFromRow);
    const dailyCookingOverrides = (dailyOverridesRes.data ?? []).map(dailyCookingOverrideFromRow);
    const cookingHistory = (cookingHistoryRes.data ?? []).map(cookingHistoryFromRow);
    const leftovers = (leftoversRes.data ?? []).map(leftoverIngredientFromRow);

    replaceRecipes(recipes);
    replaceMealPlans(mealPlans);
    replaceShoppingLists(shoppingLists);
    replaceInventory(inventory);
    replacePantryStock(pantry);
    replaceFamilyMemberProfiles(familyMemberProfiles);
    const nutritionPreferences = nutritionPreferencesRes.data?.[0];
    if (nutritionPreferences) {
      replaceHouseholdNutritionPreferences(
        householdNutritionPreferencesFromRow(nutritionPreferences),
      );
    }
    replaceDailyConditions(dailyConditions);
    replaceFoodAliasMappings(foodAliasMappings);
    replaceWeeklyCookingSchedules(weeklyCookingSchedules);
    replaceCookingMemberProfiles(cookingMemberProfiles);
    replaceDailyCookingOverrides(dailyCookingOverrides);
    replaceCookingHistory(cookingHistory);
    replaceLeftoverIngredients(leftovers);
    await pullReceiptDomain(client, householdId);
    await pullFoodExpenseDomain(client, householdId);
    await pullRecipeLearningDomain(client, householdId);

    return {
      recipes: recipes.length,
      mealPlans: mealPlans.length,
      shoppingLists: shoppingLists.length,
      inventory: inventory.length,
      pantry: pantry.length,
      familyMemberProfiles: familyMemberProfiles.length,
      householdNutritionPreferences: nutritionPreferences ? 1 : 0,
      dailyConditions: dailyConditions.length,
      foodAliasMappings: foodAliasMappings.length,
      weeklyCookingSchedules: weeklyCookingSchedules.length,
      cookingMemberProfiles: cookingMemberProfiles.length,
      dailyCookingOverrides: dailyCookingOverrides.length,
      cookingHistory: cookingHistory.length,
      leftovers: leftovers.length,
    };
  } finally {
    suppressLocalPush = false;
  }
}

/** 端末 → クラウド（upsert） */
export async function pushLocalToCloud(
  client: Client,
  householdId: string,
  userId: string,
): Promise<PushResult> {
  const errors: string[] = [];
  let recipes = 0;
  let mealPlans = 0;
  let shoppingLists = 0;
  let inventory = 0;
  let pantry = 0;
  let familyMemberProfiles = 0;
  let householdNutritionPreferences = 0;
  let dailyConditions = 0;
  let foodAliasMappings = 0;
  let weeklyCookingSchedules = 0;
  let cookingMemberProfiles = 0;
  let dailyCookingOverrides = 0;
  let cookingHistory = 0;
  let leftovers = 0;

  try {
    const localRecipes = loadRecipes();
    if (localRecipes.length > 0) {
      const { error } = await client.from("recipes").upsert(
        localRecipes.map((recipe) =>
          recipeToInsert(recipe, householdId, userId),
        ),
        { onConflict: "id" },
      );
      if (error) {
        errors.push(`recipes: ${error.message}`);
      } else {
        recipes = localRecipes.length;
      }
    }

    // 端末で消したサンプルがクラウドに残り、pull で復活するのを防ぐ
    if (areSampleRecipesDismissed()) {
      const { error } = await client
        .from("recipes")
        .delete()
        .eq("household_id", householdId)
        .eq("is_sample", true);
      if (error) {
        errors.push(`recipes(sample cleanup): ${error.message}`);
      }
    } else {
      const localIds = new Set(localRecipes.map((recipe) => recipe.id));
      const { data: cloudSamples, error: listError } = await client
        .from("recipes")
        .select("id")
        .eq("household_id", householdId)
        .eq("is_sample", true);
      if (listError) {
        errors.push(`recipes(sample list): ${listError.message}`);
      } else {
        const orphanIds = (cloudSamples ?? [])
          .map((row) => row.id)
          .filter((id) => !localIds.has(id));
        if (orphanIds.length > 0) {
          const { error } = await client
            .from("recipes")
            .delete()
            .eq("household_id", householdId)
            .in("id", orphanIds);
          if (error) {
            errors.push(`recipes(sample orphan): ${error.message}`);
          }
        }
      }
    }
  } catch (error) {
    errors.push(`recipes: ${error instanceof Error ? error.message : "失敗"}`);
  }

  try {
    const plans = loadMealPlans();
    if (plans.length > 0) {
      const { error } = await client.from("meal_plans").upsert(
        plans.map((plan) => mealPlanToUpsert(plan, householdId, userId)),
        { onConflict: "household_id,week_start" },
      );
      if (error) {
        errors.push(`meal_plans: ${error.message}`);
      } else {
        mealPlans = plans.length;
      }
    }
  } catch (error) {
    errors.push(`meal_plans: ${error instanceof Error ? error.message : "失敗"}`);
  }

  try {
    const lists = loadShoppingLists();
    if (lists.length > 0) {
      const { error } = await client.from("shopping_lists").upsert(
        lists.map((list) => shoppingListToUpsert(list, householdId, userId)),
        { onConflict: "household_id,week_start" },
      );
      if (error) {
        errors.push(`shopping_lists: ${error.message}`);
      } else {
        shoppingLists = lists.length;
      }
    }
  } catch (error) {
    errors.push(
      `shopping_lists: ${error instanceof Error ? error.message : "失敗"}`,
    );
  }

  try {
    const items = loadInventory();
    if (items.length > 0) {
      const { error } = await client.from("inventory_items").upsert(
        items.map((item) => inventoryToInsert(item, householdId, userId)),
        { onConflict: "id" },
      );
      if (error) {
        errors.push(`inventory: ${error.message}`);
      } else {
        inventory = items.length;
      }
    }
  } catch (error) {
    errors.push(`inventory: ${error instanceof Error ? error.message : "失敗"}`);
  }

  try {
    const items = loadPantryStock();
    if (items.length > 0) {
      const { error } = await client.from("pantry_items").upsert(
        items.map((item) => pantryToUpsert(item, householdId, userId)),
        { onConflict: "household_id,key" },
      );
      if (error) {
        errors.push(`pantry: ${error.message}`);
      } else {
        pantry = items.length;
      }
    }
  } catch (error) {
    errors.push(`pantry: ${error instanceof Error ? error.message : "失敗"}`);
  }

  try {
    const profiles = loadFamilyMemberProfiles();
    if (profiles.length > 0) {
      const { error } = await client.from("family_member_profiles").upsert(
        profiles.map((profile) => familyMemberProfileToUpsert(profile, householdId)), { onConflict: "id" },
      );
      if (error) errors.push(`family_member_profiles: ${error.message}`);
      else familyMemberProfiles = profiles.length;
    }
  } catch (error) {
    errors.push(`family_member_profiles: ${error instanceof Error ? error.message : "失敗"}`);
  }

  try {
    const preferences = loadHouseholdNutritionPreferences();
    const { error } = await client.from("household_nutrition_preferences").upsert(
      householdNutritionPreferencesToUpsert(preferences, householdId), { onConflict: "household_id" },
    );
    if (error) errors.push(`household_nutrition_preferences: ${error.message}`);
    else householdNutritionPreferences = 1;
  } catch (error) {
    errors.push(`household_nutrition_preferences: ${error instanceof Error ? error.message : "失敗"}`);
  }

  try {
    const conditions = loadDailyConditions();
    if (conditions.length > 0) {
      const { error } = await client.from("daily_conditions").upsert(
        conditions.map((condition) => dailyConditionToUpsert(condition, householdId)), { onConflict: "household_id,date" },
      );
      if (error) errors.push(`daily_conditions: ${error.message}`);
      else dailyConditions = conditions.length;
    }
  } catch (error) {
    errors.push(`daily_conditions: ${error instanceof Error ? error.message : "失敗"}`);
  }

  try {
    const mappings = loadFoodAliasMappings();
    if (mappings.length > 0) {
      const { error } = await client.from("food_alias_mappings").upsert(
        mappings.map((mapping) => foodAliasToUpsert(mapping, householdId)), { onConflict: "id" },
      );
      if (error) errors.push(`food_alias_mappings: ${error.message}`);
      else foodAliasMappings = mappings.length;
    }
  } catch (error) {
    errors.push(`food_alias_mappings: ${error instanceof Error ? error.message : "失敗"}`);
  }

  try {
    const schedules = loadWeeklyCookingSchedules();
    if (schedules.length > 0) {
      const { error } = await client.from("weekly_cooking_schedules").upsert(
        schedules.map((schedule) => weeklyCookingScheduleToUpsert(schedule, householdId)), { onConflict: "household_id,day_of_week" },
      );
      if (error) errors.push(`weekly_cooking_schedules: ${error.message}`);
      else weeklyCookingSchedules = schedules.length;
    }
  } catch (error) {
    errors.push(`weekly_cooking_schedules: ${error instanceof Error ? error.message : "失敗"}`);
  }

  try {
    const profiles = loadCookingMemberProfiles();
    if (profiles.length > 0) {
      const { error } = await client.from("cooking_member_profiles").upsert(
        profiles.map((profile) => cookingMemberProfileToUpsert(profile, householdId)), { onConflict: "household_id,family_member_profile_id" },
      );
      if (error) errors.push(`cooking_member_profiles: ${error.message}`);
      else cookingMemberProfiles = profiles.length;
    }
  } catch (error) {
    errors.push(`cooking_member_profiles: ${error instanceof Error ? error.message : "失敗"}`);
  }

  try {
    const overrides = loadDailyCookingOverrides();
    if (overrides.length > 0) {
      const { error } = await client.from("daily_cooking_overrides").upsert(
        overrides.map((override) => dailyCookingOverrideToUpsert(override, householdId)), { onConflict: "household_id,date" },
      );
      if (error) errors.push(`daily_cooking_overrides: ${error.message}`);
      else dailyCookingOverrides = overrides.length;
    }
  } catch (error) {
    errors.push(`daily_cooking_overrides: ${error instanceof Error ? error.message : "失敗"}`);
  }

  try {
    const history = loadCookingHistory();
    if (history.length > 0) {
      const { error } = await client.from("cooking_history").upsert(
        history.map((entry) => cookingHistoryToInsert(entry, householdId)), { onConflict: "id" },
      );
      if (error) errors.push(`cooking_history: ${error.message}`);
      else cookingHistory = history.length;
    }
  } catch (error) {
    errors.push(`cooking_history: ${error instanceof Error ? error.message : "失敗"}`);
  }

  try {
    const items = loadLeftoverIngredients();
    if (items.length > 0) {
      const { error } = await client.from("leftover_ingredients").upsert(
        items.map((item) => leftoverIngredientToUpsert(item, householdId)),
        { onConflict: "id" },
      );
      if (error) errors.push(`leftover_ingredients: ${error.message}`);
      else leftovers = items.length;
    }
  } catch (error) {
    errors.push(`leftover_ingredients: ${error instanceof Error ? error.message : "失敗"}`);
  }

  try {
    const receiptSync = await pushReceiptDomain(client, householdId);
    errors.push(...receiptSync.errors);
  } catch (error) {
    errors.push(
      `receipt_domain: ${error instanceof Error ? error.message : "失敗"}`,
    );
  }

  try {
    const expenseSync = await pushFoodExpenseDomain(client, householdId);
    errors.push(...expenseSync.errors);
  } catch (error) {
    errors.push(
      `food_expense_domain: ${error instanceof Error ? error.message : "失敗"}`,
    );
  }

  try {
    const learningSync = await pushRecipeLearningDomain(client, householdId);
    errors.push(...learningSync.errors);
  } catch (error) {
    errors.push(
      `recipe_learning_domain: ${error instanceof Error ? error.message : "失敗"}`,
    );
  }

  return {
    recipes, mealPlans, shoppingLists, inventory, pantry, familyMemberProfiles,
    householdNutritionPreferences, dailyConditions, foodAliasMappings,
    weeklyCookingSchedules, cookingMemberProfiles, dailyCookingOverrides,
    cookingHistory, errors,
    leftovers,
  };
}

export type MigrationMarker = {
  householdId: string;
  migratedAt: string;
};

/** 初回コピー／破棄の完了状態（家庭ごと） */
export type MigrationState = {
  householdId: string;
  /** true なら初回コピーダイアログを二度と出さない */
  migrationCompleted: boolean;
  choice?: "copied" | "discarded";
  completedAt?: string;
};

const MIGRATION_KEY = "meal-planner:cloudMigration";
const MIGRATION_STATE_KEY = "meal-planner:migrationState";
const LAST_SYNCED_AT_KEY = "meal-planner:lastSyncedAt";

export function getMigrationMarker(): MigrationMarker | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(MIGRATION_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as MigrationMarker;
  } catch {
    return null;
  }
}

export function setMigrationMarker(householdId: string): void {
  markMigrationCompleted(householdId, "copied");
}

export function getMigrationState(householdId: string): MigrationState | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(MIGRATION_STATE_KEY);
    if (raw) {
      const state = JSON.parse(raw) as MigrationState;
      if (state.householdId === householdId) {
        return state;
      }
    }
  } catch {
    // fall through
  }
  // 旧マーカーがあれば完了済みとして扱う（後方互換）
  const legacy = getMigrationMarker();
  if (legacy?.householdId === householdId) {
    return {
      householdId,
      migrationCompleted: true,
      choice: "copied",
      completedAt: legacy.migratedAt,
    };
  }
  return null;
}

export function isMigrationCompleted(householdId: string): boolean {
  return getMigrationState(householdId)?.migrationCompleted === true;
}

export function markMigrationCompleted(
  householdId: string,
  choice: "copied" | "discarded",
): void {
  if (typeof window === "undefined") {
    return;
  }
  const state: MigrationState = {
    householdId,
    migrationCompleted: true,
    choice,
    completedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify(state));
  if (choice === "copied") {
    const marker: MigrationMarker = {
      householdId,
      migratedAt: state.completedAt ?? new Date().toISOString(),
    };
    window.localStorage.setItem(MIGRATION_KEY, JSON.stringify(marker));
  }
}

/** 初回コピーダイアログを出すべきか */
export function shouldShowInitialMigrationPrompt(householdId: string): boolean {
  if (isMigrationCompleted(householdId)) {
    return false;
  }
  return hasLocalDataToMigrate();
}

/**
 * 共有するローカルデータが無い場合は、ダイアログなしで完了扱いにする。
 * （以降の自動同期をブロックしないため）
 */
export function ensureMigrationGate(householdId: string): void {
  if (isMigrationCompleted(householdId)) {
    return;
  }
  if (!hasLocalDataToMigrate()) {
    markMigrationCompleted(householdId, "discarded");
  }
}

export function getLastSyncedAt(householdId: string): number {
  if (typeof window === "undefined") {
    return 0;
  }
  try {
    const raw = window.localStorage.getItem(LAST_SYNCED_AT_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { householdId?: string; at?: number };
    if (parsed.householdId !== householdId || typeof parsed.at !== "number") {
      return 0;
    }
    return parsed.at;
  } catch {
    return 0;
  }
}

export function setLastSyncedAt(householdId: string, at = Date.now()): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    LAST_SYNCED_AT_KEY,
    JSON.stringify({ householdId, at }),
  );
}

export type SyncConflictInfo = {
  householdId: string;
  localWriteAt: number;
  cloudWriteAt: number;
  lastSyncedAt: number;
};

/**
 * 最終同期以降に端末とクラウドの両方に更新があり、
 * 自動解決できない双方向更新かをざっくり判定する。
 */
export async function detectUnresolvedSyncConflict(
  client: Client,
  householdId: string,
): Promise<SyncConflictInfo | null> {
  const lastSyncedAt = getLastSyncedAt(householdId);
  const localWriteAt = getLastSyncableLocalWriteAt();

  // 初回同期前、または端末に未同期の変更が無い場合は競合にしない
  if (lastSyncedAt === 0 || localWriteAt <= lastSyncedAt) {
    return null;
  }

  const { data, error } = await client
    .from("recipes")
    .select("updated_at")
    .eq("household_id", householdId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    return null;
  }

  const cloudWriteAt = data?.[0]?.updated_at
    ? Date.parse(data[0].updated_at)
    : 0;

  if (!Number.isFinite(cloudWriteAt) || cloudWriteAt <= lastSyncedAt) {
    return null;
  }

  return {
    householdId,
    localWriteAt,
    cloudWriteAt,
    lastSyncedAt,
  };
}

export function hasLocalDataToMigrate(): boolean {
  const preview = getLocalMigrationPreview();
  return (
    preview.recipes > 0 ||
    preview.mealPlans > 0 ||
    preview.shoppingLists > 0 ||
    preview.inventory > 0 ||
    preview.pantry > 0 ||
    preview.familyMemberProfiles > 0 ||
    preview.dailyConditions > 0 ||
    preview.foodAliasMappings > 0 ||
    preview.weeklyCookingSchedules > 0 ||
    preview.cookingMemberProfiles > 0 ||
    preview.dailyCookingOverrides > 0 ||
    preview.cookingHistory > 0
  );
}

/** コピー前に表示する端末データの件数 */
export type LocalMigrationPreview = {
  recipes: number;
  /** アイテムがある日数 */
  mealPlanDays: number;
  /** 週単位の献立プラン数 */
  mealPlans: number;
  shoppingLists: number;
  inventory: number;
  pantry: number;
  familyMemberProfiles: number;
  dailyConditions: number;
  foodAliasMappings: number;
  weeklyCookingSchedules: number;
  cookingMemberProfiles: number;
  dailyCookingOverrides: number;
  cookingHistory: number;
};

export function getLocalMigrationPreview(): LocalMigrationPreview {
  const plans = loadMealPlans();
  let mealPlanDays = 0;
  for (const plan of plans) {
    for (const day of plan.days) {
      if (day.items.length > 0) {
        mealPlanDays += 1;
      }
    }
  }

  return {
    recipes: loadRecipes().length,
    mealPlanDays,
    mealPlans: plans.length,
    shoppingLists: loadShoppingLists().length,
    inventory: loadInventory().length,
    pantry: loadPantryStock().length,
    familyMemberProfiles: loadFamilyMemberProfiles().length,
    dailyConditions: loadDailyConditions().length,
    foodAliasMappings: loadFoodAliasMappings().length,
    weeklyCookingSchedules: loadWeeklyCookingSchedules().length,
    cookingMemberProfiles: loadCookingMemberProfiles().length,
    dailyCookingOverrides: loadDailyCookingOverrides().length,
    cookingHistory: loadCookingHistory().length,
  };
}

/** PushResult から成功件数の合計を返す */
export function countPushSuccess(result: PushResult): number {
  return (
    result.recipes +
    result.mealPlans +
    result.shoppingLists +
    result.inventory +
    result.pantry +
    result.familyMemberProfiles +
    result.householdNutritionPreferences +
    result.dailyConditions +
    result.foodAliasMappings +
    result.weeklyCookingSchedules +
    result.cookingMemberProfiles +
    result.dailyCookingOverrides +
    result.cookingHistory
  );
}
