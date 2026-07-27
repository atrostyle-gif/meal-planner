import Link from "next/link";
import type { Recipe } from "@/types/recipe";

type RecipeCardProps = {
  recipe: Recipe;
};

/** 一覧は品名のみ。タップで詳細へ */
export function RecipeCard({ recipe }: RecipeCardProps) {
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-surface-container-lowest px-4 py-3.5 ring-1 ring-outline-variant transition active:bg-surface-container"
    >
      <h2 className="truncate text-base font-semibold text-on-surface">
        {recipe.name}
      </h2>
      <span
        className="shrink-0 text-lg leading-none text-on-surface-variant"
        aria-hidden
      >
        ›
      </span>
    </Link>
  );
}
