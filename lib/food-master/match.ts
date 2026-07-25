import {
  canonicalizeIngredientLabel,
  normalizeIngredientName,
} from "@/lib/food-master/normalize";
import type { FoodIngredientMaster } from "@/types/food-master";

export type FoodMatchResult = {
  master: FoodIngredientMaster | null;
  confidence: "exact" | "alias" | "partial" | "none";
  needsReview: boolean;
};

export function findFoodMaster(
  ingredientName: string,
  masters: FoodIngredientMaster[],
  householdAliasMasterIds?: Map<string, string>,
): FoodMatchResult {
  const label = canonicalizeIngredientLabel(ingredientName);
  const key = normalizeIngredientName(label);

  if (householdAliasMasterIds) {
    const mappedId = householdAliasMasterIds.get(key);
    if (mappedId) {
      const master = masters.find((item) => item.id === mappedId) ?? null;
      return {
        master,
        confidence: master ? "exact" : "none",
        needsReview: !master,
      };
    }
  }

  for (const master of masters) {
    if (normalizeIngredientName(master.canonicalName) === key) {
      return { master, confidence: "exact", needsReview: false };
    }
    if (
      master.aliases.some((alias) => normalizeIngredientName(alias) === key)
    ) {
      return { master, confidence: "alias", needsReview: false };
    }
  }

  // 部分一致（誤検出の可能性あり）
  const partial = masters.find((master) => {
    const canonical = normalizeIngredientName(master.canonicalName);
    return (
      (key.length >= 2 && canonical.includes(key)) ||
      (canonical.length >= 2 && key.includes(canonical)) ||
      master.aliases.some((alias) => {
        const a = normalizeIngredientName(alias);
        return (
          (key.length >= 2 && a.includes(key)) ||
          (a.length >= 2 && key.includes(a))
        );
      })
    );
  });

  if (partial) {
    return { master: partial, confidence: "partial", needsReview: true };
  }

  return { master: null, confidence: "none", needsReview: false };
}
