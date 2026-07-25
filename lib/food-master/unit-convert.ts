import type { FoodIngredientMaster } from "@/types/food-master";

export type UnitConversionResult =
  | {
      ok: true;
      grams: number;
      method: string;
    }
  | {
      ok: false;
      reason: "optional_amount" | "unknown_unit" | "missing_grams_per_unit" | "invalid_quantity";
      message: string;
    };

const MASS_UNITS: Record<string, number> = {
  g: 1,
  グラム: 1,
  kg: 1000,
  キロ: 1000,
  キログラム: 1000,
};

const VOLUME_AS_GRAM: Record<string, number> = {
  ml: 1,
  ミリリットル: 1,
  cc: 1,
  l: 1000,
  L: 1000,
  リットル: 1000,
};

const SKIP_UNITS = new Set(["適量", "少々", "お好み", "適当", ""]);

/**
 * 材料数量をグラム相当へ換算する。
 * 不明な場合は 0 にせず失敗結果を返す。
 */
export function convertQuantityToGrams(
  quantity: number | null,
  unit: string,
  master: FoodIngredientMaster | null,
): UnitConversionResult {
  const trimmedUnit = unit.trim();

  if (quantity === null || !Number.isFinite(quantity)) {
    if (SKIP_UNITS.has(trimmedUnit) || trimmedUnit === "") {
      return {
        ok: false,
        reason: "optional_amount",
        message: "適量・少々などは栄養計算対象外です",
      };
    }
    return {
      ok: false,
      reason: "invalid_quantity",
      message: "数量が未入力のため計算できません",
    };
  }

  if (SKIP_UNITS.has(trimmedUnit)) {
    return {
      ok: false,
      reason: "optional_amount",
      message: "適量・少々などは栄養計算対象外です",
    };
  }

  const unitKey = trimmedUnit.toLowerCase();
  if (unitKey in MASS_UNITS || trimmedUnit in MASS_UNITS) {
    const factor = MASS_UNITS[unitKey] ?? MASS_UNITS[trimmedUnit];
    return {
      ok: true,
      grams: quantity * factor,
      method: "mass",
    };
  }

  if (unitKey in VOLUME_AS_GRAM || trimmedUnit in VOLUME_AS_GRAM) {
    const factor = VOLUME_AS_GRAM[unitKey] ?? VOLUME_AS_GRAM[trimmedUnit];
    return {
      ok: true,
      grams: quantity * factor,
      method: "volume_as_gram",
    };
  }

  if (trimmedUnit === "大さじ" || trimmedUnit === "TBSP" || trimmedUnit === "tbsp") {
    const per = master?.gramsPerTablespoon ?? 15;
    return { ok: true, grams: quantity * per, method: "tablespoon" };
  }

  if (trimmedUnit === "小さじ" || trimmedUnit === "TSP" || trimmedUnit === "tsp") {
    const per = master?.gramsPerTeaspoon ?? 5;
    return { ok: true, grams: quantity * per, method: "teaspoon" };
  }

  const pieceUnits = new Set(["個", "本", "枚", "玉", "束", "袋", "パック", "缶", "丁", "切れ", "匹"]);
  if (pieceUnits.has(trimmedUnit)) {
    if (!master || master.gramsPerUnit == null) {
      return {
        ok: false,
        reason: "missing_grams_per_unit",
        message: `${trimmedUnit} のグラム換算値が未設定です`,
      };
    }
    return {
      ok: true,
      grams: quantity * master.gramsPerUnit,
      method: "piece_unit",
    };
  }

  return {
    ok: false,
    reason: "unknown_unit",
    message: `単位「${trimmedUnit}」は換算できません`,
  };
}
