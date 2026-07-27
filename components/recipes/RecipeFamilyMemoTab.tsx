"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { loadCookingHistory } from "@/lib/cooking-history";
import { loadFamilyMemberProfiles } from "@/lib/family-member-profiles";
import { getFeedbacksForRecipe } from "@/lib/recipe-learning/cooking-feedbacks";
import { getVariantsForParent } from "@/lib/recipe-learning/recipe-variants";
import {
  canCreateFamilyVariant,
  createFamilyRecipeVariant,
} from "@/lib/recipe-learning/service";
import { computeRecipeLearningStats } from "@/lib/recipe-learning/stats";
import { getImprovementTagById } from "@/types/recipe-learning";
import { formatStars } from "@/lib/recipe-nutrition";
import type { Recipe } from "@/types/recipe";

type RecipeFamilyMemoTabProps = {
  recipe: Recipe;
  householdId: string;
};

export function RecipeFamilyMemoTab({
  recipe,
  householdId,
}: RecipeFamilyMemoTabProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const members = useMemo(() => loadFamilyMemberProfiles(), []);

  const stats = useMemo(() => {
    void tick;
    return computeRecipeLearningStats(recipe.id);
  }, [recipe.id, tick]);

  const feedbacks = useMemo(() => {
    void tick;
    return getFeedbacksForRecipe(recipe.id);
  }, [recipe.id, tick]);

  const histories = useMemo(() => {
    void tick;
    return loadCookingHistory()
      .filter((h) => h.recipeId === recipe.id)
      .sort((a, b) => b.cookedAt.localeCompare(a.cookedAt));
  }, [recipe.id, tick]);

  const variants = useMemo(() => {
    void tick;
    return getVariantsForParent(recipe.id);
  }, [recipe.id, tick]);

  function handleCreateVariant(): void {
    const variant = createFamilyRecipeVariant({
      parentRecipeId: recipe.id,
      householdId,
    });
    if (!variant) {
      setMessage("我が家版を作成できませんでした");
      return;
    }
    setMessage(`「${variant.title}」を作成しました`);
    setTick((n) => n + 1);
  }

  const avgStars =
    stats.averageRating != null
      ? Math.max(1, Math.min(5, Math.round(stats.averageRating)))
      : null;
  const wantAgainPercent =
    stats.wantAgainRate != null
      ? Math.round(stats.wantAgainRate * 100)
      : null;
  const popularMembers = stats.popularMemberIds
    .map(
      (id) => members.find((m) => m.id === id)?.displayName ?? id,
    )
    .slice(0, 3);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-lg font-semibold">家族評価</h2>
        <p className="mt-2 text-2xl text-primary">
          {avgStars != null ? formatStars(avgStars) : "未評価"}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-on-surface-variant">作成回数</dt>
            <dd className="font-semibold">{stats.cookCount}回</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">また作る率</dt>
            <dd className="font-semibold">
              {wantAgainPercent != null ? `${wantAgainPercent}%` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">最後に作った日</dt>
            <dd className="font-semibold">
              {stats.lastCookedAt
                ? new Date(stats.lastCookedAt).toLocaleDateString("ja-JP")
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">改善回数</dt>
            <dd className="font-semibold">{stats.improvementCount}</dd>
          </div>
        </dl>
        {popularMembers.length > 0 ? (
          <p className="mt-2 text-xs text-on-surface-variant">
            人気メンバー: {popularMembers.join("・")}
          </p>
        ) : null}
      </div>

      {stats.recentImprovementLabels.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-semibold">最近の改善</h3>
          <ul className="flex flex-wrap gap-2">
            {stats.recentImprovementLabels.map((label) => (
              <li
                key={label}
                className="rounded-lg bg-secondary-container px-2.5 py-1 text-xs font-medium text-on-secondary-container"
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {stats.popularTagIds.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-semibold">人気タグ</h3>
          <ul className="flex flex-wrap gap-2">
            {stats.popularTagIds.map((tagId) => (
              <li
                key={tagId}
                className="rounded-full bg-surface-container px-2.5 py-1 text-xs"
              >
                {getImprovementTagById(tagId)?.label ?? tagId}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="font-semibold">履歴</h3>
        {feedbacks.length === 0 && histories.length === 0 ? (
          <p className="text-sm text-on-surface-variant">まだありません</p>
        ) : (
          <ul className="space-y-2">
            {feedbacks.slice(0, 12).map((feedback) => {
              const labels = [
                ...feedback.improvementTags.map(
                  (id) => getImprovementTagById(id)?.label ?? id,
                ),
                ...feedback.adjustments.map((a) =>
                  a.afterValue
                    ? `${a.ingredientName}${a.afterValue}`
                    : a.ingredientName,
                ),
                ...feedback.seasoningAdjustments.map((s) =>
                  s.afterAmount
                    ? `${s.seasoning}${s.afterAmount}`
                    : s.seasoning,
                ),
              ].slice(0, 3);
              return (
                <li
                  key={feedback.id}
                  className="rounded-xl bg-surface-container px-3 py-2 text-sm"
                >
                  <p className="text-xs text-on-surface-variant">
                    {new Date(feedback.cookedAt).toLocaleDateString("ja-JP")}
                  </p>
                  <p className="mt-0.5">
                    {feedback.overallRating != null
                      ? formatStars(feedback.overallRating)
                      : "評価なし"}
                  </p>
                  {labels.length > 0 ? (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {labels.join(" · ")}
                    </p>
                  ) : null}
                  {feedback.memo ? (
                    <p className="mt-1 text-xs">{feedback.memo}</p>
                  ) : null}
                  {feedback.photoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={feedback.photoDataUrl}
                      alt="完成写真"
                      className="mt-2 max-h-28 rounded-lg object-cover"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {recipe.parentRecipeId ? (
        <p className="text-sm">
          元レシピ:{" "}
          <Link
            href={`/recipes/${recipe.parentRecipeId}`}
            className="font-medium text-primary"
          >
            親レシピを開く
          </Link>
        </p>
      ) : null}

      {variants.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-semibold">我が家版</h3>
          <ul className="space-y-1 text-sm">
            {variants.map((variant) => (
              <li key={variant.id}>
                <Link
                  href={`/recipes/${variant.variantRecipeId}`}
                  className="font-medium text-primary"
                >
                  {variant.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!recipe.isFamilyVariant ? (
        <button
          type="button"
          disabled={!canCreateFamilyVariant(recipe.id)}
          onClick={handleCreateVariant}
          className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary disabled:opacity-50"
        >
          我が家版レシピを作成
        </button>
      ) : null}
      {message ? (
        <p className="text-sm text-on-surface-variant" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
