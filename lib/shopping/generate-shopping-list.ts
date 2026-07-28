import { toGramsEquivalent } from "@/lib/food-budget/unit-convert";
import { foodMasterMatchKeys, resolveFoodMaster } from "@/lib/food-master/resolve";
import { shoppingCategoryFromFoodCategory } from "@/lib/food-master/shopping-category";
import { loadFoodMasters } from "@/lib/food-master/store";
import { resolveQuantityAndUnit } from "@/lib/ingredient";
import {
  aggregateIngredients,
  buildShoppingItemIdentityKey,
} from "@/lib/shopping/aggregate-ingredients";
import { classifyShoppingCategory } from "@/lib/shopping/classify-category";
import { scaleIngredientQuantity } from "@/lib/shopping/scale-ingredient";
import {
  loadDefaultMealServings,
  resolveDayServings,
} from "@/lib/servings/resolve";
import { getPantryStockStatus } from "@/lib/pantry-stock";
import {
  DEFAULT_INGREDIENT_TYPE,
  isPantryIngredientType,
  type IngredientType,
} from "@/types/ingredient-meta";
import type { FoodIngredientMaster } from "@/types/food-master";
import type { MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import type { LeftoverIngredient } from "@/types/leftover-ingredient";
import type {
  AggregatedIngredientGroup,
  ShoppingList,
  ShoppingListItem,
  ShoppingListKind,
  ShoppingQuantity,
} from "@/types/shopping-list";

function toCanonicalShoppingName(
  name: string,
  masters: FoodIngredientMaster[],
): string {
  const hit = resolveFoodMaster(name, { masters });
  if (
    hit.master &&
    !hit.needsReview &&
    (hit.matchedBy === "exact" ||
      hit.matchedBy === "alias" ||
      hit.matchedBy === "household_alias")
  ) {
    return hit.canonicalName;
  }
  return name.trim();
}

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
 * 週間献立から材料を抽出し、日別人数で補正したうえで食材グループへ集計する。
 */
export function generateAggregatedIngredientsFromMealPlan(
  mealPlan: MealPlan,
  recipes: Recipe[],
  defaultMealServings: number = loadDefaultMealServings(),
): AggregatedIngredientGroup[] {
  const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const rows: Parameters<typeof aggregateIngredients>[0] = [];
  const masters = loadFoodMasters();

  for (const day of mealPlan.days) {
    const plannedServings = resolveDayServings(
      day,
      defaultMealServings,
    ).servings;

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

        // 取り込み時に数量が欠落したケースを原文メモから補う
        const resolved = resolveQuantityAndUnit(
          ingredient.quantity,
          ingredient.unit,
          ingredient.note,
        );

        rows.push({
          ingredientName: toCanonicalShoppingName(ingredient.name, masters),
          quantity: scaleIngredientQuantity(
            resolved.quantity,
            recipe.servings,
            plannedServings,
          ),
          unit: resolved.unit,
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

function findMatchingLeftovers(
  group: AggregatedIngredientGroup,
  leftovers: LeftoverIngredient[],
  masters: FoodIngredientMaster[],
): LeftoverIngredient[] {
  const active = leftovers.filter(
    (item) =>
      item.status !== "used" &&
      item.status !== "dismissed" &&
      item.includeInProposal,
  );
  const groupKeys = new Set(
    foodMasterMatchKeys(group.ingredientName, masters),
  );
  return active.filter((item) => {
    const keys = foodMasterMatchKeys(item.name, masters);
    return keys.some((key) => groupKeys.has(key));
  });
}

function applyLeftoverToQuantities(
  quantities: ShoppingQuantity[],
  leftovers: LeftoverIngredient[],
): { quantities: ShoppingQuantity[]; leftoverNote: string | null; skipBuy: boolean } {
  if (leftovers.length === 0) {
    return { quantities, leftoverNote: null, skipBuy: false };
  }

  const withQty = leftovers.filter((item) => item.quantity != null && item.quantity > 0);
  if (withQty.length === 0) {
    return {
      quantities,
      leftoverNote: "家にある可能性あり（数量不明）\n購入が必要か確認",
      skipBuy: false,
    };
  }

  let remainingHomeGrams = 0;
  for (const item of withQty) {
    const grams = toGramsEquivalent(item.quantity, item.unit ?? "g");
    if (grams != null) remainingHomeGrams += grams;
  }

  if (remainingHomeGrams <= 0) {
    // グラム換算できない場合は差し引き断定しない
    return {
      quantities,
      leftoverNote: `家にある分を使用予定（${withQty
        .map((item) => item.quantityText || `${item.quantity}${item.unit ?? ""}`)
        .join("・")}）\n数量を確認`,
      skipBuy: false,
    };
  }

  const nextQuantities: ShoppingQuantity[] = [];
  let deducted = false;
  for (const line of quantities) {
    if (line.quantity == null || remainingHomeGrams <= 0) {
      nextQuantities.push(line);
      continue;
    }
    const needGrams = toGramsEquivalent(line.quantity, line.unit);
    if (needGrams == null) {
      nextQuantities.push(line);
      continue;
    }
    if (remainingHomeGrams >= needGrams) {
      remainingHomeGrams -= needGrams;
      deducted = true;
      // 家にある分で足りる行は購入数量を出さない
      continue;
    }
    const stillNeed = needGrams - remainingHomeGrams;
    remainingHomeGrams = 0;
    deducted = true;
    // 単位が g/kg のときだけ数量を書き換え
    if (/^g$/i.test(line.unit.trim())) {
      nextQuantities.push({ ...line, quantity: stillNeed });
    } else if (/^kg$/i.test(line.unit.trim())) {
      nextQuantities.push({ ...line, quantity: stillNeed / 1000 });
    } else {
      nextQuantities.push(line);
    }
  }

  return {
    quantities: nextQuantities,
    leftoverNote: deducted
      ? "家にある分を使用予定"
      : "家にある分を使用予定（数量を確認）",
    skipBuy: deducted && nextQuantities.every(
      (line) => line.quantity == null || line.quantity <= 0,
    ),
  };
}

function toShoppingListItem(
  group: AggregatedIngredientGroup,
  listKind: ShoppingListKind,
  previous?: ShoppingListItem,
  leftoverNote: string | null = null,
  quantities: ShoppingQuantity[] = group.quantities,
): ShoppingListItem {
  const masterHit = resolveFoodMaster(group.ingredientName, {
    masters: loadFoodMasters(),
  });
  const fromMaster = masterHit.master
    ? shoppingCategoryFromFoodCategory(masterHit.master.category)
    : null;

  return {
    id: previous?.id ?? crypto.randomUUID(),
    ingredientName: group.ingredientName,
    checked: previous?.checked ?? false,
    manuallyAdded: false,
    ingredientType: group.ingredientType,
    listKind,
    quantities,
    sources: group.sources,
    leftoverNote,
    shoppingCategory:
      previous?.shoppingCategory ??
      fromMaster ??
      classifyShoppingCategory(group.ingredientName, group.ingredientType),
  };
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
  const masters = loadFoodMasters();

  for (const group of aggregated) {
    const stockStatus = getPantryStockStatus(group.ingredientName);
    const listKind = resolveListKind(group.ingredientType, stockStatus);
    if (listKind === "skip") {
      continue;
    }

    const matchedLeftovers = findMatchingLeftovers(group, leftovers, masters);
    const applied = applyLeftoverToQuantities(group.quantities, matchedLeftovers);
    if (applied.skipBuy) {
      // 家にある分で足りる場合は購入リストから除外（チェック済み維持はしない）
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
        applied.leftoverNote,
        applied.quantities,
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
