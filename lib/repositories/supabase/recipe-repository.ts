import { recipeFromRow, recipeToInsert, recipeToUpdate } from "@/lib/mappers/recipe-mapper";
import type { RecipeRepository } from "@/lib/repositories/types";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecipeInput } from "@/types/recipe";

type Client = SupabaseClient<Database>;

export function createSupabaseRecipeRepository(
  client: Client,
  householdId: string,
  userId: string,
): RecipeRepository {
  return {
    async list() {
      const { data, error } = await client
        .from("recipes")
        .select("*")
        .eq("household_id", householdId)
        .order("updated_at", { ascending: false });
      if (error) {
        throw error;
      }
      return (data ?? []).map(recipeFromRow);
    },

    async getById(id) {
      const { data, error } = await client
        .from("recipes")
        .select("*")
        .eq("id", id)
        .eq("household_id", householdId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data ? recipeFromRow(data) : null;
    },

    async create(input, options) {
      const payload = recipeToInsert(
        {
          ...input,
          id: options?.id,
          isSample: options?.isSample,
        },
        householdId,
        userId,
      );
      const { data, error } = await client
        .from("recipes")
        .insert(payload)
        .select("*")
        .single();
      if (error) {
        throw error;
      }
      return recipeFromRow(data);
    },

    async update(id, input, options) {
      if (options?.expectedUpdatedAt && !options.force) {
        const current = await this.getById(id);
        if (
          current &&
          current.updatedAt !== options.expectedUpdatedAt
        ) {
          const err = new Error(
            "ほかの家族がこのレシピを更新しています。最新内容を確認してください。",
          ) as Error & { code: string; currentUpdatedAt: string };
          err.code = "conflict";
          err.currentUpdatedAt = current.updatedAt;
          throw err;
        }
      }

      const { data, error } = await client
        .from("recipes")
        .update(recipeToUpdate(input, userId))
        .eq("id", id)
        .eq("household_id", householdId)
        .select("*")
        .single();
      if (error) {
        throw error;
      }
      return recipeFromRow(data);
    },

    async delete(id) {
      const { error, count } = await client
        .from("recipes")
        .delete({ count: "exact" })
        .eq("id", id)
        .eq("household_id", householdId);
      if (error) {
        throw error;
      }
      return (count ?? 0) > 0;
    },

    async removeSamples() {
      const { data, error } = await client
        .from("recipes")
        .delete()
        .eq("household_id", householdId)
        .eq("is_sample", true)
        .select("id");
      if (error) {
        throw error;
      }
      return data?.length ?? 0;
    },

    async importRecipes(recipes) {
      const existing = await this.list();
      const byId = new Set(existing.map((item) => item.id));
      const bySampleName = new Set(
        existing.filter((item) => item.isSample).map((item) => item.name),
      );
      let imported = 0;
      let skipped = 0;

      for (const recipe of recipes) {
        if (byId.has(recipe.id)) {
          skipped += 1;
          continue;
        }
        if (recipe.isSample && bySampleName.has(recipe.name)) {
          skipped += 1;
          continue;
        }
        const payload = recipeToInsert(recipe, householdId, userId);
        const { error } = await client.from("recipes").insert(payload);
        if (error) {
          throw error;
        }
        imported += 1;
        byId.add(recipe.id);
        if (recipe.isSample) {
          bySampleName.add(recipe.name);
        }
      }

      return { imported, skipped };
    },
  };
}

export async function upsertRecipeInput(
  repo: RecipeRepository,
  input: RecipeInput,
  id?: string,
): Promise<void> {
  if (id) {
    await repo.update(id, input, { force: true });
  } else {
    await repo.create(input);
  }
}
