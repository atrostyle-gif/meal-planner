"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  formatShoppingQuantity,
  getServingsScale,
  scaleIngredientQuantity,
} from "@/lib/shopping/scale-ingredient";
import { useIsClient } from "@/lib/use-is-client";
import { useRecipe } from "@/lib/use-recipes";
import { getOrCreateMealPlan } from "@/lib/meal-plans";
import { getWeekStartFromDate } from "@/lib/date";
import { PostCookFeedbackPanel } from "@/components/cook/PostCookFeedbackPanel";
import { findLeftoverMatchesForRecipe } from "@/lib/leftover-match";
import {
  getActiveLeftoversForProposal,
  markLeftoversUsed,
} from "@/lib/leftover-ingredients";
import type { Ingredient, Recipe } from "@/types/recipe";

type CookModePageProps = {
  recipeId: string;
};

type WakeLockSentinelLike = {
  release: () => Promise<void>;
};

function loadCheckedSteps(key: string): boolean[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.map((item) => item === true)
      : [];
  } catch {
    return [];
  }
}

function saveCheckedSteps(key: string, values: boolean[]): void {
  window.localStorage.setItem(key, JSON.stringify(values));
}

function formatScaledIngredient(
  ingredient: Ingredient,
  recipeServings: number,
  targetServings: number,
): string {
  const scaled = scaleIngredientQuantity(
    ingredient.quantity,
    recipeServings,
    targetServings,
  );
  const quantityText = formatShoppingQuantity(scaled);
  const unit = ingredient.unit.trim();
  const note = ingredient.note.trim();
  let amount = "";
  if (quantityText && unit) {
    amount = `${quantityText}${unit}`;
  } else if (quantityText) {
    amount = quantityText;
  } else if (unit) {
    amount = unit;
  }
  const base =
    amount !== ""
      ? `${ingredient.name}　${amount}`
      : ingredient.name;
  return note ? `${base}（${note}）` : base;
}

type CookModeInnerProps = {
  recipe: Recipe;
  initialServings: number;
  storageKey: string;
};

