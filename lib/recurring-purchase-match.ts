import {
  canonicalizeIngredientLabel,
  normalizeIngredientName,
} from "@/lib/food-master/normalize";
import { findFoodMaster } from "@/lib/food-master/match";
import { foodMasterMatchKeys, resolveFoodMaster } from "@/lib/food-master/resolve";
import type { FoodAliasMapping, FoodIngredientMaster } from "@/types/food-master";
import type { AggregatedIngredientGroup } from "@/types/shopping-list";
import type { Recipe } from "@/types/recipe";
import type { RecurringPurchaseIngredient } from "@/types/recurring-purchase-ingredient";
import {
  DAYS_OF_WEEK,
  dateToDayOfWeek,
  type DayOfWeek,
} from "@/types/weekly-lifestyle";

export type RecurringPurchaseMatch = {
  item: RecurringPurchaseIngredient;
  ingredientName: string;
  via: "foodMasterId" | "alias" | "name" | "foodCode";
};

/** 定期購入食材の献立加点 */
export const RECURRING_PURCHASE_USE_POINTS = 18;

export function dayOfWeekIndex(day: DayOfWeek): number {
  return DAYS_OF_WEEK.indexOf(day);
}

/** 到着日以降かどうか（到着前は使用可能在庫として扱わない） */
export function isRecurringAvailableOnDate(
  item: RecurringPurchaseIngredient,
  date: string,
): boolean {
  if (!item.active) return false;
  if (item.frequency !== "weekly") return false;
  const mealDayIndex = dayOfWeekIndex(dateToDayOfWeek(date));
  const arrivalIndex = dayOfWeekIndex(item.arrivalDayOfWeek);
  return mealDayIndex >= arrivalIndex;
}

/** 献立自動編成で評価する定期購入食材（到着済み・優先使用ON） */
export function getRecurringForMealPlanningOnDate(
  items: RecurringPurchaseIngredient[],
  date: string,
  householdId = "local",
): RecurringPurchaseIngredient[] {
  return items.filter(
    (item) =>
      (item.householdId === householdId || item.householdId === "local") &&
      item.preferInMealPlan &&
      isRecurringAvailableOnDate(item, date),
  );
}

/** 買い物リスト差し引き対象（有効な毎週定期購入） */
export function getRecurringForShoppingDeduction(
  items: RecurringPurchaseIngredient[],
  householdId = "local",
): RecurringPurchaseIngredient[] {
  return items.filter(
    (item) =>
      (item.householdId === householdId || item.householdId === "local") &&
      item.active &&
      item.frequency === "weekly",
  );
}

function resolveRecurringCanonicalName(
  item: RecurringPurchaseIngredient,
  masters: FoodIngredientMaster[],
  aliases: FoodAliasMapping[] = [],
): string {
  if (item.foodMasterId) {
    const master = masters.find(
      (m) => m.id === item.foodMasterId || m.foodCode === item.foodMasterId,
    );
    if (master) return canonicalizeIngredientLabel(master.canonicalName);
  }
  if (item.foodCode) {
    const master = masters.find(
      (m) => m.foodCode === item.foodCode || m.id === item.foodCode,
    );
    if (master) return canonicalizeIngredientLabel(master.canonicalName);
  }
  const alias = aliases.find(
    (a) =>
      normalizeIngredientName(a.aliasName) ===
      normalizeIngredientName(item.rawName || item.name),
  );
  if (alias) {
    const master = masters.find((m) => m.id === alias.masterId);
    if (master) return canonicalizeIngredientLabel(master.canonicalName);
  }
  const found = resolveFoodMaster(item.rawName || item.name, { masters });
  if (found.master && !found.needsReview) {
    return canonicalizeIngredientLabel(found.master.canonicalName);
  }
  return canonicalizeIngredientLabel(item.name);
}

