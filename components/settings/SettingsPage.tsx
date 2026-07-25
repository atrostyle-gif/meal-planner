"use client";

import Link from "next/link";
import { useState } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import { resetSampleRecipes, removeSampleRecipes, loadRecipes, replaceRecipes } from "@/lib/recipes";
import { estimateRecipeCookingProfile } from "@/lib/cooking-suitability";
import { loadMealPlans } from "@/lib/meal-plans";
import { recalculateAllRecipeNutrition } from "@/lib/nutrition/recalculate-all";
import {
  getDataModeLabel,
  hasSupabaseAnonKey,
  hasSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/env";
import { toUserFacingError } from "@/lib/supabase/errors";

const APP_VERSION = "0.1.0";
const IS_DEV = process.env.NODE_ENV === "development";

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
    migrateLocalToCloud,
    signOut,
  } = useFamilySession();
  const [message, setMessage] = useState<string | null>(null);
  const supabaseConfigured = isSupabaseConfigured();


  function samplesInUse(): boolean {
    const sampleIds = new Set(
      loadRecipes().filter((recipe) => recipe.isSample).map((recipe) => recipe.id),
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

      <section className="space-y-2 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-sm font-medium text-on-surface-variant">保存モード</h2>
        <p className="text-lg font-semibold">{getDataModeLabel(mode)}</p>
        <p className="text-xs text-on-surface-variant">
          Supabase: {isSupabaseConfigured() ? "設定済み" : "未設定"}
        </p>
        {IS_DEV ? (
          <div className="space-y-0.5 text-xs text-on-surface-variant">
            <p>URL: {hasSupabaseUrl() ? "設定あり" : "なし"}</p>
            <p>Key: {hasSupabaseAnonKey() ? "設定あり" : "なし"}</p>
          </div>
        ) : null}
        {lastPulledAt ? (
          <p className="text-xs text-on-surface-variant">
            最終同期: {new Date(lastPulledAt).toLocaleString("ja-JP")}
          </p>
        ) : null}
        {lastSyncError ? (
          <p className="text-sm text-error">{lastSyncError}</p>
        ) : null}
      </section>

      {!supabaseConfigured ? (
        <section className="space-y-2 rounded-2xl bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
          <p className="font-medium text-on-surface">開発者向け</p>
          <p>
            家族共有を有効にするには Supabase プロジェクトを作成し、
            NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を
            .env.local に設定してください。手順は docs/SUPABASE_SETUP.md にあります。
          </p>
        </section>
      ) : !ready ? null : !session ? (
        <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
          <p className="text-sm text-on-surface">
            家族共有を開始するにはログインしてください
          </p>
          <Link
            href="/login"
            className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
          >
            ログイン画面へ
          </Link>
        </section>
      ) : !household ? (
        <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
          <p className="text-sm text-on-surface">
            家庭を作成または招待コードで参加してください
          </p>
          <Link
            href="/setup-household"
            className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
          >
            家庭の設定へ
          </Link>
        </section>
      ) : (
        <section className="space-y-2 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
          <h2 className="text-sm font-medium text-on-surface-variant">アカウント</h2>
          <p className="text-base">{profile?.displayName || "未設定"}</p>
          <p className="text-sm text-on-surface-variant">{user?.email}</p>
          <p className="text-base font-medium">{household.name}</p>
          <Link
            href="/settings/family"
            className="inline-block text-sm font-medium text-primary"
          >
            家族設定へ
          </Link>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              disabled={syncing}
              onClick={() => {
                void pullLatest().then((result) => {
                  setMessage(
                    result
                      ? `最新データを取得しました（レシピ${result.recipes}件など）`
                      : "取得に失敗しました",
                  );
                });
              }}
              className="rounded-xl bg-secondary-container px-3 py-2.5 text-sm font-semibold text-on-secondary-container disabled:opacity-50"
            >
              最新データを取得
            </button>
            <button
              type="button"
              disabled={syncing || !household}
              onClick={() => {
                void migrateLocalToCloud().then((result) => {
                  if (!result) {
                    setMessage("家族共有へのコピーに失敗しました");
                    return;
                  }
                  const fail = result.errors.length;
                  const ok =
                    result.recipes +
                    result.mealPlans +
                    result.shoppingLists +
                    result.inventory +
                    result.pantry;
                  if (fail === 0) {
                    setMessage(
                      `家族共有へコピー完了: レシピ${result.recipes} / 献立${result.mealPlans} / 買い物${result.shoppingLists} / 冷蔵庫${result.inventory} / 常備品${result.pantry}`,
                    );
                    return;
                  }
                  setMessage(
                    `一部コピー完了（成功 ${ok}件 / 失敗 ${fail}件）: レシピ${result.recipes} / 献立${result.mealPlans} / 買い物${result.shoppingLists}`,
                  );
                });
              }}
              className="rounded-xl px-3 py-2.5 text-sm font-medium ring-1 ring-outline-variant disabled:opacity-50"
            >
              {syncing ? "コピー中…" : "この端末データを家族共有へコピー"}
            </button>
            <button
              type="button"
              onClick={() => {
                void signOut().catch((error) =>
                  setMessage(toUserFacingError(error)),
                );
              }}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-error"
            >
              ログアウト
            </button>
          </div>
        </section>
      )}

      <section className="space-y-2 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-sm font-medium text-on-surface-variant">家族・栄養</h2>
        <Link
          href="/settings/family-profiles"
          className="block text-sm font-medium text-primary"
        >
          家族プロフィール
        </Link>
        <Link href="/nutrition" className="block text-sm font-medium text-primary">
          栄養バランス
        </Link>
        <Link
          href="/settings/health-nutrition"
          className="block text-sm font-medium text-primary"
        >
          健康・栄養設定（糖尿病配慮）
        </Link>
        <Link href="/settings/family" className="block text-sm font-medium text-primary">
          家族共有・招待
        </Link>
        <Link href="/settings/lifestyle-setup" className="block text-sm font-medium text-primary">
          生活スタイル設定ガイド
        </Link>
        <Link href="/settings/weekly-schedule" className="block text-sm font-medium text-primary">
          週間の調理スケジュール
        </Link>
        <Link href="/settings/cooking-members" className="block text-sm font-medium text-primary">
          調理する人の設定
        </Link>
        <Link href="/settings/pantry" className="block text-sm font-medium text-primary">
          常備品
        </Link>
        <button
          type="button"
          onClick={() => {
            const ok = window.confirm(
              "全レシピの栄養情報を材料から再計算します。計算できた値は上書きされます（信頼度が低い場合は既存値を優先）。よろしいですか？",
            );
            if (!ok) return;
            const result = recalculateAllRecipeNutrition();
            setMessage(
              `再計算完了: 全${result.total}件 / 反映${result.calculated}件 / 一部${result.partial}件 / 未計算${result.uncalculated}件`,
            );
          }}
          className="w-full rounded-xl bg-secondary-container px-3 py-2.5 text-sm font-semibold text-on-secondary-container"
        >
          全レシピの栄養情報を再計算
        </button>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm("全レシピの調理適性を推定します。手動で設定した値は維持されます。よろしいですか？")) return;
            const recipes = loadRecipes();
            replaceRecipes(recipes.map((recipe) => ({
              ...recipe,
              cookingProfile: estimateRecipeCookingProfile(recipe, recipe.cookingProfile),
              updatedAt: new Date().toISOString(),
            })));
            setMessage(`${recipes.length}件のレシピの調理適性を推定しました`);
          }}
          className="w-full rounded-xl bg-secondary-container px-3 py-2.5 text-sm font-semibold text-on-secondary-container"
        >
          レシピの調理適性を一括推定
        </button>
        <p className="text-xs text-on-surface-variant">
          栄養値は概算です。適量・未登録材料は含まれません。医療判断には使いません。
        </p>
      </section>

      <section className="space-y-2 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-sm font-medium text-on-surface-variant">サンプルレシピ</h2>
        <button
          type="button"
          onClick={() => {
            const count = resetSampleRecipes();
            setMessage(`サンプルレシピを ${count} 件入れ直しました`);
          }}
          className="w-full rounded-xl bg-secondary-container px-3 py-2.5 text-sm font-semibold text-on-secondary-container"
        >
          サンプルレシピを追加（入れ直し）
        </button>
        <button
          type="button"
          onClick={() => {
            if (samplesInUse()) {
              const ok = window.confirm(
                "サンプルレシピが献立で使われています。削除すると献立の参照が切れます。削除しますか？",
              );
              if (!ok) {
                return;
              }
            }
            const removed = removeSampleRecipes();
            setMessage(`サンプルレシピを ${removed} 件削除しました`);
          }}
          className="w-full rounded-xl px-3 py-2.5 text-sm font-medium text-error ring-1 ring-error/30"
        >
          サンプルレシピを削除
        </button>
      </section>

      <section className="text-xs text-on-surface-variant">
        <p>アプリバージョン: {APP_VERSION}</p>
        <p>データ版: localStorage + optional Supabase</p>
      </section>

      {message ? (
        <p className="text-sm text-on-surface-variant" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
