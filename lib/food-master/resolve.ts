/**
 * Food Master 解決（別名 → canonical）。
 * 価格・栄養・買い物・献立から共通利用する。
 */
import { findFoodMaster } from "@/lib/food-master/match";
import { normalizeIngredientName } from "@/lib/food-master/normalize";
import {
  buildAliasMap,
  loadFoodAliasMappings,
  loadFoodMasters,
} from "@/lib/food-master/store";
import type {
  FoodFreezableLevel,
  FoodIngredientMaster,
  FoodMaster,
  FoodStorageType,
} from "@/types/food-master";

export type ResolveFoodMasterResult = {
  master: FoodMaster | null;
  foodCode: string | null;
  canonicalName: string;
  matchedBy: "exact" | "alias" | "household_alias" | "partial" | "none";
  needsReview: boolean;
};

/**
 * 価格・在庫照合用の正規化名キー一式（canonical + aliases）。
 * shopping の軽量 normalize と food-master normalize の両方を含める。
 */
export function foodMasterMatchKeys(
  ingredientName: string,
  masters: FoodIngredientMaster[] = loadFoodMasters(),
): string[] {
  const keys = new Set<string>();
  const push = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    keys.add(trimmed.toLowerCase());
    keys.add(normalizeIngredientName(trimmed));
  };
  push(ingredientName);
  const hit = resolveFoodMaster(ingredientName, { masters });
  if (hit.master) {
    push(hit.master.canonicalName);
    for (const alias of hit.master.aliases) {
      push(alias);
    }
  }
  return [...keys];
}

export function getFoodMasterByCode(
  foodCode: string,
  masters: FoodIngredientMaster[] = loadFoodMasters(),
): FoodMaster | null {
  const key = foodCode.trim();
  if (!key) return null;
  return (
    masters.find((m) => m.foodCode === key || m.id === key) ?? null
  );
}

export function resolveFoodMaster(
  ingredientName: string,
  options?: {
    householdId?: string;
    masters?: FoodIngredientMaster[];
  },
): ResolveFoodMasterResult {
  const raw = ingredientName.trim();
  if (!raw) {
    return {
      master: null,
      foodCode: null,
      canonicalName: "",
      matchedBy: "none",
      needsReview: false,
    };
  }
  const masters = options?.masters ?? loadFoodMasters();
  const householdId = options?.householdId ?? "local";
  const aliasMap = buildAliasMap(householdId);
  // normalize キーでも引けるように補完
  for (const mapping of loadFoodAliasMappings()) {
    if (
      mapping.householdId !== householdId &&
      mapping.householdId !== "local"
    ) {
      continue;
    }
    aliasMap.set(normalizeIngredientName(mapping.aliasName), mapping.masterId);
  }

  const hit = findFoodMaster(raw, masters, aliasMap);
  if (!hit.master) {
    return {
      master: null,
      foodCode: null,
      canonicalName: raw,
      matchedBy: "none",
      needsReview: false,
    };
  }

  let matchedBy: ResolveFoodMasterResult["matchedBy"] = "none";
  if (hit.confidence === "exact") matchedBy = "exact";
  else if (hit.confidence === "alias") matchedBy = "alias";
  else if (hit.confidence === "partial") matchedBy = "partial";

  const normalized = normalizeIngredientName(raw);
  if (aliasMap.has(normalized) || aliasMap.has(raw.trim().toLowerCase())) {
    matchedBy = "household_alias";
  }

  return {
    master: hit.master,
    foodCode: hit.master.foodCode || hit.master.id,
    canonicalName: hit.master.canonicalName,
    matchedBy,
    needsReview: hit.needsReview,
  };
}

/** 買い物・表示用: 確定マッチなら canonical、それ以外は元の名前 */
export function resolveCanonicalIngredientName(
  ingredientName: string,
  householdId = "local",
): string {
  const resolved = resolveFoodMaster(ingredientName, { householdId });
  if (
    resolved.master &&
    !resolved.needsReview &&
    (resolved.matchedBy === "exact" ||
      resolved.matchedBy === "alias" ||
      resolved.matchedBy === "household_alias")
  ) {
    return resolved.canonicalName;
  }
  return ingredientName.trim();
}

export function isFoodInSeason(
  master: FoodMaster | null,
  month: number = new Date().getMonth() + 1,
): boolean | null {
  if (!master) return null;
  if (!master.seasonMonths || master.seasonMonths.length === 0) return null;
  return master.seasonMonths.includes(month);
}

export function formatSeasonMonths(months: number[]): string {
  if (months.length === 0) return "通年";
  const sorted = [...months].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (sorted.length === max - min + 1) {
    return `${min}〜${max}月`;
  }
  return `${sorted.join("・")}月`;
}

export function getFoodStorageType(
  master: FoodMaster | null,
): FoodStorageType | null {
  return master?.storageType ?? null;
}

export function getFoodFreezable(
  master: FoodMaster | null,
): FoodFreezableLevel | null {
  return master?.freezable ?? null;
}

export function listSubstituteMasters(
  master: FoodMaster | null,
  masters: FoodIngredientMaster[] = loadFoodMasters(),
): FoodMaster[] {
  if (!master) return [];
  return master.substituteFoods
    .map((code) => getFoodMasterByCode(code, masters))
    .filter((m): m is FoodMaster => m !== null);
}
