"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DiabetesMealSupportPanel } from "@/components/meals/DiabetesMealSupportPanel";
import { LeftoverIngredientsPanel } from "@/components/meals/LeftoverIngredientsPanel";
import { MealPlanPreferencesPanel } from "@/components/meals/MealPlanPreferencesPanel";
import { WeeklyMealBoard } from "@/components/meals/WeeklyMealBoard";
import { getWeekStart, shiftWeek } from "@/lib/date";
import {
  clearMealPlanWeek,
  moveOrSwapDishBetweenDays,
  removeDishItem,
  toggleDayLocked,
  toggleSlotLocked,
} from "@/lib/meal-plans";
import { createOrRegenerateShoppingList } from "@/lib/shopping-lists";
import { useInventory } from "@/lib/use-inventory";
import { useIsClient } from "@/lib/use-is-client";
import { useMealPlan } from "@/lib/use-meal-plans";
import { useHouseholdPreferences } from "@/lib/use-meal-preferences";
import { useRecipes } from "@/lib/use-recipes";
import { useShoppingList } from "@/lib/use-shopping-lists";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import { applyWeeklyAutoPlan } from "@/lib/weekly-auto-plan";
import { WEEKLY_AUTO_COURSES } from "@/types/weekly-meal-plan";
import type { WeeklyPlanUiStatus } from "@/types/weekly-meal-plan";

