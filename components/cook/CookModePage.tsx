"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  formatShoppingQuantity,
  scaleIngredientQuantity,
} from "@/lib/shopping/scale-ingredient";
import { useIsClient } from "@/lib/use-is-client";
import { useRecipe } from "@/lib/use-recipes";
import {
  getOrCreateMealPlan,
  resetDayMealServings,
  setDayMealServings,
} from "@/lib/meal-plans";
import { getWeekStartFromDate, getToday } from "@/lib/date";
import { PostCookFeedbackPanel } from "@/components/cook/PostCookFeedbackPanel";
import { DayServingsEditor } from "@/components/meals/DayServingsEditor";
import { findLeftoverMatchesForRecipe } from "@/lib/leftover-match";
import {
  getActiveLeftoversForProposal,
  markLeftoversUsed,
} from "@/lib/leftover-ingredients";
import { markCookDone } from "@/lib/today/cook-done";
import {
  getServingScale,
  loadDefaultMealServings,
  resolveDayServings,
} from "@/lib/servings/resolve";
import { createOrRegenerateShoppingList } from "@/lib/shopping-lists";
import { loadRecipes } from "@/lib/recipes";
import type { Ingredient, Recipe } from "@/types/recipe";

type CookModePageProps = {
  recipeId: string;
};

type CookProgress = {
  stepIndex: number;
  finished: boolean;
};

function loadProgress(key: string): CookProgress {
  if (typeof window === "undefined") {
    return { stepIndex: 0, finished: false };
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { stepIndex: 0, finished: false };
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return { stepIndex: 0, finished: false };
    }
    const item = parsed as Record<string, unknown>;
    return {
      stepIndex:
        typeof item.stepIndex === "number" && item.stepIndex >= 0
          ? item.stepIndex
          : 0,
      finished: item.finished === true,
    };
  } catch {
    return { stepIndex: 0, finished: false };
  }
}

function saveProgress(key: string, progress: CookProgress): void {
  window.localStorage.setItem(key, JSON.stringify(progress));
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
  plannedServings: number;
  servingsIsCustom: boolean;
  defaultMealServings: number;
  recipeServingsKnown: boolean;
  storageKey: string;
  cookDate: string;
  weekStart: string;
  linkedToMealPlan: boolean;
};

