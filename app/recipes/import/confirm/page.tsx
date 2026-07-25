"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import {
  recipeDraftToRecipeInput,
  recipeInputToTemporaryRecipe,
} from "@/lib/recipe-import/draft-to-recipe";
import {
  clearImportDraft,
  loadImportDraft,
} from "@/lib/recipe-import/draft-session";
import { createRecipe } from "@/lib/recipes";
import type { Recipe, RecipeInput } from "@/types/recipe";

export default function RecipeImportConfirmPage() {
  const router = useRouter();
  const [initialRecipe] = useState<Recipe | null>(() => {
    const draft = loadImportDraft();
    return draft ? recipeInputToTemporaryRecipe(recipeDraftToRecipeInput(draft)) : null;
  });

  function handleSubmit(input: RecipeInput): void {
    const recipe = createRecipe(input);
    clearImportDraft();
    router.push(`/recipes/${recipe.id}`);
    router.refresh();
  }

  if (!initialRecipe) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">取り込みデータがありません</h1>
        <Link href="/recipes/new" className="text-sm font-medium text-primary">レシピ登録へ戻る</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">レシピを確認して保存</h1>
        <p className="text-sm text-on-surface-variant">内容を必要に応じて修正してから保存してください。</p>
      </header>
      <RecipeForm initialRecipe={initialRecipe} submitLabel="確認して保存する" onSubmit={handleSubmit} />
    </div>
  );
}
