"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useIsClient } from "@/lib/use-is-client";
import { loadCookingFeedbacks } from "@/lib/recipe-learning/cooking-feedbacks";
import { loadRecipes } from "@/lib/recipes";
import { getImprovementTagById } from "@/types/recipe-learning";

/**
 * レビュー結果の閲覧（設定変更はしない）。
 */
export function ReviewAnalysisPage() {
  const isClient = useIsClient();

  const summary = useMemo(() => {
    if (!isClient) return null;
    const feedbacks = loadCookingFeedbacks();
    const recipes = loadRecipes();
    const ratings = feedbacks
      .map((f) => f.overallRating)
      .filter((r): r is number => r != null);
    const avg =
      ratings.length > 0
        ? Math.round(
            (ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10,
          ) / 10
        : null;
    const wantYes = feedbacks.filter((f) => f.wantAgain === true).length;
    const wantNo = feedbacks.filter((f) => f.wantAgain === false).length;
    const wantTotal = wantYes + wantNo;
    const tagCounts = new Map<string, number>();
    for (const feedback of feedbacks) {
      for (const tagId of feedback.improvementTags) {
        tagCounts.set(tagId, (tagCounts.get(tagId) ?? 0) + 1);
      }
    }
    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, count]) => ({
        id,
        label: getImprovementTagById(id)?.label ?? id,
        count,
      }));

    const byRecipe = new Map<string, number[]>();
    for (const feedback of feedbacks) {
      if (feedback.overallRating == null) continue;
      const list = byRecipe.get(feedback.recipeId) ?? [];
      list.push(feedback.overallRating);
      byRecipe.set(feedback.recipeId, list);
    }
    const topRecipes = [...byRecipe.entries()]
      .map(([id, list]) => {
        const recipe = recipes.find((r) => r.id === id);
        return {
          id,
          name: recipe?.name ?? "不明な料理",
          avg: Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10,
          count: list.length,
        };
      })
      .filter((r) => r.count >= 1)
      .sort((a, b) => b.avg - a.avg || b.count - a.count)
      .slice(0, 5);

    return {
      total: feedbacks.length,
      avg,
      wantRate:
        wantTotal > 0 ? Math.round((wantYes / wantTotal) * 100) : null,
      topTags,
      topRecipes,
    };
  }, [isClient]);

  if (!isClient || !summary) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p>
          <Link href="/data" className="text-sm text-primary">
            ← データ
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight">レビュー分析</h1>
        <p className="text-sm text-on-surface-variant">
          調理後レビューの集計結果です
        </p>
      </header>

      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-surface-container-lowest px-3 py-3 ring-1 ring-outline-variant">
          <p className="text-[11px] text-on-surface-variant">件数</p>
          <p className="mt-1 text-xl font-bold">{summary.total}</p>
        </div>
        <div className="rounded-2xl bg-surface-container-lowest px-3 py-3 ring-1 ring-outline-variant">
          <p className="text-[11px] text-on-surface-variant">平均評価</p>
          <p className="mt-1 text-xl font-bold">
            {summary.avg != null ? `★${summary.avg}` : "—"}
          </p>
        </div>
        <div className="rounded-2xl bg-surface-container-lowest px-3 py-3 ring-1 ring-outline-variant">
          <p className="text-[11px] text-on-surface-variant">また作りたい</p>
          <p className="mt-1 text-xl font-bold">
            {summary.wantRate != null ? `${summary.wantRate}%` : "—"}
          </p>
        </div>
      </section>

      <section className="rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-base font-semibold">よく付くタグ</h2>
        {summary.topTags.length === 0 ? (
          <p className="mt-2 text-sm text-on-surface-variant">まだありません</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {summary.topTags.map((tag) => (
              <li
                key={tag.id}
                className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-medium"
              >
                {tag.label}（{tag.count}）
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-base font-semibold">評価の高い料理</h2>
        {summary.topRecipes.length === 0 ? (
          <p className="mt-2 text-sm text-on-surface-variant">まだありません</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {summary.topRecipes.map((recipe) => (
              <li
                key={recipe.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium">{recipe.name}</span>
                <span className="text-on-surface-variant">
                  ★{recipe.avg}（{recipe.count}）
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
