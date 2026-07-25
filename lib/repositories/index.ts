import { createLocalRepositories } from "@/lib/repositories/local";
import { createSupabaseHouseholdRepository } from "@/lib/repositories/supabase/household-repository";
import { createSupabaseRecipeRepository } from "@/lib/repositories/supabase/recipe-repository";
import type { AppRepositories } from "@/lib/repositories/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAppDataMode } from "@/lib/supabase/env";

/**
 * 環境に応じた repository 一式を返す。
 * Supabase でも UI 同期の主経路は local + cloud-sync だが、
 * 直接クラウド操作（家庭・招待・サンプル import 等）で利用する。
 */
export function getAppRepositories(context?: {
  householdId?: string | null;
  userId?: string | null;
}): AppRepositories {
  const mode = getAppDataMode();
  const local = createLocalRepositories();

  if (mode !== "supabase") {
    return local;
  }

  const client = getSupabaseBrowserClient();
  if (!client || !context?.householdId || !context.userId) {
    return {
      ...local,
      household: client ? createSupabaseHouseholdRepository(client) : null,
    };
  }

  return {
    recipes: createSupabaseRecipeRepository(
      client,
      context.householdId,
      context.userId,
    ),
    mealPlans: local.mealPlans,
    shoppingLists: local.shoppingLists,
    inventory: local.inventory,
    pantry: local.pantry,
    household: createSupabaseHouseholdRepository(client),
  };
}

export type { AppRepositories } from "@/lib/repositories/types";
