"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveImportDraft } from "@/lib/recipe-import/draft-session";
import { findDuplicateCandidates } from "@/lib/recipe-import/duplicate";
import { useRecipes } from "@/lib/use-recipes";
import type { RecipeDraft, RecipeDraftIngredient } from "@/types/recipe-import";

type ImportReviewPanelProps = {
  draft: RecipeDraft;
  onConfirm?: (draft: RecipeDraft) => void;
};

type IngredientGroup = {
  groupName: string | null;
  items: Array<{ ingredient: RecipeDraftIngredient; index: number }>;
};

function groupIngredients(
  ingredients: RecipeDraftIngredient[],
): IngredientGroup[] {
  const groups: IngredientGroup[] = [];
  for (let index = 0; index < ingredients.length; index += 1) {
    const ingredient = ingredients[index];
    const name = ingredient.groupName?.trim() || null;
    const last = groups[groups.length - 1];
    if (last && last.groupName === name) {
      last.items.push({ ingredient, index });
    } else {
      groups.push({ groupName: name, items: [{ ingredient, index }] });
    }
  }
  return groups;
}

function formatAmount(ingredient: RecipeDraftIngredient): string {
  const parts = [
    ingredient.quantity != null ? String(ingredient.quantity) : ingredient.quantityText,
    ingredient.unit,
  ].filter(Boolean);
  return parts.join("") || "";
}

export function ImportReviewPanel({ draft, onConfirm }: ImportReviewPanelProps) {
  const router = useRouter();
  const recipes = useRecipes();
  const [editableDraft, setEditableDraft] = useState(draft);
  const duplicates = findDuplicateCandidates(editableDraft, recipes);
  const ingredientGroups = useMemo(
    () => groupIngredients(editableDraft.ingredients),
    [editableDraft.ingredients],
  );

  function continueToForm(): void {
    if (onConfirm) {
      onConfirm(editableDraft);
      return;
    }
    saveImportDraft(editableDraft);
    router.push("/recipes/import/confirm");
  }

  function updateIngredient(
    index: number,
    patch: Partial<RecipeDraftIngredient>,
  ): void {
    setEditableDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
              // グループは編集中も維持
              groupName:
                patch.groupName !== undefined ? patch.groupName : item.groupName,
            }
          : item,
      ),
    }));
  }

  return (
    <section className="space-y-4 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
      <div>
        <h2 className="text-lg font-semibold">読み取り結果を確認</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          保存はまだ行われません。内容を確認してからレシピフォームへ進みます。
        </p>
      </div>
      {editableDraft.warnings?.length ? (
        <ul className="space-y-1 rounded-xl bg-error-container p-3 text-sm text-on-error-container">
          {editableDraft.warnings.map((warning) => (
            <li key={warning}>⚠ {warning}</li>
          ))}
        </ul>
      ) : null}
      {duplicates.length > 0 ? (
        <p className="rounded-xl bg-secondary-container p-3 text-sm text-on-secondary-container">
          既存レシピの可能性:{" "}
          {duplicates
            .map(
              (candidate) =>
                `${candidate.recipe.name}（${candidate.reasons.join("・")}）`,
            )
            .join("、")}
          。上書きは行いません。
        </p>
      ) : null}
      <label className="block space-y-1">
        <span className="text-sm font-medium">料理名</span>
        <input
          value={editableDraft.title ?? ""}
          onChange={(event) =>
            setEditableDraft((current) => ({
              ...current,
              title: event.target.value,
            }))
          }
          className="w-full rounded-xl bg-surface-container px-3 py-2 ring-1 ring-outline-variant"
        />
      </label>
      {editableDraft.servings != null ? (
        <p className="text-sm text-on-surface-variant">
          人数: {editableDraft.servings}
          {editableDraft.servingsText ? `（${editableDraft.servingsText}）` : "人分"}
        </p>
      ) : null}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">材料</h3>
        {editableDraft.ingredients.length === 0 ? (
          <p className="text-sm text-on-surface-variant">材料は読み取れていません。</p>
        ) : null}
        {ingredientGroups.map((group, groupIndex) => (
          <div key={`${group.groupName ?? "none"}-${groupIndex}`} className="space-y-2">
            {group.groupName ? (
              <p className="text-sm font-semibold text-on-surface">{group.groupName}</p>
            ) : null}
            {group.items.map(({ ingredient, index }) => (
              <div
                key={`${ingredient.rawText}-${index}`}
                className="space-y-1 rounded-xl bg-surface-container px-3 py-2"
              >
                <input
                  value={ingredient.name}
                  onChange={(event) =>
                    updateIngredient(index, {
                      name: event.target.value,
                      rawText: event.target.value,
                    })
                  }
                  className="w-full rounded-lg bg-surface-container-lowest px-2 py-1.5 text-sm ring-1 ring-outline-variant"
                  placeholder="材料名"
                />
                <div className="flex gap-2">
                  <input
                    value={
                      ingredient.quantity != null
                        ? String(ingredient.quantity)
                        : (ingredient.quantityText ?? "")
                    }
                    onChange={(event) => {
                      const value = event.target.value.trim();
                      const asNumber = Number(value);
                      updateIngredient(index, {
                        quantity: Number.isFinite(asNumber) && value !== "" ? asNumber : null,
                        quantityText: value || null,
                      });
                    }}
                    className="w-24 rounded-lg bg-surface-container-lowest px-2 py-1.5 text-sm ring-1 ring-outline-variant"
                    placeholder="分量"
                  />
                  <input
                    value={ingredient.unit ?? ""}
                    onChange={(event) =>
                      updateIngredient(index, { unit: event.target.value || null })
                    }
                    className="w-24 rounded-lg bg-surface-container-lowest px-2 py-1.5 text-sm ring-1 ring-outline-variant"
                    placeholder="単位"
                  />
                  {ingredient.alias ? (
                    <span className="self-center text-xs text-on-surface-variant">
                      別名: {ingredient.alias}
                    </span>
                  ) : null}
                </div>
                {!formatAmount(ingredient) && !ingredient.name ? (
                  <p className="text-xs text-on-surface-variant">{ingredient.rawText}</p>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">手順</h3>
        {editableDraft.steps.length === 0 ? (
          <p className="text-sm text-on-surface-variant">手順は読み取れていません。</p>
        ) : null}
        {editableDraft.steps.map((step, index) => (
          <textarea
            key={`${step.order}-${index}`}
            value={step.text}
            onChange={(event) =>
              setEditableDraft((current) => ({
                ...current,
                steps: current.steps.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, text: event.target.value }
                    : item,
                ),
              }))
            }
            rows={2}
            className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm ring-1 ring-outline-variant"
          />
        ))}
      </div>
      <button
        type="button"
        onClick={continueToForm}
        className="w-full rounded-2xl bg-primary px-4 py-3 font-semibold text-on-primary"
      >
        レシピフォームで確認・保存
      </button>
    </section>
  );
}