function CookModeInner({
  recipe,
  initialServings,
  storageKey,
}: CookModeInnerProps) {
  const [servings, setServings] = useState(initialServings);
  const [stepIndex, setStepIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(() => {
    const saved = loadCheckedSteps(storageKey);
    return recipe.steps.map((_, index) => saved[index] === true);
  });
  const [wakeLockOn, setWakeLockOn] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinelLike | null>(null);
  const [recorded, setRecorded] = useState(false);
  const [selectedLeftoverIds, setSelectedLeftoverIds] = useState<string[]>(() =>
    findLeftoverMatchesForRecipe(recipe, getActiveLeftoversForProposal()).map(
      (match) => match.leftover.id,
    ),
  );
  const matchedLeftovers = findLeftoverMatchesForRecipe(
    recipe,
    getActiveLeftoversForProposal(),
  );

  useEffect(() => {
    return () => {
      void wakeLock?.release().catch(() => undefined);
    };
  }, [wakeLock]);

  const steps = recipe.steps;
  const current = steps[stepIndex];
  const scale = getServingsScale(recipe.servings, servings);
  const allDone =
    steps.length === 0 || (checked.length > 0 && checked.every(Boolean));

  async function toggleWakeLock(next: boolean): Promise<void> {
    if (!next) {
      await wakeLock?.release().catch(() => undefined);
      setWakeLock(null);
      setWakeLockOn(false);
      return;
    }
    try {
      const nav = navigator as Navigator & {
        wakeLock?: {
          request: (type: "screen") => Promise<WakeLockSentinelLike>;
        };
      };
      if (!nav.wakeLock) {
        window.alert("このブラウザでは画面点灯の維持に対応していません。");
        return;
      }
      const sentinel = await nav.wakeLock.request("screen");
      setWakeLock(sentinel);
      setWakeLockOn(true);
    } catch {
      window.alert("画面点灯の維持を開始できませんでした。");
    }
  }

  function toggleCheck(index: number): void {
    setChecked((currentChecks) => {
      const next = [...currentChecks];
      next[index] = !next[index];
      saveCheckedSteps(storageKey, next);
      return next;
    });
  }

  function resetChecks(): void {
    const next = steps.map(() => false);
    setChecked(next);
    saveCheckedSteps(storageKey, next);
    setStepIndex(0);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href={`/recipes/${recipe.id}`} className="text-sm text-primary">
          ← レシピ詳細
        </Link>
        <h1 className="text-3xl font-bold leading-tight">{recipe.name}</h1>
        <p className="text-base text-on-surface-variant">
          基準 {recipe.servings}人分
          {recipe.cookingTimeMinutes != null
            ? `・約${recipe.cookingTimeMinutes}分`
            : ""}
          {scale !== 1 ? `・表示 ${servings}人分` : ""}
        </p>
      </header>

      <section className="rounded-2xl bg-surface-container px-4 py-3">
        <p className="mb-2 text-sm font-medium">人数</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="h-12 w-12 rounded-xl bg-surface-container-lowest text-2xl font-bold"
            onClick={() => setServings((value) => Math.max(1, value - 1))}
          >
            −
          </button>
          <p className="min-w-12 text-center text-2xl font-bold">{servings}</p>
          <button
            type="button"
            className="h-12 w-12 rounded-xl bg-surface-container-lowest text-2xl font-bold"
            onClick={() => setServings((value) => Math.min(12, value + 1))}
          >
            ＋
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">材料</h2>
        <ul className="space-y-2 text-lg">
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient.id}>
              {formatScaledIngredient(ingredient, recipe.servings, servings)}
            </li>
          ))}
        </ul>
        {recipe.ingredients.length === 0 ? (
          <p className="text-sm text-on-surface-variant">材料がありません</p>
        ) : null}
      </section>
      {allDone || recorded ? (
        <PostCookFeedbackPanel
          recipeId={recipe.id}
          householdId="local"
          defaultServings={servings}
          defaultCookMinutes={recipe.cookingTimeMinutes}
          onSaved={() => setRecorded(true)}
        />
      ) : (
        <section className="rounded-2xl bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
          手順を完了すると「今回どうだった？」フィードバックが表示されます
        </section>
      )}

      {recorded && matchedLeftovers.length > 0 ? (
        <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
          <p className="text-sm font-medium">使った余り食材</p>
          <ul className="space-y-2">
            {matchedLeftovers.map((match) => (
              <li key={match.leftover.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedLeftoverIds.includes(match.leftover.id)}
                    onChange={() =>
                      setSelectedLeftoverIds((ids) =>
                        ids.includes(match.leftover.id)
                          ? ids.filter((id) => id !== match.leftover.id)
                          : [...ids, match.leftover.id],
                      )
                    }
                  />
                  {match.leftover.name}
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={selectedLeftoverIds.length === 0}
            onClick={() => {
              markLeftoversUsed(selectedLeftoverIds);
              setSelectedLeftoverIds([]);
            }}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-primary ring-1 ring-outline-variant disabled:opacity-50"
          >
            選択した食材を使用済みにする
          </button>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">手順</h2>
          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            className="text-sm font-medium text-primary"
          >
            {showAll ? "1ステップ表示" : "一覧表示"}
          </button>
        </div>

        {allDone ? (
          <div className="rounded-2xl bg-secondary-container px-4 py-6 text-center text-lg font-semibold text-on-secondary-container">
            お疲れさまでした！調理完了です
          </div>
        ) : null}

        {showAll ? (
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={step.id}>
                <label className="flex items-start gap-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
                  <input
                    type="checkbox"
                    checked={checked[index] === true}
                    onChange={() => toggleCheck(index)}
                    className="mt-1 h-6 w-6 accent-primary"
                  />
                  <span className="text-lg leading-relaxed">
                    <span className="mr-2 font-bold text-primary">
                      {index + 1}.
                    </span>
                    {step.text}
                  </span>
                </label>
              </li>
            ))}
          </ol>
        ) : current ? (
          <div className="space-y-4 rounded-2xl bg-surface-container-lowest p-5 ring-1 ring-outline-variant">
            <p className="text-sm font-medium text-primary">
              手順 {stepIndex + 1} / {steps.length}
            </p>
            <p className="text-2xl leading-relaxed font-medium">{current.text}</p>
            <label className="flex items-center gap-3 text-lg">
              <input
                type="checkbox"
                checked={checked[stepIndex] === true}
                onChange={() => toggleCheck(stepIndex)}
                className="h-7 w-7 accent-primary"
              />
              この手順を完了
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={stepIndex === 0}
                onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
                className="rounded-2xl px-4 py-4 text-lg font-semibold ring-1 ring-outline-variant disabled:opacity-40"
              >
                前へ
              </button>
              <button
                type="button"
                disabled={stepIndex >= steps.length - 1}
                onClick={() =>
                  setStepIndex((value) =>
                    Math.min(steps.length - 1, value + 1),
                  )
                }
                className="rounded-2xl bg-primary px-4 py-4 text-lg font-semibold text-on-primary disabled:opacity-40"
              >
                次へ
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">手順がありません</p>
        )}
      </section>

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => void toggleWakeLock(!wakeLockOn)}
          className="w-full rounded-xl px-4 py-3 text-sm font-medium ring-1 ring-outline-variant"
        >
          {wakeLockOn ? "画面点灯を解除" : "画面をつけたままにする"}
        </button>
        <button
          type="button"
          onClick={resetChecks}
          className="w-full rounded-xl px-4 py-3 text-sm font-medium text-on-surface-variant"
        >
          最初からやり直す
        </button>
      </section>
    </div>
  );
}

export function CookModePage({ recipeId }: CookModePageProps) {
  const isClient = useIsClient();
  const recipe = useRecipe(recipeId);
  const searchParams = useSearchParams();
  const date = searchParams.get("date");
  const mealItemId = searchParams.get("mealItemId");

  const servingsOverrideFromMeal = useMemo(() => {
    if (!date || !mealItemId || typeof window === "undefined") {
      return null;
    }
    try {
      const plan = getOrCreateMealPlan(getWeekStartFromDate(date));
      const day = plan.days.find((entry) => entry.date === date);
      const item = day?.items.find((entry) => entry.id === mealItemId);
      return item?.servingsOverride ?? null;
    } catch {
      return null;
    }
  }, [date, mealItemId]);

  if (!isClient) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  if (!recipe) {
    return (
      <div className="space-y-3">
        <p>レシピが見つかりません</p>
        <Link href="/today" className="text-primary">
          今日の献立へ
        </Link>
      </div>
    );
  }

  const initialServings =
    servingsOverrideFromMeal && servingsOverrideFromMeal > 0
      ? servingsOverrideFromMeal
      : recipe.servings;
  const storageKey = `meal-planner:cook-checks:${recipeId}`;

  return (
    <CookModeInner
      key={`${recipe.id}-${initialServings}-${recipe.steps.length}`}
      recipe={recipe}
      initialServings={initialServings}
      storageKey={storageKey}
    />
  );
}
