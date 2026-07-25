"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { loadCookingHistory } from "@/lib/cooking-history";
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

  return (
    <section className="space-y-5">
      <div className="rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-lg font-semibold">我が家メモ</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          作るたびに蓄積される、この家庭だけのノウハウです
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-on-surface-variant">平均評価</dt>
            <dd className="font-semibold">
              {avgStars != null ? (
                <>
                  <span className="text-primary">{formatStars(avgStars)}</span>
                  <span className="ml-1 text-xs">
                    ({stats.averageRating?.toFixed(1)})
                  </span>
                </>
              ) : (
                "まだなし"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">作った回数</dt>
            <dd className="font-semibold">{stats.cookCount}回</dd>
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
            <dt className="text-on-surface-variant">家族人気</dt>
            <dd className="font-semibold">
              {stats.familyFavoriteScore != null
                ? `${stats.familyFavoriteScore.toFixed(1)} / 5`
                : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">評価履歴</h3>
        {feedbacks.length === 0 ? (
          <p className="text-sm text-on-surface-variant">まだ評価がありません</p>
        ) : (
          <ul className="space-y-2">
            {feedbacks.slice(0, 10).map((feedback) => (
              <li
                key={feedback.id}
                className="rounded-xl bg-surface-container px-3 py-2 text-sm"
              >
                <p>
                  {feedback.overallRating != null
                    ? formatStars(feedback.overallRating)
                    : "評価なし"}
                  <span className="ml-2 text-xs text-on-surface-variant">
                    {new Date(feedback.createdAt).toLocaleString("ja-JP")}
                  </span>
                </p>
                {feedback.memberRatings.length > 0 ? (
                  <ul className="mt-1 text-xs text-on-surface-variant">
                    {feedback.memberRatings.map((member) => (
                      <li key={member.memberId}>
                        {member.memberName ?? "家族"}:{" "}
                        {formatStars(member.rating)}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {feedback.memo ? (
                  <p className="mt-1 text-xs">{feedback.memo}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">改善履歴</h3>
        {feedbacks.every((f) => f.improvementTags.length === 0) ? (
          <p className="text-sm text-on-surface-variant">
            改善タグはまだありません
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {[
              ...new Set(feedbacks.flatMap((f) => f.improvementTags)),
            ].map((tagId) => (
              <li
                key={tagId}
                className="rounded-lg bg-secondary-container px-2.5 py-1 text-xs font-medium text-on-secondary-container"
              >
                {getImprovementTagById(tagId)?.label ?? tagId}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-on-surface-variant">
          改善タグ数（累計）: {stats.improvementCount}
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">調理履歴</h3>
        {histories.length === 0 ? (
          <p className="text-sm text-on-surface-variant">履歴なし</p>
        ) : (
          <ul className="space-y-1 text-sm text-on-surface-variant">
            {histories.slice(0, 8).map((history) => (
              <li key={history.id}>
                {new Date(history.cookedAt).toLocaleString("ja-JP")}
                {history.servings != null ? `・${history.servings}人分` : ""}
                {history.wantAgain === true
                  ? "・また作る"
                  : history.wantAgain === false
                    ? "・また作らない"
                    : ""}
              </li>
            ))}
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
                <p className="text-xs text-on-surface-variant">
                  {variant.summary}
                </p>
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
