"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AGE_GROUPS,
  COMMON_ALLERGENS,
  DIETARY_RESTRICTIONS,
  MEMBER_GOALS,
  PROFILE_ACTIVITY_LEVELS,
  PROFILE_SEXES,
  type AgeGroup,
  type DietaryRestriction,
  type FamilyMemberProfile,
  type MemberGoal,
  type ProfileActivityLevel,
  type ProfileSex,
} from "@/types/family-member-profile";
import {
  deleteFamilyMemberProfile,
  loadFamilyMemberProfiles,
  saveFamilyMemberProfile,
  subscribeFamilyMemberProfiles,
  getFamilyMemberProfilesSnapshot,
  getFamilyMemberProfilesServerSnapshot,
} from "@/lib/family-member-profiles";
import { useSyncExternalStore } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";

function useProfiles(): FamilyMemberProfile[] {
  return useSyncExternalStore(
    subscribeFamilyMemberProfiles,
    getFamilyMemberProfilesSnapshot,
    getFamilyMemberProfilesServerSnapshot,
  );
}

function emptyDraft(householdId: string): Parameters<typeof saveFamilyMemberProfile>[0] {
  return {
    householdId,
    displayName: "",
    ageGroup: "未設定",
    activityLevel: "未設定",
    sex: "未設定",
    goals: ["バランス重視"],
    allergies: [],
    dislikedIngredients: [],
    dietaryRestrictions: ["なし"],
    isActive: true,
  };
}

