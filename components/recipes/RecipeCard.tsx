import Link from "next/link";
import { formatIngredientLine } from "@/lib/ingredient";
import { formatCourseLabel, type Recipe } from "@/types/recipe";

type RecipeCardProps = {
  recipe: Recipe;
};

export function RecipeCard({ recipe }: RecipeCardProps) {
  const previewItems = recipe.ingredients.slice(0, 3);

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="block rounded-2xl bg-surface-container-lowest p-4 shadow-sm ring-1 ring-outline-variant transition hover:bg-surface-container"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-on-surface">{recipe.name}</h2>
        <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium text-on-secondary-container">
          {recipe.category}
        </span>
        <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs text-on-surface-variant">
          {formatCourseLabel(recipe.course)}
        </span>
      </div>

      <p className="mt-2 text-sm text-on-surface-variant">
        {recipe.servings}人分
        {recipe.cookingTimeMinutes !== null
          ? `　・　調理時間 ${recipe.cookingTimeMinutes}分`
          : ""}
      </p>

      {recipe.tags.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
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

      {previewItems.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-sm text-on-surface-variant">
          {previewItems.map((item) => (
            <li key={item.id}>{formatIngredientLine(item)}</li>
          ))}
          {recipe.ingredients.length > 3 ? (
            <li>など {recipe.ingredients.length}品目</li>
          ) : null}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-on-surface-variant">材料未登録</p>
      )}

      {recipe.memo ? (
        <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">{recipe.memo}</p>
      ) : null}
    </Link>
  );
}
