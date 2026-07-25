"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import { deleteRecipe, updateRecipe } from "@/lib/recipes";
import { useIsClient } from "@/lib/use-is-client";
import { useRecipe } from "@/lib/use-recipes";
import type { RecipeInput } from "@/types/recipe";

type EditRecipePageProps = {
  recipeId: string;
};

export function EditRecipePage({ recipeId }: EditRecipePageProps) {
  const router = useRouter();
  const isClient = useIsClient();
  const recipe = useRecipe(recipeId);

  function handleSubmit(input: RecipeInput): void {
    updateRecipe(recipeId, input);
    router.push(`/recipes/${recipeId}`);
    router.refresh();
  }

  function handleDelete(): void {
    deleteRecipe(recipeId);
    router.push("/recipes");
    router.refresh();
  }

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

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href={`/recipes/${recipeId}`}
          className="text-sm font-medium text-primary"
        >
          ← 詳細へ戻る
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">レシピを編集</h1>
      </header>

      <RecipeForm
        initialRecipe={recipe}
        submitLabel="変更を保存"
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </div>
  );
}