function CookModeInner({
  recipe,
  plannedServings,
  servingsIsCustom,
  defaultMealServings,
  recipeServingsKnown,
  storageKey,
  cookDate,
  weekStart,
  linkedToMealPlan,
}: CookModeInnerProps) {
  const [servings, setServings] = useState(plannedServings);
  const [showServingsEdit, setShowServingsEdit] = useState(false);
  const [progress, setProgress] = useState<CookProgress>(() =>
    loadProgress(storageKey),
  );
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

  const steps = recipe.steps;
  const stepIndex = Math.min(
    progress.stepIndex,
    Math.max(0, steps.length - 1),
  );
  const current = steps[stepIndex];
  const finished = progress.finished || steps.length === 0;
  const isLastStep = steps.length > 0 && stepIndex >= steps.length - 1;
  const scaleInfo = getServingScale({
    recipeServings: recipe.servings,
    plannedServings: servings,
  });

  function updateProgress(next: CookProgress): void {
    setProgress(next);
    saveProgress(storageKey, next);
  }

  function applyDayServings(next: number): void {
    setServings(next);
    if (linkedToMealPlan) {
      const updated = setDayMealServings(
        weekStart,
        cookDate,
        next,
        defaultMealServings,
      );
      createOrRegenerateShoppingList(updated, loadRecipes());
    }
  }

  function resetDayServings(): void {
    setServings(defaultMealServings);
    if (linkedToMealPlan) {
      const updated = resetDayMealServings(weekStart, cookDate);
      createOrRegenerateShoppingList(updated, loadRecipes());
    }
  }

  function goNext(): void {
    if (steps.length === 0 || isLastStep) {
      markCookDone(cookDate, recipe.id);
      updateProgress({ stepIndex, finished: true });
      return;
    }
    updateProgress({ stepIndex: stepIndex + 1, finished: false });
  }

  function goPrev(): void {
    if (stepIndex <= 0) return;
    updateProgress({ stepIndex: stepIndex - 1, finished: false });
  }

  function resetCook(): void {
    updateProgress({ stepIndex: 0, finished: false });
    setRecorded(false);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href={`/recipes/${recipe.id}`} className="text-sm text-primary">
          ← レシピ詳細
        </Link>
        <h1 className="text-3xl font-bold leading-tight">{recipe.name}</h1>
        <p className="text-base text-on-surface-variant">
          今日の人数：{servings}人分
          {recipe.cookingTimeMinutes != null
            ? `・約${recipe.cookingTimeMinutes}分`
            : ""}
        </p>
        {recipeServingsKnown ? (
          <p className="text-sm text-on-surface-variant">
            材料は{servings}人分へ調整済み
            {scaleInfo.scale !== 1
              ? `（元レシピ${recipe.servings}人分から調整）`
              : ""}
          </p>
        ) : (
          <p className="text-sm text-on-surface-variant">
            元レシピの人数が不明のため、登録どおりの分量を表示しています
          </p>
        )}
      </header>

      <section className="rounded-2xl bg-surface-container px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">今日の人数：{servings}人分</p>
            {recipeServingsKnown ? (
              <p className="text-xs text-on-surface-variant">
                元レシピ：{recipe.servings}人分
              </p>
            ) : null}
          </div>
          {linkedToMealPlan ? (
            <button
              type="button"
              className="text-sm font-medium text-primary"
              onClick={() => setShowServingsEdit((v) => !v)}
            >
              人数を変更
            </button>
          ) : (
            <Link href="/meals" className="text-sm font-medium text-primary">
              献立で人数設定
            </Link>
          )}
        </div>
        {showServingsEdit && linkedToMealPlan ? (
          <div className="mt-3">
            <DayServingsEditor
              servings={servings}
              isCustom={servingsIsCustom || servings !== defaultMealServings}
              defaultMealServings={defaultMealServings}
              compact={false}
              onChange={applyDayServings}
              onReset={resetDayServings}
            />
          </div>
        ) : null}
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

      {!finished ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">手順</h2>
          {current ? (
            <div className="space-y-4 rounded-2xl bg-surface-container-lowest p-5 ring-1 ring-outline-variant">
              <p className="text-sm font-medium text-primary">
                手順 {stepIndex + 1} / {steps.length}
              </p>
              <p className="text-2xl font-medium leading-relaxed">
                {current.text}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={stepIndex === 0}
                  onClick={goPrev}
                  className="rounded-2xl px-4 py-4 text-lg font-semibold ring-1 ring-outline-variant disabled:opacity-40"
                >
                  前へ
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-2xl bg-primary px-4 py-4 text-lg font-semibold text-on-primary"
                >
                  {isLastStep ? "調理完了" : "次へ"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-on-surface-variant">手順がありません</p>
              <button
                type="button"
                onClick={goNext}
                className="w-full rounded-2xl bg-primary px-4 py-4 text-lg font-semibold text-on-primary"
              >
                調理完了
              </button>
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="rounded-2xl bg-secondary-container px-4 py-6 text-center text-lg font-semibold text-on-secondary-container">
            お疲れさまでした！調理完了です
          </div>
          <PostCookFeedbackPanel
            recipeId={recipe.id}
            householdId="local"
            defaultServings={servings}
            defaultCookMinutes={recipe.cookingTimeMinutes}
            onSaved={() => setRecorded(true)}
          />
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
        </>
      )}

      <button
        type="button"
        onClick={resetCook}
        className="w-full rounded-xl px-4 py-3 text-sm font-medium text-on-surface-variant"
      >
        最初からやり直す
      </button>
    </div>
  );
}

export function CookModePage({ recipeId }: CookModePageProps) {
  const isClient = useIsClient();
  const recipe = useRecipe(recipeId);
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const mealItemId = searchParams.get("mealItemId");
  const cookDate = dateParam ?? getToday();
  const weekStart = getWeekStartFromDate(cookDate);
  const defaultMealServings = loadDefaultMealServings();

  const dayServings = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        servings: defaultMealServings,
        isCustom: false,
        linkedToMealPlan: false,
      };
    }
    try {
      const plan = getOrCreateMealPlan(weekStart);
      const day = plan.days.find((entry) => entry.date === cookDate);
      if (!day) {
        return {
          servings: defaultMealServings,
          isCustom: false,
          linkedToMealPlan: Boolean(dateParam && mealItemId),
        };
      }
      const resolved = resolveDayServings(day, defaultMealServings);
      return {
        servings: resolved.servings,
        isCustom: resolved.isCustom,
        linkedToMealPlan: Boolean(dateParam),
      };
    } catch {
      return {
        servings: defaultMealServings,
        isCustom: false,
        linkedToMealPlan: false,
      };
    }
  }, [weekStart, cookDate, defaultMealServings, dateParam, mealItemId]);

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

  const recipeServingsKnown =
    typeof recipe.servings === "number" && recipe.servings > 0;
  const storageKey = `meal-planner:cook-progress:${recipeId}`;

  return (
    <CookModeInner
      key={`${recipe.id}-${dayServings.servings}-${recipe.steps.length}`}
      recipe={recipe}
      plannedServings={dayServings.servings}
      servingsIsCustom={dayServings.isCustom}
      defaultMealServings={defaultMealServings}
      recipeServingsKnown={recipeServingsKnown}
      storageKey={storageKey}
      cookDate={cookDate}
      weekStart={weekStart}
      linkedToMealPlan={dayServings.linkedToMealPlan}
    />
  );
}
