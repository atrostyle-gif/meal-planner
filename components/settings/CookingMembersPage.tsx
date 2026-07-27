"use client";

import Link from "next/link";
import { useSyncExternalStore, useState } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import {
  ensureCookingProfile, loadCookingMemberProfiles, saveCookingMemberProfile,
} from "@/lib/cooking-member-profiles";
import {
  getFamilyMemberProfilesServerSnapshot, getFamilyMemberProfilesSnapshot,
  subscribeFamilyMemberProfiles,
} from "@/lib/family-member-profiles";
import { useRecipes } from "@/lib/use-recipes";
import {
  COOKING_LEVELS, COOKING_LEVEL_LABELS, type CookingMemberProfile,
} from "@/types/weekly-lifestyle";

function useMembers() {
  return useSyncExternalStore(subscribeFamilyMemberProfiles, getFamilyMemberProfilesSnapshot, getFamilyMemberProfilesServerSnapshot);
}
const recipeLists = [
  ["preferredRecipeIds", "得意・好きな料理"], ["avoidRecipeIds", "避けたい料理"],
  ["masteredRecipeIds", "作り慣れた料理"], ["learningRecipeIds", "挑戦中の料理"],
] as const;

export function CookingMembersPage() {
  const { household } = useFamilySession();
  const householdId = household?.id ?? "local";
  const members = useMembers();
  const recipes = useRecipes();
  const [profiles, setProfiles] = useState<CookingMemberProfile[]>(() => loadCookingMemberProfiles());
  const [message, setMessage] = useState<string | null>(null);
  function getProfile(memberId: string): CookingMemberProfile {
    return profiles.find((profile) => profile.familyMemberProfileId === memberId)
      ?? ensureCookingProfile(householdId, memberId);
  }
  function save(profile: CookingMemberProfile): void {
    const next = saveCookingMemberProfile(profile);
    setProfiles(loadCookingMemberProfiles());
    setMessage("調理プロフィールを保存しました");
    void next;
  }
  function toggleRecipe(profile: CookingMemberProfile, key: typeof recipeLists[number][0], recipeId: string): void {
    const values = profile[key];
    save({ ...profile, [key]: values.includes(recipeId) ? values.filter((id) => id !== recipeId) : [...values, recipeId] });
  }
  return <div className="space-y-6">
    <header className="space-y-2"><Link href="/settings" className="text-sm text-primary">← 設定</Link><h1 className="text-2xl font-bold">調理担当</h1><p className="text-sm text-on-surface-variant">家族ごとの得意なこと・作りやすい料理を設定します。</p></header>
    {members.length === 0 ? <p className="rounded-2xl bg-surface-container p-4 text-sm">先に家族プロフィールを登録してください。</p> : members.map((member) => {
      const profile = getProfile(member.id);
      return <section key={member.id} className="space-y-4 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-lg font-semibold">{member.displayName}</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-on-surface-variant">調理レベル<select value={profile.cookingLevel} onChange={(e) => save({ ...profile, cookingLevel: e.target.value as CookingMemberProfile["cookingLevel"] })} className="mt-1 w-full rounded-xl bg-surface-container p-2 text-sm text-on-surface">{COOKING_LEVELS.map((level) => <option key={level} value={level}>{COOKING_LEVEL_LABELS[level]}</option>)}</select></label>
          <label className="text-xs text-on-surface-variant">普段の上限（分）<input type="number" min="0" value={profile.defaultMaxCookingMinutes ?? ""} onChange={(e) => save({ ...profile, defaultMaxCookingMinutes: e.target.value === "" ? null : Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-surface-container p-2 text-sm text-on-surface" /></label>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          {([["canDeepFry","揚げ物"],["canUseOven","オーブン"],["canUsePressureCooker","圧力鍋"],["canHandleRawFish","生魚"],["prefersLowCleanup","洗い物少なめ"]] as const).map(([key,label]) => <label key={key} className="flex gap-1"><input type="checkbox" checked={profile[key]} onChange={(e) => save({ ...profile, [key]: e.target.checked })}/>{label}</label>)}
        </div>
        {recipeLists.map(([key, label]) => <details key={key} className="rounded-xl bg-surface-container p-3"><summary className="cursor-pointer text-sm font-medium">{label}（{profile[key].length}件）</summary><div className="mt-2 grid gap-1 text-sm">{recipes.map((recipe) => <label key={recipe.id} className="flex gap-2"><input type="checkbox" checked={profile[key].includes(recipe.id)} onChange={() => toggleRecipe(profile, key, recipe.id)} />{recipe.name}</label>)}</div></details>)}
      </section>;
    })}
    {message ? <p role="status" className="text-sm text-on-surface-variant">{message}</p> : null}
  </div>;
}
