import { formatIngredientLine } from "@/lib/ingredient";
import type { Ingredient } from "@/types/recipe";

type IngredientListProps = {
  ingredients: Ingredient[];
  /** 詳細画面向けの大きめ表示 */
  large?: boolean;
};

/** 材料の読みやすい一覧表示 */
export function IngredientList({ ingredients, large = false }: IngredientListProps) {
  if (ingredients.length === 0) {
    return (
      <p className={large ? "text-base text-on-surface-variant" : "text-sm text-on-surface-variant"}>
        材料未登録
      </p>
    );
  }

  return (
    <ul className={large ? "space-y-3" : "space-y-1.5"}>
      {ingredients.map((ingredient) => (
        <li
          key={ingredient.id}
          className={
            large
              ? "rounded-xl bg-surface-container px-4 py-3 text-lg leading-relaxed text-on-surface"
              : "text-sm text-on-surface"
          }
        >
          {formatIngredientLine(ingredient)}
        </li>
      ))}
    </ul>
  );
}
