/**
 * 食費取引・月間予算の家族同期。
 * テーブル未整備時はエラーを返してローカルを維持する。
 */
import {
  loadFoodBudgetSettings,
  saveFoodBudgetSettings,
} from "@/lib/food-budget/settings";
import { getFoodExpenseRepository } from "@/lib/food-expense/repository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { FoodBudgetSettings } from "@/types/food-budget";
import type { FoodExpenseTransaction } from "@/types/food-expense";

type Client = SupabaseClient<Database>;

export type FoodExpenseSyncResult = {
  transactions: number;
  budgetSettings: number;
  errors: string[];
};

function mergeById(
  local: FoodExpenseTransaction[],
  remote: FoodExpenseTransaction[],
): FoodExpenseTransaction[] {
  const map = new Map<string, FoodExpenseTransaction>();
  for (const item of [...remote, ...local]) {
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
      continue;
    }
    map.set(
      item.id,
      item.updatedAt >= prev.updatedAt ? item : prev,
    );
  }
  return [...map.values()].sort((a, b) =>
    b.purchasedAt.localeCompare(a.purchasedAt),
  );
}

export async function pullFoodExpenseDomain(
  client: Client,
  householdId: string,
): Promise<FoodExpenseSyncResult> {
  const errors: string[] = [];
  const result: FoodExpenseSyncResult = {
    transactions: 0,
    budgetSettings: 0,
    errors,
  };

  try {
    const res = await client
      .from("food_expense_transactions")
      .select("*")
      .eq("household_id", householdId);
    if (res.error) throw res.error;
    const remote = (res.data ?? []) as unknown as FoodExpenseTransaction[];
    if (remote.length > 0) {
      const merged = mergeById(getFoodExpenseRepository().list(), remote);
      getFoodExpenseRepository().replaceAll(merged);
      result.transactions = merged.length;
    }
  } catch (error) {
    errors.push(
      `food_expense_transactions: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  try {
    const res = await client
      .from("food_budget_settings")
      .select("*")
      .eq("household_id", householdId)
      .maybeSingle();
    if (res.error) throw res.error;
    if (res.data) {
      const row = res.data as unknown as {
        settings_json?: FoodBudgetSettings;
        updated_at?: string;
      };
      if (row.settings_json) {
        const local = loadFoodBudgetSettings();
        const remoteUpdated = row.updated_at ?? "";
        if (remoteUpdated >= local.updatedAt) {
          const remote = row.settings_json;
          saveFoodBudgetSettings({
            primaryStoreName: remote.primaryStoreName,
            defaultStoreProfileId: remote.defaultStoreProfileId,
            storeProfiles: remote.storeProfiles,
            weeklyFoodBudgetYen: remote.weeklyFoodBudgetYen,
            monthlyFoodBudgetYen: remote.monthlyFoodBudgetYen,
            monthlyBudgetStartDay: remote.monthlyBudgetStartDay,
            includePreparedFood: remote.includePreparedFood,
            includeEatingOut: remote.includeEatingOut,
            includeHouseholdGoods: remote.includeHouseholdGoods,
            budgetMode: remote.budgetMode,
            scoreWeights: remote.scoreWeights,
            weekBudgetOverrides: remote.weekBudgetOverrides,
          });
          result.budgetSettings = 1;
        }
      }
    }
  } catch (error) {
    errors.push(
      `food_budget_settings: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  return result;
}

export async function pushFoodExpenseDomain(
  client: Client,
  householdId: string,
): Promise<FoodExpenseSyncResult> {
  const errors: string[] = [];
  const result: FoodExpenseSyncResult = {
    transactions: 0,
    budgetSettings: 0,
    errors,
  };

  try {
    const items = getFoodExpenseRepository().list().map((tx) => ({
      ...tx,
      household_id: householdId,
      householdId,
    }));
    if (items.length > 0) {
      const { error } = await client
        .from("food_expense_transactions")
        .upsert(items as never);
      if (error) throw error;
    }
    result.transactions = items.length;
  } catch (error) {
    errors.push(
      `food_expense_transactions: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  try {
    const settings = loadFoodBudgetSettings();
    const { error } = await client.from("food_budget_settings").upsert({
      household_id: householdId,
      settings_json: settings,
      updated_at: settings.updatedAt || new Date().toISOString(),
    } as never);
    if (error) throw error;
    result.budgetSettings = 1;
  } catch (error) {
    errors.push(
      `food_budget_settings: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  return result;
}
