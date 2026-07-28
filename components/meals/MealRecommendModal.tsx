"use client";

import { useMemo, useState } from "react";
import {
  recommendRecipesForSlot,
  type RecommendCandidate,
  type RecommendTabId,
} from "@/lib/weekly-auto-plan/recommend";
import { collectRecentRecipeIds, loadMealPlans } from "@/lib/meal-plans";
import type { DayMeal } from "@/types/meal-plan";
import type { MealPlanTagId } from "@/types/meal-plan-tags";
import type { InventoryItem } from "@/types/inventory";
import type { Recipe } from "@/types/recipe";
import type { WeeklyAutoCourse } from "@/types/weekly-meal-plan";
import { formatCourseLabel } from "@/types/course";
import type { MealSelectionReason } from "@/types/meal-decision-explanation";

const TABS: { id: RecommendTabId; label: string }[] = [
  { id: "recommend", label: "おすすめ" },
  { id: "all", label: "その他すべて" },
  { id: "favorite", label: "お気に入り" },
  { id: "not_recent", label: "最近作っていない" },
];

type MealRecommendModalProps = {
  weekStart: string;
  date: string;
  course: WeeklyAutoCourse;
  days: DayMeal[];
  recipes: Recipe[];
  inventory: InventoryItem[];
  planTags: readonly MealPlanTagId[];
  householdId: string;
  excludeRecipeId?: string | null;
  onSelect: (
    recipe: Recipe,
    reasons: string[],
    decisionExplanation: MealSelectionReason,
  ) => void;
  onClose: () => void;
};

function Stars({ count }: { count: number }) {
  const filled = Math.min(5, Math.max(1, count));
  return (
    <span className="tracking-tight text-amber-600" aria-label={`${filled}つ星`}>
      {"★".repeat(filled)}
      {"☆".repeat(5 - filled)}
    </span>
  );
}

function CandidateRow({
  candidate,
  featured = false,
  onPick,
}: {
  candidate: RecommendCandidate;
  featured?: boolean;
  onPick: () => void;
}) {
  const reasonMessages = candidate.decisionExplanation.reasons
    .slice(0, featured ? 4 : 3)
    .map((r) => r.message);

  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={`w-full rounded-2xl px-4 py-3 text-left ring-1 transition ${
          featured
            ? "bg-primary/5 ring-primary/40"
            : candidate.compatible
              ? "bg-surface-container-lowest ring-outline-variant hover:bg-surface-container"
              : "bg-surface-container/80 ring-outline-variant opacity-80"
        }`}
      >
        {featured ? (
          <p className="mb-1 text-xs font-bold text-primary">✨ AIイチオシ</p>
        ) : null}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs">
              <Stars count={candidate.stars} />
            </p>
            <p
              className={`mt-0.5 truncate text-base font-semibold ${
                candidate.compatible
                  ? "text-on-surface"
                  : "text-on-surface-variant line-through"
              }`}
            >
              {candidate.recipe.name}
            </p>
          </div>
          <span className="shrink-0 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary">
            決定
          </span>
        </div>
        <div className="mt-2">
          <p className="text-[11px] font-medium text-on-surface-variant">
            理由
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-on-surface-variant">
            {reasonMessages.map((message) => (
              <li key={message}>・{message}</li>
            ))}
          </ul>
        </div>
      </button>
    </li>
  );
}

/**
 * 料理追加 → おすすめ候補 → 決定（3タップ）
 */
export function MealRecommendModal({
  weekStart,
  date,
  course,
  days,
  recipes,
  inventory,
  planTags,
  householdId,
  excludeRecipeId,
  onSelect,
  onClose,
}: MealRecommendModalProps) {
  const [tab, setTab] = useState<RecommendTabId>("recommend");
  const [query, setQuery] = useState("");

  const recentRecipeIds = useMemo(
    () => collectRecentRecipeIds(loadMealPlans(), weekStart),
    [weekStart],
  );

  const candidates = useMemo(() => {
    const list = recommendRecipesForSlot({
      weekStart,
      date,
      course,
      days,
      recipes,
      inventory,
      planTags,
      householdId,
      recentRecipeIds,
      excludeRecipeId,
      tab,
      limit: tab === "all" ? 120 : 15,
    });
    const q = query.trim().toLowerCase();
    if (!q || tab !== "all") return list;
    return list.filter(
      (c) =>
        c.recipe.name.toLowerCase().includes(q) ||
        c.recipe.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [
    weekStart,
    date,
    course,
    days,
    recipes,
    inventory,
    planTags,
    householdId,
    recentRecipeIds,
    excludeRecipeId,
    tab,
    query,
  ]);

  const featured =
    tab === "recommend" ? candidates.find((c) => c.isAiPick) ?? candidates[0] : null;
  const rest = featured
    ? candidates.filter((c) => c.recipe.id !== featured.recipe.id)
    : candidates;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="おすすめ候補"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-surface shadow-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
          <div>
            <h2 className="text-lg font-bold">おすすめ候補</h2>
            <p className="text-xs text-on-surface-variant">
              {formatCourseLabel(course)} · タップで決定
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm font-medium text-on-surface-variant"
          >
            閉じる
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-outline-variant px-3 py-2">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                tab === entry.id
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {tab === "all" ? (
          <div className="border-b border-outline-variant px-4 py-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="レシピ名で検索"
              className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm outline-none ring-1 ring-outline-variant focus:ring-primary"
            />
          </div>
        ) : null}

        <div className="overflow-y-auto px-4 py-3">
          {candidates.length === 0 ? (
            <p className="py-8 text-center text-sm text-on-surface-variant">
              候補がありません。「その他すべて」から選んでください。
            </p>
          ) : (
            <ul className="space-y-3 pb-6">
              {featured ? (
                <CandidateRow
                  key={`featured-${featured.recipe.id}`}
                  candidate={featured}
                  featured
                  onPick={() =>
                    onSelect(
                      featured.recipe,
                      featured.decisionExplanation.reasons.map((r) => r.message),
                      featured.decisionExplanation,
                    )
                  }
                />
              ) : null}
              {rest.map((candidate) => (
                <CandidateRow
                  key={candidate.recipe.id}
                  candidate={candidate}
                  onPick={() =>
                    onSelect(
                      candidate.recipe,
                      candidate.decisionExplanation.reasons.map((r) => r.message),
                      candidate.decisionExplanation,
                    )
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
