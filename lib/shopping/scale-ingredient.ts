import { formatQuantity } from "@/lib/ingredient";
import { getServingScale } from "@/lib/servings/resolve";
import { QUANTITY_OPTIONAL_UNITS } from "@/types/recipe";

/**
 * 献立の人数補正倍率を計算する。
 * plannedServings（旧 servingsOverride）が無い／不正、または recipe 人数不明なら 1。
 *
 * @deprecated 新規は getServingScale({ recipeServings, plannedServings }) を使う
 */
export function getServingsScale(
  recipeServings: number,
  servingsOverride: number | null | undefined,
): number {
  return getServingScale({
    recipeServings,
    plannedServings: servingsOverride,
  }).scale;
}

/**
 * quantity × plannedServings / recipe.servings
 * 未入力や非数値はそのまま null。
 */
export function scaleIngredientQuantity(
  quantity: number | null,
  recipeServings: number,
  plannedServings: number | null | undefined,
): number | null {
  if (quantity === null || !Number.isFinite(quantity)) {
    return null;
  }

  const { scale } = getServingScale({
    recipeServings,
    plannedServings,
  });
  return roundScaledQuantity(quantity * scale);
}

/** 表示・保存用に実用的な桁へ丸める（切り上げはしない） */
export function roundScaledQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return quantity;
  }
  return Number(quantity.toFixed(3));
}

export function formatShoppingQuantity(quantity: number | null): string {
  if (quantity === null) {
    return "";
  }
  return formatQuantity(quantity);
}

/** 数量を合計できる単位か（適量・少々は不可） */
export function isAggregatableUnit(unit: string): boolean {
  const trimmed = unit.trim();
  return trimmed !== "" && !QUANTITY_OPTIONAL_UNITS.includes(trimmed);
}

/** 数量・単位から合計可能かを判定（メモはグループキー側で区別） */
export function canAggregateQuantity(
  quantity: number | null,
  unit: string,
): boolean {
  if (quantity === null || !Number.isFinite(quantity)) {
    return false;
  }
  if (!isAggregatableUnit(unit)) {
    return false;
  }
  return true;
}
