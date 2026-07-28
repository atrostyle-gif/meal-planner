import type { HouseholdRepository } from "@/lib/repositories/types";
import type { Database } from "@/lib/supabase/database.types";
import type {
  Household,
  HouseholdInvite,
  HouseholdMember,
  Profile,
} from "@/types/household";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

function mapProfile(row: Database["public"]["Tables"]["profiles"]["Row"]): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseHouseholdRepository(
  client: Client,
): HouseholdRepository {
  return {
    async getMyProfile() {
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) {
        return null;
      }
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data ? mapProfile(data) : null;
    },

    async updateDisplayName(displayName) {
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) {
        throw new Error("ログインが必要です");
      }
      const { data, error } = await client
        .from("profiles")
        .update({ display_name: displayName.trim() })
        .eq("id", user.id)
        .select("*")
        .single();
      if (error) {
        throw error;
      }
      return mapProfile(data);
    },

    async getMyHousehold() {
      const { data: householdId, error: idError } = await client.rpc(
        "get_my_household_id",
      );
      if (idError) {
        throw idError;
      }
      if (!householdId) {
        return null;
      }
      const { data, error } = await client
        .from("households")
        .select("*")
        .eq("id", householdId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      if (!data) {
        return null;
      }
      return {
        id: data.id,
        name: data.name,
        createdBy: data.created_by,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        defaultMealServings:
          typeof data.default_meal_servings === "number"
            ? data.default_meal_servings
            : null,
      } satisfies Household;
    },

    async listMembers() {
      const household = await this.getMyHousehold();
      if (!household) {
        return [];
      }
      const { data, error } = await client
        .from("household_members")
        .select("household_id, user_id, role, joined_at")
        .eq("household_id", household.id);
      if (error) {
        throw error;
      }
      const members = data ?? [];
      const ids = members.map((member) => member.user_id);
      const { data: profiles } = await client
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      const nameMap = new Map(
        (profiles ?? []).map((profile) => [profile.id, profile.display_name]),
      );

      return members.map(
        (member): HouseholdMember => ({
          householdId: member.household_id,
          userId: member.user_id,
          role: member.role,
          joinedAt: member.joined_at,
          displayName: nameMap.get(member.user_id) ?? "ユーザー",
        }),
      );
    },

    async createHousehold(name, displayName) {
      const { data, error } = await client.rpc("create_household_with_owner", {
        p_name: name,
        p_display_name: displayName,
      });
      if (error) {
        throw error;
      }
      return data;
    },

    async createInvite(expiresHours = 72) {
      const household = await this.getMyHousehold();
      if (!household) {
        throw new Error("家庭がありません");
      }
      const { data, error } = await client.rpc("create_household_invite", {
        p_household_id: household.id,
        p_expires_hours: expiresHours,
      });
      if (error) {
        throw error;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        throw new Error("招待コードの発行に失敗しました");
      }
      return {
        id: row.id,
        householdId: household.id,
        code: row.code,
        createdBy: "",
        expiresAt: row.expires_at,
        usedBy: null,
        usedAt: null,
        createdAt: new Date().toISOString(),
      } satisfies HouseholdInvite;
    },

    async joinWithInvite(code, displayName) {
      const { data, error } = await client.rpc("join_household_with_invite", {
        p_code: code,
        p_display_name: displayName ?? undefined,
      });
      if (error) {
        throw error;
      }
      return data;
    },
  };
}
