import {
  canonicalizeIngredientLabel,
  normalizeIngredientName,
} from "@/lib/food-master/normalize";
import { findFoodMaster } from "@/lib/food-master/match";
import { resolveFoodMaster } from "@/lib/food-master/resolve";
import type { FoodAliasMapping, FoodIngredientMaster } from "@/types/food-master";
import type {
  LeftoverIngredient,
  LeftoverUsageSummary,
} from "@/types/leftover-ingredient";
import type { Recipe } from "@/types/recipe";
import type { DayMeal } from "@/types/meal-plan";

export type LeftoverMatch = {
  leftover: LeftoverIngredient;
  ingredientName: string;
  via: "foodMasterId" | "alias" | "name" | "foodCode";
};

/** 今週使い切りたい食材の統一加点（優先度なし） */
export const LEFTOVER_USE_UP_POINTS = 22;

export function resolveLeftoverCanonicalName(
  leftover: LeftoverIngredient,
  masters: FoodIngredientMaster[],
  aliases: FoodAliasMapping[] = [],
): string {
  if (leftover.foodMasterId) {
    const master = masters.find(
      (item) =>
        item.id === leftover.foodMasterId ||
        item.foodCode === leftover.foodMasterId,
    );
    if (master) return canonicalizeIngredientLabel(master.canonicalName);
  }
  if (leftover.foodCode) {
    const master = masters.find(
      (item) => item.foodCode === leftover.foodCode || item.id === leftover.foodCode,
    );
    if (master) return canonicalizeIngredientLabel(master.canonicalName);
  }
  const alias = aliases.find(
    (item) =>
      normalizeIngredientName(item.aliasName) ===
      normalizeIngredientName(leftover.rawName || leftover.name),
  );
  if (alias) {
    const master = masters.find((item) => item.id === alias.masterId);
    if (master) return canonicalizeIngredientLabel(master.canonicalName);
  }
  const found = resolveFoodMaster(leftover.rawName || leftover.name, { masters });
  if (found.master && !found.needsReview) {
    return canonicalizeIngredientLabel(found.master.canonicalName);
  }
  return canonicalizeIngredientLabel(leftover.name);
}

