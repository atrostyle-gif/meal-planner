/**
 * 料理フィードバック・我が家版の家族同期。
 * テーブル未整備時はエラーを返してローカルを維持する。
 */
import {
  loadCookingFeedbacks,
  replaceCookingFeedbacks,
} from "@/lib/recipe-learning/cooking-feedbacks";
import {
  loadRecipeVariants,
  replaceRecipeVariants,
} from "@/lib/recipe-learning/recipe-variants";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { CookingFeedback, RecipeVariant } from "@/types/recipe-learning";

type Client = SupabaseClient<Database>;

export type RecipeLearningSyncResult = {
  feedbacks: number;
  variants: number;
  errors: string[];
};

function mergeFeedbacks(
  local: CookingFeedback[],
  remote: CookingFeedback[],
): CookingFeedback[] {
  const map = new Map<string, CookingFeedback>();
  for (const item of [...remote, ...local]) {
    const prev = map.get(item.id);
    if (!prev || item.updatedAt >= prev.updatedAt) {
      map.set(item.id, item);
    }
  }
  return [...map.values()].sort((a, b) =>
    b.cookedAt.localeCompare(a.cookedAt),
  );
}

function mergeVariants(
  local: RecipeVariant[],
  remote: RecipeVariant[],
): RecipeVariant[] {
  const map = new Map<string, RecipeVariant>();
  for (const item of [...remote, ...local]) {
    const prev = map.get(item.id);
    if (!prev || item.updatedAt >= prev.updatedAt) {
      map.set(item.id, item);
    }
  }
  return [...map.values()];
}

export async function pullRecipeLearningDomain(
  client: Client,
  householdId: string,
): Promise<RecipeLearningSyncResult> {
  const errors: string[] = [];
  const result: RecipeLearningSyncResult = {
    feedbacks: 0,
    variants: 0,
    errors,
  };

  try {
    const res = await client
      .from("cooking_feedbacks")
      .select("*")
      .eq("household_id", householdId);
    if (res.error) throw res.error;
    const remote = (res.data ?? []) as unknown as CookingFeedback[];
    if (remote.length > 0) {
      const merged = mergeFeedbacks(loadCookingFeedbacks(), remote);
      replaceCookingFeedbacks(merged);
      result.feedbacks = merged.length;
    }
  } catch (error) {
    errors.push(
      `cooking_feedbacks: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  try {
    const res = await client
      .from("recipe_variants")
      .select("*")
      .eq("household_id", householdId);
    if (res.error) throw res.error;
    const remote = (res.data ?? []) as unknown as RecipeVariant[];
    if (remote.length > 0) {
      const merged = mergeVariants(loadRecipeVariants(), remote);
      replaceRecipeVariants(merged);
      result.variants = merged.length;
    }
  } catch (error) {
    errors.push(
      `recipe_variants: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  return result;
}

export async function pushRecipeLearningDomain(
  client: Client,
  householdId: string,
): Promise<RecipeLearningSyncResult> {
  const errors: string[] = [];
  const result: RecipeLearningSyncResult = {
    feedbacks: 0,
    variants: 0,
    errors,
  };

  try {
    const items = loadCookingFeedbacks().map((item) => ({
      ...item,
      household_id: householdId,
      householdId,
    }));
    if (items.length > 0) {
      const { error } = await client
        .from("cooking_feedbacks")
        .upsert(items as never);
      if (error) throw error;
    }
    result.feedbacks = items.length;
  } catch (error) {
    errors.push(
      `cooking_feedbacks: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  try {
    const items = loadRecipeVariants().map((item) => ({
      ...item,
      household_id: householdId,
      householdId,
    }));
    if (items.length > 0) {
      const { error } = await client
        .from("recipe_variants")
        .upsert(items as never);
      if (error) throw error;
    }
    result.variants = items.length;
  } catch (error) {
    errors.push(
      `recipe_variants: ${error instanceof Error ? error.message : "未整備または失敗"}`,
    );
  }

  return result;
}
