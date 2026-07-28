"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import { HouseholdProfileSection } from "@/components/settings/HouseholdProfileSection";
import {
  emptyMemberDraft,
  MemberProfileEditor,
  profileToDraft,
} from "@/components/settings/MemberProfileEditor";
import { FirstVisitTip, HelpButton } from "@/components/ui/FirstVisitTip";
import {
  cookingDaysFromWeeklySchedule,
  deleteFamilyMemberProfile,
  getFamilyMemberProfilesServerSnapshot,
  getFamilyMemberProfilesSnapshot,
  loadFamilyMemberProfiles,
  saveFamilyMemberProfile,
  subscribeFamilyMemberProfiles,
} from "@/lib/family-member-profiles";
import type {
  FamilyMemberProfile,
  FamilyMemberProfileInput,
} from "@/types/family-member-profile";
import { COOKING_DAY_LABELS, HEALTH_CONDITION_FLAGS } from "@/types/family-member-profile";

function useProfiles(): FamilyMemberProfile[] {
  return useSyncExternalStore(
    subscribeFamilyMemberProfiles,
    getFamilyMemberProfilesSnapshot,
    getFamilyMemberProfilesServerSnapshot,
  );
}

const SECTION_IDS = ["members", "health", "lifestyle", "household"] as const;

export function FamilyProfilesPage() {
  const profiles = useProfiles();
  const { household } = useFamilySession();
  const searchParams = useSearchParams();
  const householdId = household?.id ?? "local";
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<FamilyMemberProfileInput>(() =>
    emptyMemberDraft(householdId),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const section = searchParams.get("section");
    if (!section) return;
    // 旧URL互換: health → 家庭全体の健康、lifestyle → 家庭全体
    const target =
      section === "health" || section === "lifestyle"
        ? "household"
        : (SECTION_IDS as readonly string[]).includes(section)
          ? section
          : null;
    if (!target) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(target)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  function startCreate(): void {
    setEditingId(null);
    setDraft(emptyMemberDraft(householdId));
    setShowEditor(true);
  }

  function startEdit(profile: FamilyMemberProfile): void {
    const days =
      profile.cookingDays.length > 0
        ? profile.cookingDays
        : cookingDaysFromWeeklySchedule(householdId, profile.id);
    setEditingId(profile.id);
    setDraft({
      ...profileToDraft(profile, householdId),
      cookingDays: days,
    });
    setShowEditor(true);
  }

  function handleSave(): void {
    if (draft.displayName.trim() === "") {
      setMessage("名前を入力してください");
      return;
    }
    saveFamilyMemberProfile({
      ...draft,
      id: editingId ?? undefined,
      householdId,
    });
    loadFamilyMemberProfiles();
    setMessage("保存しました");
    setShowEditor(false);
    setEditingId(null);
    setDraft(emptyMemberDraft(householdId));
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p>
          <Link href="/settings" className="text-sm text-primary">
            ← 設定
          </Link>
        </p>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">家族プロフィール</h1>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              一人ひとりの情報をここでまとめて管理
            </p>
          </div>
          <HelpButton onClick={() => setShowHelp(true)} />
        </div>
      </header>

      <nav aria-label="このページ内のセクション" className="flex flex-wrap gap-2">
        <a
          href="#members"
          className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-medium ring-1 ring-outline-variant"
        >
          メンバー
        </a>
        <a
          href="#household"
          className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-medium ring-1 ring-outline-variant"
        >
          家庭全体
        </a>
      </nav>

      <FirstVisitTip
        storageKey="meal-planner:familyProfilesHelpSeen"
        title="ご注意"
        forceOpen={showHelp}
        onForceClose={() => setShowHelp(false)}
      >
        <ul className="space-y-0.5">
          <li>・栄養値や目標は献立補助用の参考です</li>
          <li>・医療判断・治療目的には使いません</li>
          <li>・アレルギーは原材料表示も確認してください</li>
        </ul>
      </FirstVisitTip>

      <section id="members" className="scroll-mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">メンバー</h2>
          <button
            type="button"
            onClick={startCreate}
            className="text-sm font-medium text-primary"
          >
            ＋ 追加
          </button>
        </div>

        {profiles.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            まだ登録がありません。家族を追加してください。
          </p>
        ) : (
          <ul className="space-y-2">
            {profiles.map((profile) => {
              const flags = HEALTH_CONDITION_FLAGS.filter((f) =>
                profile.healthFlags.includes(f.id),
              )
                .map((f) => f.label)
                .slice(0, 3);
              const days = profile.cookingDays
                .map((d) => COOKING_DAY_LABELS[d])
                .join("");
              return (
                <li
                  key={profile.id}
                  className="rounded-2xl bg-surface-container-lowest p-3 ring-1 ring-outline-variant"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{profile.displayName}</p>
                      <p className="mt-0.5 text-xs text-on-surface-variant">
                        {[
                          profile.age != null ? `${profile.age}歳` : null,
                          profile.sex && profile.sex !== "未設定"
                            ? profile.sex
                            : null,
                          profile.servingPortion,
                          days ? `担当:${days}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {flags.length > 0 || profile.allergies.length > 0 ? (
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {[
                            ...flags,
                            profile.allergies.length > 0
                              ? `アレルギー:${profile.allergies.join("・")}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
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
                          if (
                            window.confirm("このプロフィールを削除しますか？")
                          ) {
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
              );
            })}
          </ul>
        )}

        {showEditor ? (
          <MemberProfileEditor
            draft={draft}
            editingId={editingId}
            onChange={setDraft}
            onSave={handleSave}
            onCancel={() => {
              setShowEditor(false);
              setEditingId(null);
            }}
          />
        ) : null}
      </section>

      {message ? (
        <p className="text-sm text-on-surface-variant" role="status">
          {message}
        </p>
      ) : null}

      {/* 旧 #health / #lifestyle アンカー互換 */}
      <div id="health" className="scroll-mt-4" />
      <div id="lifestyle" className="scroll-mt-4" />

      <section id="household" className="scroll-mt-4 space-y-3 border-t border-outline-variant pt-8">
        <HouseholdProfileSection />
      </section>
    </div>
  );
}
