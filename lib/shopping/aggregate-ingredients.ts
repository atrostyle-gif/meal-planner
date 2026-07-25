import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import {
  canAggregateQuantity,
  roundScaledQuantity,
} from "@/lib/shopping/scale-ingredient";
import {
  DEFAULT_INGREDIENT_TYPE,
  type IngredientType,
} from "@/types/ingredient-meta";
import type {
  AggregatedIngredientGroup,
  ShoppingItemSource,
  ShoppingQuantity,
} from "@/types/shopping-list";

export type IncomingIngredientRow = {
  ingredientName: string;
  quantity: number | null;
  unit: string;
  note: string;
  recipeId: string;
  recipeName: string;
  mealItemId: string;
  date: string;
  ingredientType: IngredientType;
};

type QuantityDraft = {
  quantity: number | null;
  unit: string;
  note: string;
  aggregatable: boolean;
};

type GroupDraft = {
  ingredientName: string;
  ingredientType: IngredientType;
  quantities: QuantityDraft[];
  sources: ShoppingItemSource[];
};

function quantityKey(unit: string, note: string): string {
  return `${unit.trim().toLowerCase()}|${note.trim()}`;
}

function mergeQuantityLine(
  quantities: QuantityDraft[],
  quantity: number | null,
  unit: string,
  note: string,
): void {
  const unitTrim = unit.trim();
  const noteTrim = note.trim();
  const key = quantityKey(unitTrim, noteTrim);
  const aggregatable = canAggregateQuantity(quantity, unitTrim);

  const existing = quantities.find(
    (line) => quantityKey(line.unit, line.note) === key,
  );

  if (!existing) {
    quantities.push({
      quantity,
      unit: unitTrim,
      note: noteTrim,
      aggregatable,
    });
    return;
  }

  // 同じ単位・メモで数量合計できる場合のみ合算
  if (
    existing.aggregatable &&
    aggregatable &&
    existing.quantity !== null &&
    quantity !== null
  ) {
    existing.quantity = roundScaledQuantity(existing.quantity + quantity);
    return;
  }

  // 適量・少々など非数値は同じ単位なら1行にまとめる（重複カードを防ぐ）
  if (!aggregatable && !existing.aggregatable) {
    return;
  }

  // 片方だけ数値など合算できない場合は別行
  quantities.push({
    quantity,
    unit: unitTrim,
    note: noteTrim,
    aggregatable,
  });
}

/** 再生成時の checked 維持キー（正規化食材名） */
export function buildShoppingItemIdentityKey(item: {
  ingredientName: string;
  manuallyAdded?: boolean;
}): string {
  const nameKey = normalizeIngredientName(item.ingredientName);
  return item.manuallyAdded ? `manual|${nameKey}` : `auto|${nameKey}`;
}

/**
 * 正規化後の食材名でグループ化し、
 * 数量行（単位別）とレシピ内訳を保持する。
 */
export function aggregateIngredients(
  rows: IncomingIngredientRow[],
): AggregatedIngredientGroup[] {
  const groups = new Map<string, GroupDraft>();

  for (const row of rows) {
    const name = row.ingredientName.trim();
    if (name === "") {
      continue;
    }

    const key = normalizeIngredientName(name);
    let group = groups.get(key);
    if (!group) {
      group = {
        ingredientName: name,
        ingredientType: row.ingredientType || DEFAULT_INGREDIENT_TYPE,
        quantities: [],
        sources: [],
      };
      groups.set(key, group);
    }

    // 常備区分はより強い（常備）側を優先
    if (
      group.ingredientType === "normal" &&
      row.ingredientType !== "normal"
    ) {
      group.ingredientType = row.ingredientType;
    }

    mergeQuantityLine(
      group.quantities,
      row.quantity,
      row.unit,
      row.note,
    );

    group.sources.push({
      recipeId: row.recipeId,
      recipeName: row.recipeName,
      mealItemId: row.mealItemId,
      date: row.date,
      quantity: row.quantity,
      unit: row.unit.trim(),
      note: row.note.trim(),
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ingredientName: group.ingredientName,
      ingredientType: group.ingredientType,
      quantities: group.quantities.map(
        (line): ShoppingQuantity => ({
          quantity: line.quantity,
          unit: line.unit,
          note: line.note,
        }),
      ),
      sources: group.sources,
    }))
    .sort((left, right) =>
      normalizeIngredientName(left.ingredientName).localeCompare(
        normalizeIngredientName(right.ingredientName),
        "ja",
      ),
    );
}