export function matchLeftoverToRecipe(
  leftover: LeftoverIngredient,
  recipe: Recipe,
  masters: FoodIngredientMaster[] = [],
  aliases: FoodAliasMapping[] = [],
): LeftoverMatch | null {
  const leftoverCanon = resolveLeftoverCanonicalName(leftover, masters, aliases);
  const leftoverNorm = normalizeIngredientName(
    leftover.normalizedName || leftover.name,
  );
  const leftoverRawNorm = normalizeIngredientName(
    leftover.rawName || leftover.name,
  );

  for (const ingredient of recipe.ingredients) {
    if (leftover.foodMasterId || leftover.foodCode) {
      const master = findFoodMaster(ingredient.name, masters).master;
      if (
        master &&
        (master.id === leftover.foodMasterId ||
          master.foodCode === leftover.foodCode ||
          master.id === leftover.foodCode)
      ) {
        return {
          leftover,
          ingredientName: ingredient.name,
          via: leftover.foodCode ? "foodCode" : "foodMasterId",
        };
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
      leftoverRawNorm === ingredientNorm ||
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

export type LeftoverScoreOptions = {
  usageCounts?: Record<string, number>;
  /** まだ一度も使われていない余りを強めに拾う */
  preferUnused?: boolean;
};

/**
 * 余り食材の利用度を評価。
 * 入力された食材はすべて「今週使い切りたい」として同ルールで加点。
 */
export function evaluateLeftoverIngredientUsage(
  recipe: Recipe,
  leftovers: LeftoverIngredient[],
  masters: FoodIngredientMaster[] = [],
  aliases: FoodAliasMapping[] = [],
  options: LeftoverScoreOptions = {},
): { points: number; reasons: string[]; matchedIds: string[]; badges: string[] } {
  if (leftovers.length === 0) {
    return { points: 0, reasons: [], matchedIds: [], badges: [] };
  }
  const matches = findLeftoverMatchesForRecipe(
    recipe,
    leftovers,
    masters,
    aliases,
  );
  if (matches.length === 0) {
    return { points: 0, reasons: [], matchedIds: [], badges: [] };
  }

  let points = 0;
  const reasons: string[] = [];
  const badges: string[] = [];
  const usageCounts = options.usageCounts ?? {};

  for (const match of matches) {
    const used = usageCounts[match.leftover.id] ?? 0;
    let add = LEFTOVER_USE_UP_POINTS;
    if (options.preferUnused !== false && used === 0) {
      add += 10;
      reasons.push(`余っている${match.leftover.name}を使用`);
    } else if (used === 1) {
      add += 6;
      reasons.push(`${match.leftover.name}を2品で活用`);
      badges.push("食材使い切り");
    } else {
      add = Math.max(4, add - 8);
    }
    points += add;
  }

  if (matches.length >= 2) {
    points += 8;
    badges.push("余り食材活用");
  } else if (matches.length === 1) {
    badges.push("余り食材活用");
  }

  points = Math.min(points, 56);

  if (reasons.length === 0) {
    const names = matches.map((m) => m.leftover.name);
    reasons.push(
      names.length === 1
        ? `余っている${names[0]}を使用`
        : `${names.slice(0, 3).join("と")}をまとめて使えます`,
    );
  }

  return {
    points,
    reasons: [...new Set(reasons)].slice(0, 3),
    matchedIds: matches.map((match) => match.leftover.id),
    badges: [...new Set(badges)],
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
    for (const match of findLeftoverMatchesForRecipe(
      recipe,
      leftovers,
      masters,
      aliases,
    )) {
      covered.add(match.leftover.id);
    }
  }
  return {
    coveredIds: leftovers
      .filter((item) => covered.has(item.id))
      .map((item) => item.id),
    uncoveredIds: leftovers
      .filter((item) => !covered.has(item.id))
      .map((item) => item.id),
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
  const matches = findLeftoverMatchesForRecipe(
    recipe,
    leftovers,
    masters,
    aliases,
  );
  let points = 0;
  const reasons: string[] = [];
  for (const match of matches) {
    const count = recentLeftoverUsageCounts[match.leftover.id] ?? 0;
    if (count >= 2) {
      points -= 14;
      reasons.push("同じ食材が続かないようにしました");
    } else if (count >= 1) {
      // 2品目は許容（使い切り）、3品目以降を抑える
      points -= 2;
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
  const matches = findLeftoverMatchesForRecipe(
    recipe,
    leftovers,
    masters,
    aliases,
  );
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

/** 献立全体から余り食材の利用状況を集計 */
export function summarizeLeftoverUsage(
  days: DayMeal[],
  recipes: Recipe[],
  leftovers: LeftoverIngredient[],
  masters: FoodIngredientMaster[] = [],
  aliases: FoodAliasMapping[] = [],
): LeftoverUsageSummary {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const usedMap = new Map<
    string,
    { name: string; recipeNames: Set<string> }
  >();

  for (const day of days) {
    for (const item of day.items) {
      if (!item.recipeId) continue;
      const recipe = recipeMap.get(item.recipeId);
      if (!recipe) continue;
      for (const match of findLeftoverMatchesForRecipe(
        recipe,
        leftovers,
        masters,
        aliases,
      )) {
        const entry = usedMap.get(match.leftover.id) ?? {
          name: match.leftover.name,
          recipeNames: new Set<string>(),
        };
        entry.recipeNames.add(recipe.name);
        usedMap.set(match.leftover.id, entry);
      }
    }
  }

  const used = leftovers
    .filter((item) => usedMap.has(item.id))
    .map((item) => {
      const entry = usedMap.get(item.id)!;
      return {
        id: item.id,
        name: entry.name,
        recipeCount: entry.recipeNames.size,
        recipeNames: [...entry.recipeNames],
      };
    });

  const unused = leftovers
    .filter((item) => !usedMap.has(item.id))
    .map((item) => ({ id: item.id, name: item.name }));

  return { used, unused };
}
