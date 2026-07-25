import { canonicalizeIngredientLabel, normalizeIngredientName } from "@/lib/food-master/normalize";
import { findFoodMaster } from "@/lib/food-master/match";
import type { FoodAliasMapping, FoodIngredientMaster } from "@/types/food-master";
import type { LeftoverIngredient, LeftoverPriority } from "@/types/leftover-ingredient";
import type { Recipe } from "@/types/recipe";

export type LeftoverMatch = {
  leftover: LeftoverIngredient;
  ingredientName: string;
  via: "foodMasterId" | "alias" | "name";
};

function priorityPoints(priority: LeftoverPriority): number {
  switch (priority) {
    case "must_use":
      return 28;
    case "soon":
      return 18;
    case "normal":
      return 10;
  }
}

export function resolveLeftoverCanonicalName(
  leftover: LeftoverIngredient,
  masters: FoodIngredientMaster[],
  aliases: FoodAliasMapping[] = [],
): string {
  if (leftover.foodMasterId) {
    const master = masters.find((item) => item.id === leftover.foodMasterId);
    if (master) return canonicalizeIngredientLabel(master.canonicalName);
  }
  const alias = aliases.find(
    (item) =>
      normalizeIngredientName(item.aliasName) ===
      normalizeIngredientName(leftover.name),
  );
  if (alias) {
    const master = masters.find((item) => item.id === alias.masterId);
    if (master) return canonicalizeIngredientLabel(master.canonicalName);
  }
  const found = findFoodMaster(leftover.name, masters);
  if (found.master) return canonicalizeIngredientLabel(found.master.canonicalName);
  return canonicalizeIngredientLabel(leftover.name);
}

export function matchLeftoverToRecipe(
  leftover: LeftoverIngredient,
  recipe: Recipe,
  masters: FoodIngredientMaster[] = [],
  aliases: FoodAliasMapping[] = [],
): LeftoverMatch | null {
  const leftoverCanon = resolveLeftoverCanonicalName(leftover, masters, aliases);
  const leftoverNorm = normalizeIngredientName(leftover.name);

  for (const ingredient of recipe.ingredients) {
    if (leftover.foodMasterId) {
      const master = findFoodMaster(ingredient.name, masters).master;
      if (master && master.id === leftover.foodMasterId) {
        return { leftover, ingredientName: ingredient.name, via: "foodMasterId" };
      }
    }

    const aliasHit = aliases.some(
      (alias) =>
        normalizeIngredientName(alias.aliasName) ===
          normalizeIngredientName(ingredient.name) &&
        (alias.masterId === leftover.foodMasterId ||
          normalizeIngredientName(alias.aliasName) === leftoverNorm),
    );
    if (aliasHit) {
      return { leftover, ingredientName: ingredient.name, via: "alias" };
    }

    const ingredientCanon = canonicalizeIngredientLabel(ingredient.name);
    const ingredientNorm = normalizeIngredientName(ingredient.name);
    if (
      leftoverCanon === ingredientCanon ||
      leftoverNorm === ingredientNorm ||
      ingredientNorm.includes(leftoverNorm) ||
      leftoverNorm.includes(ingredientNorm)
    ) {
      return { leftover, ingredientName: ingredient.name, via: "name" };
    }
  }
  return null;
}

export function findLeftoverMatchesForRecipe(
  recipe: Recipe,
  leftovers: LeftoverIngredient[],
  masters: FoodIngredientMaster[] = [],
  aliases: FoodAliasMapping[] = [],
): LeftoverMatch[] {
  const matches: LeftoverMatch[] = [];
  for (const leftover of leftovers) {
    const hit = matchLeftoverToRecipe(leftover, recipe, masters, aliases);
    if (hit) matches.push(hit);
  }
  return matches;
}

/** 余り食材の利用度を評価（内部スコア。UIには出さない） */
export function evaluateLeftoverIngredientUsage(
  recipe: Recipe,
  leftovers: LeftoverIngredient[],
  masters: FoodIngredientMaster[] = [],
  aliases: FoodAliasMapping[] = [],
): { points: number; reasons: string[]; matchedIds: string[] } {
  if (leftovers.length === 0) {
    return { points: 0, reasons: [], matchedIds: [] };
  }
  const matches = findLeftoverMatchesForRecipe(recipe, leftovers, masters, aliases);
  if (matches.length === 0) {
    return { points: 0, reasons: [], matchedIds: [] };
  }

  let points = 0;
  const names: string[] = [];
  for (const match of matches) {
    points += priorityPoints(match.leftover.priority);
    names.push(match.leftover.name);
  }
  // 複数余りを自然に使えるほど加点（上限あり）
  if (matches.length >= 2) {
    points += 8;
  }
  points = Math.min(points, 50);

  const reasons =
    names.length === 1
      ? [`余っている${names[0]}を使える献立です`]
      : [`${names.slice(0, 3).join("と")}をまとめて使えます`];

  return {
    points,
    reasons,
    matchedIds: matches.map((match) => match.leftover.id),
  };
}

export function evaluateIngredientCoverage(
  recipes: Recipe[],
  leftovers: LeftoverIngredient[],
  masters: FoodIngredientMaster[] = [],
  aliases: FoodAliasMapping[] = [],
): { coveredIds: string[]; uncoveredIds: string[] } {
  const covered = new Set<string>();
  for (const recipe of recipes) {
    for (const match of findLeftoverMatchesForRecipe(recipe, leftovers, masters, aliases)) {
      covered.add(match.leftover.id);
    }
  }
  return {
    coveredIds: leftovers.filter((item) => covered.has(item.id)).map((item) => item.id),
    uncoveredIds: leftovers.filter((item) => !covered.has(item.id)).map((item) => item.id),
  };
}

/** 同じ余り食材が連日続きすぎる場合の減点 */
export function evaluateRepeatedIngredientPenalty(
  recipe: Recipe,
  leftovers: LeftoverIngredient[],
  recentLeftoverUsageCounts: Record<string, number>,
  masters: FoodIngredientMaster[] = [],
  aliases: FoodAliasMapping[] = [],
): { points: number; reasons: string[] } {
  const matches = findLeftoverMatchesForRecipe(recipe, leftovers, masters, aliases);
  let points = 0;
  const reasons: string[] = [];
  for (const match of matches) {
    const count = recentLeftoverUsageCounts[match.leftover.id] ?? 0;
    if (count >= 2) {
      points -= 12;
      reasons.push("余っている食材を使いつつ、同じ食材が続かないようにしました");
    } else if (count >= 1) {
      points -= 4;
    }
  }
  return { points, reasons: [...new Set(reasons)] };
}

export function evaluateAdditionalPurchaseNeeds(
  recipe: Recipe,
  leftovers: LeftoverIngredient[],
  masters: FoodIngredientMaster[] = [],
  aliases: FoodAliasMapping[] = [],
): { points: number; reasons: string[] } {
  if (recipe.ingredients.length === 0) {
    return { points: 0, reasons: [] };
  }
  const matches = findLeftoverMatchesForRecipe(recipe, leftovers, masters, aliases);
  const coverage = matches.length / recipe.ingredients.length;
  if (coverage >= 0.4) {
    return {
      points: 10,
      reasons: ["余っている食材を活かして買い足しを抑えやすい組み合わせです"],
    };
  }
  if (matches.length > 0) {
    return { points: 4, reasons: [] };
  }
  return { points: 0, reasons: [] };
}