export function matchRecurringToRecipe(
  item: RecurringPurchaseIngredient,
  recipe: Recipe,
  masters: FoodIngredientMaster[] = [],
  aliases: FoodAliasMapping[] = [],
): RecurringPurchaseMatch | null {
  const itemCanon = resolveRecurringCanonicalName(item, masters, aliases);
  const itemNorm = normalizeIngredientName(item.normalizedName || item.name);
  const itemRawNorm = normalizeIngredientName(item.rawName || item.name);

  for (const ingredient of recipe.ingredients) {
    if (item.foodMasterId || item.foodCode) {
      const master = findFoodMaster(ingredient.name, masters).master;
      if (
        master &&
        (master.id === item.foodMasterId ||
          master.foodCode === item.foodCode ||
          master.id === item.foodCode)
      ) {
        return {
          item,
          ingredientName: ingredient.name,
          via: item.foodCode ? "foodCode" : "foodMasterId",
        };
      }
    }

    const aliasHit = aliases.some(
      (alias) =>
        normalizeIngredientName(alias.aliasName) ===
          normalizeIngredientName(ingredient.name) &&
        (alias.masterId === item.foodMasterId ||
          normalizeIngredientName(alias.aliasName) === itemNorm),
    );
    if (aliasHit) {
      return { item, ingredientName: ingredient.name, via: "alias" };
    }

    const ingredientCanon = canonicalizeIngredientLabel(ingredient.name);
    const ingredientNorm = normalizeIngredientName(ingredient.name);
    if (
      itemCanon === ingredientCanon ||
      itemNorm === ingredientNorm ||
      itemRawNorm === ingredientNorm ||
      ingredientNorm.includes(itemNorm) ||
      itemNorm.includes(ingredientNorm)
    ) {
      return { item, ingredientName: ingredient.name, via: "name" };
    }
  }
  return null;
}

export function findRecurringMatchesForRecipe(
  recipe: Recipe,
  items: RecurringPurchaseIngredient[],
  masters: FoodIngredientMaster[] = [],
  aliases: FoodAliasMapping[] = [],
): RecurringPurchaseMatch[] {
  const matches: RecurringPurchaseMatch[] = [];
  for (const item of items) {
    const hit = matchRecurringToRecipe(item, recipe, masters, aliases);
    if (hit) matches.push(hit);
  }
  return matches;
}

export function findMatchingRecurringPurchases(
  group: AggregatedIngredientGroup,
  items: RecurringPurchaseIngredient[],
  masters: FoodIngredientMaster[],
): RecurringPurchaseIngredient[] {
  const groupKeys = new Set(
    foodMasterMatchKeys(group.ingredientName, masters),
  );
  return items.filter((item) => {
    const keys = foodMasterMatchKeys(item.name, masters);
    return keys.some((key) => groupKeys.has(key));
  });
}

export function evaluateRecurringPurchaseUsage(
  recipe: Recipe,
  items: RecurringPurchaseIngredient[],
  masters: FoodIngredientMaster[] = [],
  aliases: FoodAliasMapping[] = [],
): { points: number; reasons: string[]; matchedIds: string[]; badges: string[] } {
  if (items.length === 0) {
    return { points: 0, reasons: [], matchedIds: [], badges: [] };
  }
  const matches = findRecurringMatchesForRecipe(
    recipe,
    items,
    masters,
    aliases,
  );
  if (matches.length === 0) {
    return { points: 0, reasons: [], matchedIds: [], badges: [] };
  }

  let points = 0;
  const reasons: string[] = [];
  const badges: string[] = [];
  const matchedIds: string[] = [];

  for (const match of matches) {
    matchedIds.push(match.item.id);
    points += RECURRING_PURCHASE_USE_POINTS;
    const storeHint = match.item.storeName
      ? `（${match.item.storeName}）`
      : "";
    reasons.push(`定期購入の${match.item.name}を活用${storeHint}`);
  }

  if (matches.length >= 1) {
    badges.push("定期購入食材を活用");
  }
  if (matches.length >= 2) {
    points += 6;
  }

  return {
    points: Math.min(points, 48),
    reasons,
    matchedIds,
    badges,
  };
}
