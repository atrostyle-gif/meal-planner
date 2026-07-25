import {
  DEFAULT_INGREDIENT_TYPE,
  INGREDIENT_UNITS,
  QUANTITY_OPTIONAL_UNITS,
  isIngredientType,
  type Ingredient,
  type IngredientInput,
} from "@/types/recipe";

/** 単位候補を長い順に並べ、パース時の誤分割を減らす */
const UNITS_BY_LENGTH = [...INGREDIENT_UNITS].sort(
  (left, right) => right.length - left.length,
);

export function isQuantityOptionalUnit(unit: string): boolean {
  return QUANTITY_OPTIONAL_UNITS.includes(unit.trim());
}

/** 表示用（例: 玉ねぎ　2個 / 塩　少々） */
export function formatIngredientLine(ingredient: Ingredient): string {
  const name = ingredient.name.trim();
  const unit = ingredient.unit.trim();
  const note = ingredient.note.trim();

  let amountText = "";
  if (ingredient.quantity !== null && unit !== "") {
    amountText = `${formatQuantity(ingredient.quantity)}${unit}`;
  } else if (ingredient.quantity !== null) {
    amountText = formatQuantity(ingredient.quantity);
  } else if (unit !== "") {
    amountText = unit;
  }

  const base =
    amountText !== "" ? `${name}　${amountText}` : name !== "" ? name : "（未命名）";

  return note !== "" ? `${base}（${note}）` : base;
}

export function formatQuantity(quantity: number): string {
  if (Number.isInteger(quantity)) {
    return String(quantity);
  }
  // 小数の無駄な末尾0を抑える
  return String(Number(quantity.toFixed(3)));
}

/**
 * 旧形式の分量文字列（例: "300g", "大さじ2", "適量"）を
 * quantity / unit に分解する。失敗時は null。
 */
export function parseAmountString(amountText: string): {
  quantity: number | null;
  unit: string;
} | null {
  const text = amountText.trim();
  if (text === "") {
    return { quantity: null, unit: "" };
  }

  if (text === "適量" || text === "少々") {
    return { quantity: null, unit: text };
  }

  // 大さじ2 / 小さじ1.5
  const spoonMatch = text.match(/^(大さじ|小さじ)\s*(\d+(?:\.\d+)?)$/);
  if (spoonMatch) {
    return {
      quantity: Number(spoonMatch[2]),
      unit: spoonMatch[1],
    };
  }

  // 1/2本・1/4丁
  const fractionMatch = text.match(/^(\d+)\s*\/\s*(\d+)\s*(.+)$/);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (denominator !== 0) {
      return {
        quantity: numerator / denominator,
        unit: fractionMatch[3].trim(),
      };
    }
  }

  // 2個 / 300g / 0.5袋
  for (const unit of UNITS_BY_LENGTH) {
    if (text.endsWith(unit)) {
      const rawQuantity = text.slice(0, text.length - unit.length).trim();
      if (rawQuantity === "") {
        return { quantity: null, unit };
      }
      const quantity = Number(rawQuantity);
      if (Number.isFinite(quantity)) {
        return { quantity, unit };
      }
    }
  }

  // 単位が候補外（例: 2丁）
  const genericMatch = text.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
  if (genericMatch) {
    return {
      quantity: Number(genericMatch[1]),
      unit: genericMatch[2].trim(),
    };
  }

  return null;
}

/**
 * 旧材料（amount 文字列）または新材料を Ingredient に正規化する。
 */
export function migrateIngredient(value: unknown): Ingredient | null {
  // 材料全体が文字列だった場合
  if (typeof value === "string") {
    return {
      id: crypto.randomUUID(),
      name: value,
      quantity: null,
      unit: "",
      note: "",
      ingredientType: DEFAULT_INGREDIENT_TYPE,
    };
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id : crypto.randomUUID();

  // 旧形式: { name, amount }
  if (typeof item.name === "string" && typeof item.amount === "string") {
    const parsed = parseAmountString(item.amount);
    if (parsed) {
      return {
        id,
        name: item.name,
        quantity: parsed.quantity,
        unit: parsed.unit,
        note: "",
        ingredientType: isIngredientType(item.ingredientType)
          ? item.ingredientType
          : DEFAULT_INGREDIENT_TYPE,
      };
    }

    // 変換できない分量はメモに退避し、食材名は維持
    return {
      id,
      name: item.name,
      quantity: null,
      unit: "",
      note: item.amount.trim(),
      ingredientType: isIngredientType(item.ingredientType)
        ? item.ingredientType
        : DEFAULT_INGREDIENT_TYPE,
    };
  }

  // 新形式（または name のみ）
  if (typeof item.name === "string") {
    return {
      id,
      name: item.name,
      quantity: normalizeQuantity(item.quantity),
      unit: typeof item.unit === "string" ? item.unit : "",
      note: typeof item.note === "string" ? item.note : "",
      ingredientType: isIngredientType(item.ingredientType)
        ? item.ingredientType
        : DEFAULT_INGREDIENT_TYPE,
    };
  }

  return null;
}

function normalizeQuantity(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

/** フォーム入力を保存用 Ingredient に変換 */
export function toIngredient(input: IngredientInput): Ingredient {
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    quantity: input.quantity,
    unit: input.unit.trim(),
    note: input.note.trim(),
    ingredientType: isIngredientType(input.ingredientType)
      ? input.ingredientType
      : DEFAULT_INGREDIENT_TYPE,
  };
}

/** 在庫照合などで使う短い分量テキスト */
export function getIngredientAmountText(ingredient: Ingredient): string {
  const unit = ingredient.unit.trim();
  if (ingredient.quantity !== null && unit !== "") {
    return `${formatQuantity(ingredient.quantity)}${unit}`;
  }
  if (ingredient.quantity !== null) {
    return formatQuantity(ingredient.quantity);
  }
  return unit;
}
