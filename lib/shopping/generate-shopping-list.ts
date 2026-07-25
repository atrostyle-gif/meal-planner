import {
  aggregateIngredients,
  buildShoppingItemIdentityKey,
} from "@/lib/shopping/aggregate-ingredients";
import { classifyShoppingCategory } from "@/lib/shopping/classify-category";
import { scaleIngredientQuantity } from "@/lib/shopping/scale-ingredient";
import { getPantryStockStatus } from "@/lib/pantry-stock";
import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import {
  DEFAULT_INGREDIENT_TYPE,
  isPantryIngredientType,
  type IngredientType,
} from "@/types/ingredient-meta";
import type { MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import type { LeftoverIngredient } from "@/types/leftover-ingredient";
import type {
  AggregatedIngredientGroup,
  ShoppingList,
  ShoppingListItem,
  ShoppingListKind,
} from "@/types/shopping-list";

function resolveListKind(
  ingredientType: IngredientType,
  stockStatus: ReturnType<typeof getPantryStockStatus>,
): ShoppingListKind | "skip" {
  if (ingredientType === "householdItem") {
    return "skip";
  }

  if (isPantryIngredientType(ingredientType)) {
    if (stockStatus === "enough") {
      return "skip";
    }
    if (stockStatus === "unknown") {
      return "pantryCheck";
    }
    // low / empty
    return "buy";
  }

  return "buy";
}

/**
 * 週間献立から材料を抽出し、人数補正したうえで食材グループへ集計する。
 */
export function generateAggregatedIngredientsFromMealPlan(
  mealPlan: MealPlan,
  recipes: Recipe[],
): AggregatedIngredientGroup[] {
  const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const rows: Parameters<typeof aggregateIngredients>[0] = [];

  for (const day of mealPlan.days) {
    for (const mealItem of day.items) {
      if (!mealItem.recipeId) {
        continue;
      }

      const recipe = recipeMap.get(mealItem.recipeId);
      if (!recipe) {
        continue;
      }

      for (const ingredient of recipe.ingredients) {
        if (ingredient.name.trim() === "") {
          continue;
        }

        rows.push({
          ingredientName: ingredient.name,
          quantity: scaleIngredientQuantity(
            ingredient.quantity,
            recipe.servings,
            mealItem.servingsOverride,
          ),
          unit: ingredient.unit,
          note: ingredient.note,
          recipeId: recipe.id,
          recipeName: recipe.name,
          mealItemId: mealItem.id,
          date: day.date,
          ingredientType: ingredient.ingredientType ?? DEFAULT_INGREDIENT_TYPE,
        });
      }
    }
  }

  return aggregateIngredients(rows);
}

function toShoppingListItem(
  group: AggregatedIngredientGroup,
  listKind: ShoppingListKind,
  previous?: ShoppingListItem,
  leftoverNote: string | null = null,
): ShoppingListItem {
  return {
    id: previous?.id ?? crypto.randomUUID(),
    ingredientName: group.ingredientName,
    checked: previous?.checked ?? false,
    manuallyAdded: false,
    ingredientType: group.ingredientType,
    listKind,
    quantities: group.quantities,
    sources: group.sources,
    leftoverNote,
    shoppingCategory:
      previous?.shoppingCategory ??
      classifyShoppingCategory(group.ingredientName, group.ingredientType),
  };
}

function getLeftoverNote(
  group: AggregatedIngredientGroup,
  leftovers: LeftoverIngredient[],
): string | null {
  const active = leftovers.filter(
    (item) =>
      item.status !== "used" &&
      item.status !== "dismissed" &&
      item.includeInProposal,
  );
  const groupName = normalizeIngredientName(group.ingredientName);
  const matching = active.filter((item) => {
    const leftoverName = normalizeIngredientName(item.name);
    return (
      leftoverName === groupName ||
      leftoverName.includes(groupName) ||
      groupName.includes(leftoverName)
    );
  });
  if (matching.length === 0) return null;
  const hasComparableQuantity =
    matching.some((item) => item.quantity != null && item.unit !== null) &&
    group.quantities.some((quantity) => quantity.quantity != null && quantity.unit !== "");
  return hasComparableQuantity
    ? "余っている食材として登録されています。数量を確認してください"
    : "余っている食材として登録されています。数量要確認";
}

/**
 * 献立から買い物リストを生成する。
 * - 通常食材 → 買うもの
 * - 常備品 enough → 除外
 * - 常備品 low/empty → 買うもの
 * - 常備品 unknown → 常備品の確認
 * existing がある場合は正規化名で checked・手動追加を維持
 */
export function generateShoppingListFromMealPlan(
  mealPlan: MealPlan,
  recipes: Recipe[],
  existing: ShoppingList | null = null,
  leftovers: LeftoverIngredient[] = [],
): ShoppingList {
  const aggregated = generateAggregatedIngredientsFromMealPlan(mealPlan, recipes);
  const now = new Date().toISOString();

  const previousByKey = new Map<string, ShoppingListItem>();
  if (existing) {
    for (const item of existing.items) {
      if (item.manuallyAdded) {
        continue;
      }
      previousByKey.set(buildShoppingItemIdentityKey(item), item);
    }
  }

  const generatedItems: ShoppingListItem[] = [];

  for (const group of aggregated) {
    const stockStatus = getPantryStockStatus(group.ingredientName);
    const listKind = resolveListKind(group.ingredientType, stockStatus);
    if (listKind === "skip") {
      continue;
    }

    const key = buildShoppingItemIdentityKey({
      ingredientName: group.ingredientName,
    });
    generatedItems.push(
      toShoppingListItem(
        group,
        listKind,
        previousByKey.get(key),
        getLeftoverNote(group, leftovers),
      ),
    );
  }

  const manualItems =
    existing?.items.filter((item) => item.manuallyAdded) ?? [];

  return {
    id: existing?.id ?? crypto.randomUUID(),
    weekStart: mealPlan.weekStart,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    items: [...generatedItems, ...manualItems],
  };
}
