"use client";

import Link from "next/link";
import { useState } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import {
  SettingsGroup,
  SettingsLinkRow,
} from "@/components/settings/SettingsNav";
import { estimateRecipeCookingProfile } from "@/lib/cooking-suitability";
import { loadMealPlans } from "@/lib/meal-plans";
import { recalculateAllRecipeNutrition } from "@/lib/nutrition/recalculate-all";
import {
  loadRecipes,
  removeSampleRecipes,
  replaceRecipes,
  resetSampleRecipes,
} from "@/lib/recipes";
import {
  getDataModeLabel,
  isSupabaseConfigured,
} from "@/lib/supabase/env";
import { toUserFacingError } from "@/lib/supabase/errors";

const APP_VERSION = "0.1.0";

export function SettingsPage() {
  const {
    mode,
    ready,
    session,
    profile,
    household,
    user,
    syncing,
    lastSyncError,
    lastPulledAt,
    pullLatest,
    signOut,
  } = useFamilySession();
  const [message, setMessage] = useState<string | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const supabaseConfigured = isSupabaseConfigured();

  function samplesInUse(): boolean {
    const sampleIds = new Set(
      loadRecipes()
        .filter((recipe) => recipe.isSample)
        .map((recipe) => recipe.id),
    );
    return loadMealPlans().some((plan) =>
      plan.days.some((day) =>
        day.items.some(
          (item) => item.recipeId !== null && sampleIds.has(item.recipeId),
        ),
      ),
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">設定</h1>
      </header>

      <button
        type="button"
        onClick={() => setShowAccount((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl bg-surface-container-lowest px-4 py-3 ring-1 ring-outline-variant"
      >
        <div className="text-left">
          <p className="text-sm font-semibold">{getDataModeLabel(mode)}</p>
          <p className="text-xs text-on-surface-variant">
            {household?.name ?? "アカウント・同期"}
          </p>
        </div>
        <span className="text-xs text-primary">{showAccount ? "▲" : "▼"}</span>
      </button>

      {showAccount ? (
        <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
          {!supabaseConfigured ? (
            <p className="text-sm text-on-surface-variant">
              端末保存モードです
            </p>
          ) : !ready ? null : !session ? (
            <Link
              href="/login"
              className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
            >
              ログイン
            </Link>
          ) : !household ? (
            <Link
              href="/setup-household"
              className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
            >
              家庭を設定
            </Link>
          ) : (
            <>
              <p className="text-sm">{profile?.displayName || "未設定"}</p>
              <p className="text-xs text-on-surface-variant">{user?.email}</p>
              {lastPulledAt ? (
                <p className="text-xs text-on-surface-variant">
                  同期 {new Date(lastPulledAt).toLocaleString("ja-JP")}
                </p>
              ) : null}
              {lastSyncError ? (
                <p className="text-sm text-error">{lastSyncError}</p>
              ) : null}
              <button
                type="button"
                disabled={syncing}
                onClick={() => {
                  void pullLatest().then((result) => {
                    setMessage(
                      result ? "取得しました" : "取得に失敗しました",
                    );
                  });
                }}
                className="w-full rounded-xl bg-secondary-container px-3 py-2.5 text-sm font-semibold text-on-secondary-container disabled:opacity-50"
              >
                {syncing ? "同期中…" : "最新データを取得"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void signOut().catch((error) =>
                    setMessage(toUserFacingError(error)),
                  );
                }}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-medium text-error"
              >
                ログアウト
              </button>
            </>
          )}
        </section>
      ) : null}

      <SettingsGroup title="家族・プロフィール">
        <SettingsLinkRow
          href="/settings/family-profiles"
          title="家族・プロフィール"
        />
      </SettingsGroup>

      <SettingsGroup title="献立・料理">
        <SettingsLinkRow href="/nutrition" title="栄養バランス" />
        <SettingsLinkRow
          href="/settings/weekly-schedule"
          title="週間調理スケジュール"
        />
        <SettingsLinkRow
          href="/settings/cooking-members"
          title="調理担当"
        />
      </SettingsGroup>

      <SettingsGroup title="家庭設定">
        <SettingsLinkRow href="/settings/family" title="家族共有" />
        <SettingsLinkRow
          href="/settings/store-budget"
          title="買い物先・食費予算"
        />
        <SettingsLinkRow href="/food-expenses" title="食費レポート" />
        <SettingsLinkRow
          href="/settings/ingredient-prices"
          title="食材価格"
        />
        <SettingsLinkRow href="/settings/pantry" title="常備品" />
      </SettingsGroup>

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => setShowSamples((v) => !v)}
          className="flex w-full items-center justify-between px-0.5"
        >
          <h2 className="text-base font-semibold">サンプルレシピ</h2>
          <span className="text-xs text-primary">{showSamples ? "▲" : "▼"}</span>
        </button>
        {showSamples ? (
          <div className="space-y-2 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
            <button
              type="button"
              onClick={() => {
                const count = resetSampleRecipes();
                setMessage(`サンプルを ${count} 件入れ直しました`);
              }}
              className="w-full rounded-xl bg-secondary-container px-3 py-2.5 text-sm font-semibold text-on-secondary-container"
            >
              入れ直す
            </button>
            <button
              type="button"
              onClick={() => {
                if (samplesInUse()) {
                  const ok = window.confirm(
                    "献立で使われています。削除しますか？",
                  );
                  if (!ok) return;
                }
                const removed = removeSampleRecipes();
                setMessage(`${removed} 件削除しました`);
              }}
              className="w-full rounded-xl px-3 py-2.5 text-sm font-medium text-error ring-1 ring-error/30"
            >
              削除
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => setShowMaintenance((v) => !v)}
          className="flex w-full items-center justify-between px-0.5"
        >
          <h2 className="text-base font-semibold">メンテナンス</h2>
          <span className="text-xs text-primary">
            {showMaintenance ? "▲" : "▼"}
          </span>
        </button>
        {showMaintenance ? (
          <div className="space-y-2 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
            <button
              type="button"
              onClick={() => {
                const ok = window.confirm("全レシピの栄養を再計算しますか？");
                if (!ok) return;
                const result = recalculateAllRecipeNutrition();
                setMessage(
                  `再計算: 反映${result.calculated} / 全${result.total}`,
                );
              }}
              className="w-full rounded-xl bg-secondary-container px-3 py-2.5 text-sm font-semibold text-on-secondary-container"
            >
              栄養再計算
            </button>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("調理適性を再判定しますか？")) return;
                const recipes = loadRecipes();
                replaceRecipes(
                  recipes.map((recipe) => ({
                    ...recipe,
                    cookingProfile: estimateRecipeCookingProfile(
                      recipe,
                      recipe.cookingProfile,
                    ),
                    updatedAt: new Date().toISOString(),
                  })),
                );
                setMessage(`${recipes.length}件を再判定しました`);
              }}
              className="w-full rounded-xl bg-secondary-container px-3 py-2.5 text-sm font-semibold text-on-secondary-container"
            >
              調理適性再判定
            </button>
            <p className="text-xs text-on-surface-variant">v{APP_VERSION}</p>
          </div>
        ) : null}
      </section>

      {message ? (
        <p className="text-sm text-on-surface-variant" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
