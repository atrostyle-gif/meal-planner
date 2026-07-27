import { resolveQuantityAndUnit } from "@/lib/ingredient";
import { formatShoppingQuantity } from "@/lib/shopping/scale-ingredient";
import type {
  ShoppingItemSource,
  ShoppingListItem,
  ShoppingQuantity,
} from "@/types/shopping-list";

/** 欠落した数量をメモ等から補って表示用に正規化する */
function resolvedLine(line: ShoppingQuantity): {
  quantity: number | null;
  unit: string;
  note: string;
} {
  const resolved = resolveQuantityAndUnit(
    line.quantity,
    line.unit,
    line.note,
  );
  return {
    quantity: resolved.quantity,
    unit: resolved.unit,
    note: line.note.trim(),
  };
}

/** 数量＋単位のみ（メモなし。例: 大さじ10 / 3個 / 1/3束） */
export function formatQuantityAmount(line: ShoppingQuantity): string {
  const { quantity, unit } = resolvedLine(line);
  const quantityText = formatShoppingQuantity(quantity);

  if (quantityText !== "" && unit !== "") {
    return `${quantityText}${unit}`;
  }
  if (quantityText !== "") {
    return quantityText;
  }
  return unit;
}

/** 数量行の表示（例: 大さじ10 / 適量 / 3個（メモ）） */
export function formatQuantityLine(line: ShoppingQuantity): string {
  const amount = formatQuantityAmount(line);
  const note = line.note.trim();

  if (note !== "") {
    return amount !== "" ? `${amount}（${note}）` : note;
  }
  return amount;
}

/** 一覧用: 数量＋単位だけを短くまとめる（メモは含めない） */
export function formatGroupQuantitySummary(item: ShoppingListItem): string {
  return item.quantities
    .map((line) => formatQuantityAmount(line))
    .filter((text) => text !== "")
    .join(" / ");
}

/** 数量にメモがあるか */
export function hasShoppingQuantityNotes(item: ShoppingListItem): boolean {
  return item.quantities.some((line) => line.note.trim() !== "");
}

/** 使用レシピ数（日付×レシピの内訳件数） */
export function countShoppingSources(item: ShoppingListItem): number {
  return item.sources.length;
}

export function formatSourceDate(date: string): string {
  if (!date) {
    return "";
  }
  const parts = date.split("-");
  if (parts.length !== 3) {
    return date;
  }
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

export function formatSourceLine(source: ShoppingItemSource): string {
  const amount = formatQuantityAmount({
    quantity: source.quantity,
    unit: source.unit,
    note: source.note,
  });
  const dateLabel = formatSourceDate(source.date);
  const name = source.recipeName || "（レシピ）";
  const head = dateLabel ? `${dateLabel} ${name}` : name;
  return amount !== "" ? `${head}　${amount}` : head;
}
