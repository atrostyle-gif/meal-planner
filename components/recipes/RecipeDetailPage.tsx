"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IngredientList } from "@/components/recipes/IngredientList";
import { StepList } from "@/components/recipes/StepList";
import { RecipeFamilyMemoTab } from "@/components/recipes/RecipeFamilyMemoTab";
import { findFoodMaster } from "@/lib/food-master/match";
import { loadFoodMasters } from "@/lib/food-master/store";
import {
  getCachedRecipeNutrition,
  nutritionSourceLabel,
} from "@/lib/nutrition/calculate";
import { formatStars } from "@/lib/recipe-nutrition";
import { useIsClient } from "@/lib/use-is-client";
import { useRecipe } from "@/lib/use-recipes";
import { formatCourseLabel } from "@/types/recipe";

type RecipeDetailPageProps = {
  recipeId: string;
};

type DetailTab = "recipe" | "family";

export function RecipeDetailPage({ recipeId }: RecipeDetailPageProps) {
  const isClient = useIsClient();
  const recipe = useRecipe(recipeId);
  const [tab, setTab] = useState<DetailTab>("recipe");

  const nutrition = useMemo(() => {
    if (!isClient || !recipe) return null;
    return getCachedRecipeNutrition(recipe, { masters: loadFoodMasters() });
  }, [isClient, recipe]);

  const ingredientMatches = useMemo(() => {
    if (!isClient || !recipe) return [];
    const masters = loadFoodMasters();
    return recipe.ingredients.map((ingredient) => {
      const match = findFoodMaster(ingredient.name, masters);
      return { ingredient, match };
    });
  }, [isClient, recipe]);

  if (!isClient) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  if (recipe === null) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">レシピが見つかりません</h1>
        <Link href="/recipes" className="text-sm font-medium text-primary">
          一覧へ戻る
        </Link>
      </div>
    );
  }

  const avgStars =
    recipe.averageRating != null
      ? Math.max(1, Math.min(5, Math.round(recipe.averageRating)))
      : null;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link href="/recipes" className="text-sm font-medium text-primary">
          ← 一覧へ戻る
        </Link>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight leading-tight">
            {recipe.name}
          </h1>
          {recipe.isFamilyVariant ? (
            <p className="text-sm text-primary">我が家版レシピ</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-secondary-container px-3 py-1 text-sm font-medium text-on-secondary-container">
              {recipe.category}
            </span>
            <span className="rounded-full bg-surface-container px-3 py-1 text-sm text-on-surface-variant">
              {formatCourseLabel(recipe.course)}
            </span>
            <span className="text-sm text-on-surface-variant">
              {recipe.servings}人分
            </span>
            {recipe.cookingTimeMinutes !== null ? (
              <span className="text-sm text-on-surface-variant">
                調理時間 {recipe.cookingTimeMinutes}分
              </span>
            ) : null}
          </div>
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-on-surface-variant">
            <div>
              <dt className="sr-only">家族評価</dt>
              <dd className="inline font-medium text-on-surface">
                {avgStars != null
                  ? `${formatStars(avgStars)}`
                  : "未評価"}
              </dd>
            </div>
            <div>
              <dt className="inline"> </dt>
              <dd className="inline font-medium text-on-surface">
                {recipe.cookCount ?? 0}回作成
              </dd>
            </div>
            {(recipe.wantAgainYes ?? 0) + (recipe.wantAgainNo ?? 0) > 0 ? (
              <div>
                <dt className="inline">また作る率 </dt>
                <dd className="inline font-medium text-on-surface">
                  {Math.round(
                    ((recipe.wantAgainYes ?? 0) /
                      ((recipe.wantAgainYes ?? 0) +
                        (recipe.wantAgainNo ?? 0))) *
                      100,
                  )}
                  %
                </dd>
              </div>
            ) : null}
          </dl>
          {recipe.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {recipe.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs text-on-surface-variant"
                >
                  #{tag}
                </li>
              ))}
            </ul>
          ) : null}
          {recipe.source?.url ? (
            <p className="text-sm text-on-surface-variant">
              出典{recipe.source.title ? `：${recipe.source.title}` : ""}
              {" "}
              <a
                href={recipe.source.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline"
              >
                元のページを見る
              </a>
            </p>
          ) : null}
        </div>

        {nutrition ? (
          <section className="rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
            <h2 className="text-sm font-medium text-on-surface-variant">
              1人分の栄養（概算）
            </h2>
            <p className="mt-1 text-sm">
              {Math.round(nutrition.perServing.calories)}kcal / たんぱく
              {Math.round(nutrition.perServing.protein * 10) / 10}g / 塩分
              {Math.round(nutrition.perServing.saltEquivalent * 100) / 100}g
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              計算精度 {Math.round(nutrition.confidence * 100)}% ・
              {nutritionSourceLabel(nutrition.source)} ・未計算材料
              {nutrition.uncalculatedIngredientCount}件
            </p>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/recipes/${recipe.id}/cook`}
            className="inline-flex rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
          >
            調理モード
          </Link>
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className="inline-flex rounded-2xl px-4 py-3 text-sm font-medium ring-1 ring-outline-variant"
          >
            編集
          </Link>
        </div>
      </header>

      <div
        className="flex gap-2 border-b border-outline-variant pb-2"
        role="tablist"
        aria-label="レシピ詳細タブ"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "recipe"}
          onClick={() => setTab("recipe")}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            tab === "recipe"
              ? "bg-primary text-on-primary"
              : "bg-surface-container text-on-surface"
          }`}
        >
          レシピ
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "family"}
          onClick={() => setTab("family")}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            tab === "family"
              ? "bg-primary text-on-primary"
              : "bg-surface-container text-on-surface"
          }`}
        >
          我が家メモ
        </button>
      </div>

      {tab === "family" ? (
        <RecipeFamilyMemoTab recipe={recipe} householdId="local" />
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">材料と紐付け</h2>
            <ul className="space-y-2 text-sm">
              {ingredientMatches.map(({ ingredient, match }) => (
                <li
                  key={ingredient.id}
                  className="rounded-xl bg-surface-container px-3 py-2"
                >
                  <p>
                    {ingredient.name}{" "}
                    {ingredient.quantity != null ? ingredient.quantity : ""}
                    {ingredient.unit}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {match.confidence === "none"
                      ? "⚠ 未紐付け（栄養計算対象外の可能性）"
                      : match.confidence === "partial" || match.needsReview
                        ? `⚠ 要確認 → ${match.master?.canonicalName ?? ""}`
                        : `✓ 食材マスターと一致（${match.master?.canonicalName}）`}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <IngredientList ingredients={recipe.ingredients} />
          <StepList steps={recipe.steps} />
          {recipe.memo ? (
            <section>
              <h2 className="text-lg font-semibold">メモ</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm">{recipe.memo}</p>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
