"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CompactMenu } from "@/components/meals/CompactMenu";
import { DiabetesMealSupportPanel } from "@/components/meals/DiabetesMealSupportPanel";
import { LeftoverIngredientsPanel } from "@/components/meals/LeftoverIngredientsPanel";
import { MealPlanPreferencesPanel } from "@/components/meals/MealPlanPreferencesPanel";
import { WeekBudgetSummaryPanel } from "@/components/meals/WeekBudgetSummary";
import { WeeklyMealBoard } from "@/components/meals/WeeklyMealBoard";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import { FirstVisitTip, HelpButton } from "@/components/ui/FirstVisitTip";
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
import { applyWeeklyAutoPlan } from "@/lib/weekly-auto-plan";
import { WEEKLY_AUTO_COURSES } from "@/types/weekly-meal-plan";
import type { WeeklyPlanUiStatus } from "@/types/weekly-meal-plan";

const HELP_SEEN_KEY = "meal-planner:mealsHelpSeen";

export function MealPlanPage() {
  const isClient = useIsClient();
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<WeeklyPlanUiStatus>("idle");
  const [generating, setGenerating] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showHealthBudget, setShowHealthBudget] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const generatingRef = useRef(false);
  const plan = useMealPlan(weekStart);
  const recipes = useRecipes();
  const inventory = useInventory();
  const shoppingList = useShoppingList(weekStart);
  const { preferences, save: savePreferences } = useHouseholdPreferences();
  const { household } = useFamilySession();

  useEffect(() => {
    if (!isClient) return;
    queueMicrotask(() => {
      if (window.localStorage.getItem(HELP_SEEN_KEY) !== "true") {
        setShowHelp(true);
      }
    });
  }, [isClient]);

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
      setMessage("レシピがありません");
      return;
    }

    generatingRef.current = true;
    setGenerating(true);
    setStatus("generating");
    setMessage("作成中…");

    window.setTimeout(() => {
      try {
        const result = applyWeeklyAutoPlan({
          weekStart,
          recipes,
          inventory,
          scope,
        });
        if (result.filledCount === 0) {
          setStatus("partial_empty");
          setMessage(result.warnings[0] ?? "入れられる料理がありません");
        } else if (result.emptySlotCount > 0) {
          setStatus("partial_empty");
          setMessage(
            `作成しました（空き${result.emptySlotCount}）`,
          );
        } else {
          setStatus("success");
          setMessage("作成しました");
        }
      } catch {
        setStatus("save_failed");
        setMessage("保存に失敗しました");
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
      setMessage("先に「今週の献立を作る」を押してください");
      return;
    }

    if (shoppingList) {
      const confirmed = window.confirm("買い物リストを再生成しますか？");
      if (!confirmed) return;
    }

    try {
      createOrRegenerateShoppingList(plan, recipes);
      setStatus("save_success");
      setMessage("買い物リストを作成しました");
      router.push(`/shopping?week=${weekStart}`);
    } catch {
      setStatus("save_failed");
      setMessage("買い物リストの保存に失敗しました");
    }
  }

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">週間献立</h1>
            <p className="text-sm text-on-surface-variant">
              {weekStart.split("-").join("/")} 週
            </p>
          </div>
          <div className="flex items-center gap-1">
            <HelpButton onClick={() => setShowHelp(true)} />
            <CompactMenu
              label="その他"
              trigger={<span className="text-sm font-medium">その他</span>}
              items={[
                {
                  id: "prev",
                  label: "前の週",
                  onClick: () => {
                    setWeekStart((current) => shiftWeek(current, -1));
                    setMessage(null);
                    setStatus("idle");
                  },
                },
                {
                  id: "next",
                  label: "次の週",
                  onClick: () => {
                    setWeekStart((current) => shiftWeek(current, 1));
                    setMessage(null);
                    setStatus("idle");
                  },
                },
                {
                  id: "regen",
                  label: "週間を再生成",
                  onClick: () => runGenerate({ type: "week" }),
                  disabled: generating || recipes.length === 0,
                },
                {
                  id: "shopping-create",
                  label: "買い物リスト作成",
                  onClick: handleCreateShoppingList,
                },
                {
                  id: "shopping-open",
                  label: "買い物リストを開く",
                  onClick: () => router.push(`/shopping?week=${weekStart}`),
                },
                {
                  id: "health-budget",
                  label: showHealthBudget
                    ? "健康・予算を閉じる"
                    : "健康・予算",
                  onClick: () => setShowHealthBudget((v) => !v),
                },
                {
                  id: "health-settings",
                  label: "健康設定",
                  onClick: () =>
                    router.push("/settings/family-profiles?section=health"),
                },
                {
                  id: "advanced",
                  label: showAdvanced ? "詳細設定を閉じる" : "詳細設定",
                  onClick: () => setShowAdvanced((value) => !value),
                },
                {
                  id: "clear",
                  label: "献立を一括クリア",
                  danger: true,
                  onClick: () => {
                    if (!window.confirm("この週の献立をすべて削除しますか？")) {
                      return;
                    }
                    clearMealPlanWeek(plan.weekStart);
                    setStatus("idle");
                    setMessage("クリアしました");
                  },
                },
              ]}
            />
          </div>
        </div>

        {showHelp ? (
          <FirstVisitTip
            storageKey={HELP_SEEN_KEY}
            title="使い方"
            forceOpen={showHelp}
            onForceClose={() => setShowHelp(false)}
          >
            「今週の献立を作る」で主菜・副菜・汁物を組みます。ロックや再生成は各カードの⋯から。
          </FirstVisitTip>
        ) : null}

        {recipes.length === 0 ? (
          <Link
            href="/recipes/new"
            className="block rounded-2xl bg-secondary-container px-3 py-3 text-center text-sm font-semibold text-on-secondary-container"
          >
            レシピを登録する
          </Link>
        ) : null}

        <button
          type="button"
          disabled={generating || recipes.length === 0}
          onClick={() => runGenerate({ type: "week" })}
          className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary shadow-sm disabled:opacity-60"
        >
          {generating ? "作成中…" : "今週の献立を作る"}
        </button>

        {message ? (
          <p className="text-sm text-on-surface-variant" role="status">
            {message}
            {status === "partial_empty"
              ? `（空き ${emptySlots}/${totalSlots}）`
              : null}
          </p>
        ) : null}
      </header>

      {/* 献立をすぐ見せる */}
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
          setMessage("移動しました");
        }}
      />

      {showHealthBudget ? (
        <div className="space-y-3">
          <DiabetesMealSupportPanel plan={plan} recipes={recipes} />
          <WeekBudgetSummaryPanel
            mealPlan={plan}
            recipes={recipes}
            inventory={inventory}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowHealthBudget(true)}
          className="w-full rounded-xl bg-surface-container px-3 py-2.5 text-sm font-medium text-on-surface-variant"
        >
          ▼ 健康・予算
        </button>
      )}

      {showAdvanced ? (
        <div className="space-y-3 rounded-2xl bg-surface-container p-3">
          <MealPlanPreferencesPanel
            preferences={preferences}
            onChange={(patch) => {
              savePreferences(patch);
            }}
          />
          <LeftoverIngredientsPanel householdId={household?.id ?? "local"} />
        </div>
      ) : null}
    </div>
  );
}