export function FamilyProfilesPage() {
  const profiles = useProfiles();
  const { household } = useFamilySession();
  const householdId = household?.id ?? "local";
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => emptyDraft(householdId));
  const [message, setMessage] = useState<string | null>(null);

  const editing = useMemo(
    () => profiles.find((p) => p.id === editingId) ?? null,
    [profiles, editingId],
  );

  function startCreate(): void {
    setEditingId(null);
    setDraft(emptyDraft(householdId));
  }

  function startEdit(profile: FamilyMemberProfile): void {
    setEditingId(profile.id);
    setDraft({
      ...profile,
      householdId: profile.householdId || householdId,
    });
  }

  function toggleAllergy(name: string): void {
    setDraft((current) => {
      const has = current.allergies.includes(name);
      return {
        ...current,
        allergies: has
          ? current.allergies.filter((a) => a !== name)
          : [...current.allergies, name],
      };
    });
  }

  function toggleGoal(goal: MemberGoal): void {
    setDraft((current) => {
      const has = current.goals.includes(goal);
      return {
        ...current,
        goals: has
          ? current.goals.filter((g) => g !== goal)
          : [...current.goals, goal],
      };
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p>
          <Link href="/settings" className="text-sm text-primary">
            ← 設定
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight">家族プロフィール</h1>
        <p className="text-sm text-on-surface-variant">
          献立作成の参考情報です。未入力でもアプリは利用できます。
        </p>
      </header>

      <section className="rounded-2xl bg-surface-container px-4 py-3 text-xs text-on-surface-variant">
        <p className="font-medium text-on-surface">ご注意</p>
        <ul className="mt-1 space-y-0.5">
          <li>・栄養値や目標は家庭での献立補助用の参考です</li>
          <li>・医療上の判断・治療目的には使用しないでください</li>
          <li>・アレルギーは必ず食品の原材料表示も確認してください</li>
          <li>・自動判定は安全を保証するものではありません</li>
        </ul>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-on-surface-variant">メンバー</h2>
          <button
            type="button"
            onClick={startCreate}
            className="text-sm font-medium text-primary"
          >
            ＋ 追加
          </button>
        </div>
        {profiles.length === 0 ? (
          <p className="text-sm text-on-surface-variant">まだ登録がありません</p>
        ) : (
          <ul className="space-y-2">
            {profiles.map((profile) => (
              <li
                key={profile.id}
                className="rounded-2xl bg-surface-container-lowest p-3 ring-1 ring-outline-variant"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{profile.displayName}</p>
                    <p className="text-xs text-on-surface-variant">
                      {profile.ageGroup} / {profile.activityLevel}
                      {profile.allergies.length > 0
                        ? ` / アレルギー: ${profile.allergies.join("・")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-sm text-primary"
                      onClick={() => startEdit(profile)}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      className="text-sm text-error"
                      onClick={() => {
                        if (window.confirm("このプロフィールを削除しますか？")) {
                          deleteFamilyMemberProfile(profile.id);
                          setMessage("削除しました");
                        }
                      }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-sm font-medium text-on-surface-variant">
          {editing ? "プロフィール編集" : "新規プロフィール"}
        </h2>

        <label className="block space-y-1">
          <span className="text-xs text-on-surface-variant">表示名</span>
          <input
            value={draft.displayName}
            onChange={(e) =>
              setDraft((c) => ({ ...c, displayName: e.target.value }))
            }
            className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">年齢層</span>
            <select
              value={draft.ageGroup}
              onChange={(e) =>
                setDraft((c) => ({
                  ...c,
                  ageGroup: e.target.value as AgeGroup,
                }))
              }
              className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
            >
              {AGE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">活動量</span>
            <select
              value={draft.activityLevel}
              onChange={(e) =>
                setDraft((c) => ({
                  ...c,
                  activityLevel: e.target.value as ProfileActivityLevel,
                }))
              }
              className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
            >
              {PROFILE_ACTIVITY_LEVELS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">性別（任意）</span>
            <select
              value={draft.sex ?? "未設定"}
              onChange={(e) =>
                setDraft((c) => ({
                  ...c,
                  sex: e.target.value as ProfileSex,
                }))
              }
              className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
            >
              {PROFILE_SEXES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">生年（任意）</span>
            <input
              type="number"
              value={draft.birthYear ?? ""}
              onChange={(e) =>
                setDraft((c) => ({
                  ...c,
                  birthYear:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">カロリー目標</span>
            <input
              type="number"
              value={draft.calorieTarget ?? ""}
              onChange={(e) =>
                setDraft((c) => ({
                  ...c,
                  calorieTarget:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
              placeholder="任意"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">たんぱく目標</span>
            <input
              type="number"
              value={draft.proteinTarget ?? ""}
              onChange={(e) =>
                setDraft((c) => ({
                  ...c,
                  proteinTarget:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
              placeholder="任意"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">塩分上限</span>
            <input
              type="number"
              value={draft.saltLimit ?? ""}
              onChange={(e) =>
                setDraft((c) => ({
                  ...c,
                  saltLimit:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
              placeholder="任意"
            />
          </label>
        </div>

        <fieldset>
          <legend className="text-xs text-on-surface-variant">目標</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {MEMBER_GOALS.map((goal) => (
              <button
                key={goal}
                type="button"
                onClick={() => toggleGoal(goal)}
                className={`rounded-full px-2.5 py-1 text-xs ring-1 ${
                  draft.goals.includes(goal)
                    ? "bg-primary text-on-primary ring-primary"
                    : "bg-surface-container ring-outline-variant"
                }`}
              >
                {goal}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs text-on-surface-variant">アレルギー</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {COMMON_ALLERGENS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => toggleAllergy(name)}
                className={`rounded-full px-2.5 py-1 text-xs ring-1 ${
                  draft.allergies.includes(name)
                    ? "bg-error-container text-error ring-error/40"
                    : "bg-surface-container ring-outline-variant"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block space-y-1">
          <span className="text-xs text-on-surface-variant">食事制限</span>
          <select
            value={draft.dietaryRestrictions[0] ?? "なし"}
            onChange={(e) =>
              setDraft((c) => ({
                ...c,
                dietaryRestrictions: [e.target.value as DietaryRestriction],
              }))
            }
            className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
          >
            {DIETARY_RESTRICTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            if (draft.displayName.trim() === "") {
              setMessage("表示名を入力してください");
              return;
            }
            saveFamilyMemberProfile({
              ...draft,
              id: editingId ?? undefined,
              householdId,
            });
            // 再読込のため snapshot を触る
            loadFamilyMemberProfiles();
            setMessage("保存しました");
            startCreate();
          }}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
        >
          保存する
        </button>
      </section>

      {message ? (
        <p className="text-sm text-on-surface-variant" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