export function MealPlanPage() {
  const isClient = useIsClient();
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<WeeklyPlanUiStatus>("idle");
  const [generating, setGenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const generatingRef = useRef(false);
  const plan = useMealPlan(weekStart);
  const recipes = useRecipes();
  const inventory = useInventory();
  const shoppingList = useShoppingList(weekStart);
  const { preferences, save: savePreferences } = useHouseholdPreferences();
  const { household } = useFamilySession();

  if (!isClient) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  const filledSlots = plan.days.reduce((count, day) => {
    return (
      count +
      day.items.filter(
        (item) =>
          item.recipeId &&
          WEEKLY_AUTO_COURSES.includes(
            item.course as (typeof WEEKLY_AUTO_COURSES)[number],
          ),
      ).length
    );
  }, 0);
  const totalSlots = 7 * WEEKLY_AUTO_COURSES.length;
  const emptySlots = totalSlots - filledSlots;

  function runGenerate(
    scope:
      | { type: "week" }
      | { type: "day"; date: string }
      | {
          type: "slot";
          date: string;
          course: (typeof WEEKLY_AUTO_COURSES)[number];
          slotId?: string;
        },
  ): void {
    if (generatingRef.current || generating) return;
    if (recipes.length === 0) {
      setStatus("no_recipes");
      setMessage("保存済みレシピがありません。先にレシピを登録してください。");
      return;
    }

    generatingRef.current = true;
    setGenerating(true);
    setStatus("generating");
    setMessage("今週の献立を作成しています…");

    window.setTimeout(() => {
      try {
        const result = applyWeeklyAutoPlan({
          weekStart,
          recipes,
          inventory,
          scope,
        });
        if (result.emptySlotCount > 0) {
          setStatus("partial_empty");
          setMessage(
            `献立を作成しました（${result.filledCount}枠）。候補不足で空き枠が${result.emptySlotCount}あります。`,
          );
        } else {
          setStatus("success");
          setMessage(`献立を作成しました（${result.filledCount}枠）。`);
        }
      } catch {
        setStatus("save_failed");
        setMessage("献立の保存に失敗しました。もう一度お試しください。");
      } finally {
        generatingRef.current = false;
        setGenerating(false);
      }
    }, 0);
  }

  function handleCreateShoppingList(): void {
    const hasRecipeItems = plan.days.some((day) =>
      day.items.some((item) => item.recipeId !== null),
    );
    if (!hasRecipeItems) {
      setMessage("献立にレシピがありません。先に「今週の献立を作る」を押してください。");
      return;
    }

    if (shoppingList) {
      const confirmed = window.confirm(
        "献立から買い物リストを再生成します。チェック済み（家にある）項目は可能な限り維持されます。",
      );
      if (!confirmed) return;
    }

    try {
      createOrRegenerateShoppingList(plan, recipes);
      setStatus("save_success");
      setMessage("買い物リストを作成しました。");
      router.push(`/shopping?week=${weekStart}`);
    } catch {
      setStatus("save_failed");
      setMessage("買い物リストの保存に失敗しました。");
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">週間献立</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            保存済みレシピから、主菜・副菜・汁物を自動で組みます
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setWeekStart((current) => shiftWeek(current, -1));
              setMessage(null);
              setStatus("idle");
            }}
            className="rounded-xl px-3 py-2 text-sm font-medium text-primary hover:bg-secondary-container"
          >
            ← 前の週
          </button>
          <p className="text-sm font-medium text-on-surface">
            {weekStart.split("-").join("/")} 週
          </p>
          <button
            type="button"
            onClick={() => {
              setWeekStart((current) => shiftWeek(current, 1));
              setMessage(null);
              setStatus("idle");
            }}
            className="rounded-xl px-3 py-2 text-sm font-medium text-primary hover:bg-secondary-container"
          >
            次の週 →
          </button>
        </div>

        {recipes.length === 0 ? (
          <div className="rounded-2xl bg-error-container p-4 text-sm text-error">
            <p className="font-semibold">レシピがまだありません</p>
            <p className="mt-1">自動編成には保存済みレシピが必要です。</p>
            <Link
              href="/recipes/new"
              className="mt-3 inline-block font-semibold underline"
            >
              レシピを登録する
            </Link>
          </div>
        ) : null}

        <button
          type="button"
          disabled={generating || recipes.length === 0}
          onClick={() => runGenerate({ type: "week" })}
          className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary shadow-sm disabled:opacity-60"
        >
          {generating ? "作成中…" : "今週の献立を作る"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={generating || recipes.length === 0}
            onClick={() => runGenerate({ type: "week" })}
            className="rounded-2xl px-3 py-3 text-sm font-medium text-primary ring-1 ring-outline-variant disabled:opacity-60"
          >
            週間を再生成
          </button>
          <button
            type="button"
            onClick={handleCreateShoppingList}
            className="rounded-2xl bg-secondary-container px-3 py-3 text-sm font-semibold text-on-secondary-container"
          >
            買い物リスト作成
          </button>
        </div>

        <Link
          href={`/shopping?week=${weekStart}`}
          className="block w-full rounded-2xl px-4 py-3 text-center text-sm font-medium text-primary ring-1 ring-outline-variant"
        >
          買い物リストを開く
        </Link>

        <Link
          href="/settings/health-nutrition"
          className="block w-full rounded-2xl px-4 py-3 text-center text-sm font-medium text-primary ring-1 ring-outline-variant"
        >
          健康・栄養設定（糖尿病配慮）
        </Link>

        <DiabetesMealSupportPanel plan={plan} recipes={recipes} />

        {status === "generating" || message ? (
          <p className="text-sm text-on-surface-variant" role="status">
            {message}
            {status === "partial_empty"
              ? `（空き ${emptySlots} / ${totalSlots}）`
              : null}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setShowAdvanced((value) => !value)}
          className="text-xs font-medium text-on-surface-variant"
        >
          {showAdvanced ? "詳細設定を閉じる" : "詳細設定（好み・余り食材）"}
        </button>

        {showAdvanced ? (
          <div className="space-y-3 rounded-2xl bg-surface-container p-3">
            <MealPlanPreferencesPanel
              preferences={preferences}
              onChange={(patch) => {
                savePreferences(patch);
              }}
            />
            <LeftoverIngredientsPanel householdId={household?.id ?? "local"} />
            <p className="text-xs text-on-surface-variant">
              旧エンジン（栄養・生活スタイル重視）の詳細提案は今後の拡張予定です。現在はルールベースの自動編成が主力です。
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (!window.confirm("この週の献立をすべて削除します。よろしいですか？")) {
              return;
            }
            clearMealPlanWeek(plan.weekStart);
            setStatus("idle");
            setMessage("この週の献立をクリアしました");
          }}
          className="w-full rounded-2xl border-2 border-error bg-error-container px-4 py-3 text-sm font-semibold text-error"
        >
          献立を一括クリア
        </button>
      </header>

      <WeeklyMealBoard
        days={plan.days}
        recipes={recipes}
        onToggleDayLock={(date) => {
          toggleDayLocked(weekStart, date);
          setMessage(null);
        }}
        onToggleSlotLock={(date, itemId) => {
          toggleSlotLocked(weekStart, date, itemId);
          setMessage(null);
        }}
        onRegenerateDay={(date) => runGenerate({ type: "day", date })}
        onRegenerateSlot={(date, course, slotId) =>
          runGenerate({ type: "slot", date, course, slotId })
        }
        onRemoveItem={(date, itemId) => {
          removeDishItem(weekStart, date, itemId);
          setMessage(null);
        }}
        onMoveOrSwap={(fromDate, toDate, itemId, targetItemId) => {
          moveOrSwapDishBetweenDays(
            weekStart,
            fromDate,
            toDate,
            itemId,
            targetItemId,
          );
          setMessage("料理を移動しました");
        }}
      />
    </div>
  );
}
