"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import { PhotoImportPanel } from "@/components/recipes/import/PhotoImportPanel";
import { UrlImportPanel } from "@/components/recipes/import/UrlImportPanel";
import { createRecipe } from "@/lib/recipes";
import type { RecipeInput } from "@/types/recipe";

export function NewRecipePage() {
  const router = useRouter();
  const [method, setMethod] = useState<"manual" | "url" | "photo">("manual");

  function handleSubmit(input: RecipeInput): void {
    const recipe = createRecipe(input);
    router.push(`/recipes/${recipe.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/recipes" className="text-sm font-medium text-primary">
          ← 一覧へ戻る
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">レシピを登録</h1>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        {([
          ["manual", "手入力", "材料・手順を入力"],
          ["url", "URLから取り込み", "公開レシピページを読む"],
          ["photo", "写真から取り込み", "レシピ本やメモを読む"],
        ] as const).map(([value, title, description]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMethod(value)}
            className={`rounded-2xl p-4 text-left ring-1 ${method === value ? "bg-primary-container ring-primary" : "bg-surface-container-lowest ring-outline-variant"}`}
          >
            <span className="block font-semibold">{title}</span>
            <span className="mt-1 block text-xs text-on-surface-variant">{description}</span>
          </button>
        ))}
      </div>
      {method === "manual" ? <RecipeForm submitLabel="保存する" onSubmit={handleSubmit} /> : null}
      {method === "url" ? <UrlImportPanel /> : null}
      {method === "photo" ? <PhotoImportPanel /> : null}
    </div>
  );
}
