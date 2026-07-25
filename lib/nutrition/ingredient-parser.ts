import type { FoodRecord } from "@/types/food-database";

export type ParsedIngredientQuantity = {
  /** 解析できたグラム相当。不能は null */
  grams: number | null;
  quantity: number | null;
  unit: string;
  rawText: string;
  parseStatus: "ok" | "optional" | "unconvertible" | "invalid";
  message: string | null;
};

const SKIP_UNITS = new Set(["適量", "少々", "お好み", "適当", "適宜", ""]);

const MASS: Record<string, number> = {
  g: 1,
  グラム: 1,
  kg: 1000,
  キロ: 1000,
  キログラム: 1000,
};

const VOLUME_AS_G: Record<string, number> = {
  ml: 1,
  ミリリットル: 1,
  cc: 1,
  l: 1000,
  L: 1000,
  リットル: 1000,
};

const PIECE_UNITS = new Set([
  "個",
  "本",
  "枚",
  "玉",
  "束",
  "袋",
  "パック",
  "缶",
  "丁",
  "切れ",
  "匹",
  "杯",
  "合",
]);

/**
 * 数量テキストや Ingredient の quantity/unit からグラムを推定する。
 * 換算不能は null（推測で埋めない）。
 */
export function parseIngredientQuantity(input: {
  quantity: number | null;
  unit: string;
  quantityText?: string | null;
  food?: FoodRecord | null;
}): ParsedIngredientQuantity {
  const unit = (input.unit ?? "").trim();
  const rawText =
    input.quantityText?.trim() ||
    (input.quantity != null ? `${input.quantity}${unit}` : unit);

  if (SKIP_UNITS.has(unit)) {
    return {
      grams: null,
      quantity: input.quantity,
      unit,
      rawText,
      parseStatus: "optional",
      message: "適量・少々などは栄養計算対象外",
    };
  }

  let quantity = input.quantity;
  let resolvedUnit = unit;

  // quantityText から簡易抽出（例: 200g, 大さじ2）
  if ((quantity == null || !unit) && input.quantityText) {
    const parsed = parseQuantityText(input.quantityText);
    if (parsed) {
      quantity = parsed.quantity;
      resolvedUnit = parsed.unit || resolvedUnit;
    }
  }

  if (quantity == null || !Number.isFinite(quantity)) {
    return {
      grams: null,
      quantity: null,
      unit: resolvedUnit,
      rawText,
      parseStatus: "invalid",
      message: "数量を解析できない",
    };
  }

  const unitKey = resolvedUnit.toLowerCase();
  if (unitKey in MASS || resolvedUnit in MASS) {
    const factor = MASS[unitKey] ?? MASS[resolvedUnit];
    return {
      grams: quantity * factor,
      quantity,
      unit: resolvedUnit,
      rawText,
      parseStatus: "ok",
      message: null,
    };
  }

  if (unitKey in VOLUME_AS_G || resolvedUnit in VOLUME_AS_G) {
    const factor = VOLUME_AS_G[unitKey] ?? VOLUME_AS_G[resolvedUnit];
    return {
      grams: quantity * factor,
      quantity,
      unit: resolvedUnit,
      rawText,
      parseStatus: "ok",
      message: null,
    };
  }

  if (
    resolvedUnit === "大さじ" ||
    resolvedUnit === "TBSP" ||
    resolvedUnit === "tbsp"
  ) {
    const per = input.food?.gramsPerTablespoon ?? 15;
    return {
      grams: quantity * per,
      quantity,
      unit: resolvedUnit,
      rawText,
      parseStatus: "ok",
      message: null,
    };
  }

  if (
    resolvedUnit === "小さじ" ||
    resolvedUnit === "TSP" ||
    resolvedUnit === "tsp"
  ) {
    const per = input.food?.gramsPerTeaspoon ?? 5;
    return {
      grams: quantity * per,
      quantity,
      unit: resolvedUnit,
      rawText,
      parseStatus: "ok",
      message: null,
    };
  }

  if (PIECE_UNITS.has(resolvedUnit)) {
    const per = input.food?.gramsPerUnit;
    if (per == null) {
      return {
        grams: null,
        quantity,
        unit: resolvedUnit,
        rawText,
        parseStatus: "unconvertible",
        message: `${resolvedUnit} のグラム換算が未設定`,
      };
    }
    return {
      grams: quantity * per,
      quantity,
      unit: resolvedUnit,
      rawText,
      parseStatus: "ok",
      message: null,
    };
  }

  return {
    grams: null,
    quantity,
    unit: resolvedUnit,
    rawText,
    parseStatus: "unconvertible",
    message: `単位「${resolvedUnit}」は換算できない`,
  };
}

function parseQuantityText(
  text: string,
): { quantity: number; unit: string } | null {
  const trimmed = text.normalize("NFKC").trim();
  const match = trimmed.match(
    /^([0-9]+(?:\.[0-9]+)?(?:\/[0-9]+)?)\s*([^\d\s].*)?$/,
  );
  if (!match) return null;
  const rawQty = match[1];
  let quantity: number;
  if (rawQty.includes("/")) {
    const [a, b] = rawQty.split("/").map(Number);
    if (!b) return null;
    quantity = a / b;
  } else {
    quantity = Number(rawQty);
  }
  if (!Number.isFinite(quantity)) return null;
  return { quantity, unit: (match[2] ?? "").trim() };
}
