import { formatShoppingQuantity } from "@/lib/shopping/scale-ingredient";
import type {
  ShoppingItemSource,
  ShoppingListItem,
  ShoppingQuantity,
} from "@/types/shopping-list";

/** 数量行の表示（例: 大さじ10 / 適量 / 3個） */
export function formatQuantityLine(line: ShoppingQuantity): string {
  const quantityText = formatShoppingQuantity(line.quantity);
  const unit = line.unit.trim();
  const note = line.note.trim();

  let amount = "";
  if (quantityText !== "" && unit !== "") {
    amount = `${quantityText}${unit}`;
  } else if (quantityText !== "") {
    amount = quantityText;
  } else if (unit !== "") {
    amount = unit;
  }

  if (note !== "") {
    return amount !== "" ? `${amount}（${note}）` : note;
  }
  return amount;
}

/** 食材グループの数量を短くまとめた表示 */
export function formatGroupQuantitySummary(item: ShoppingListItem): string {
  return item.quantities
    .map((line) => formatQuantityLine(line))
    .filter((text) => text !== "")
    .join(" / ");
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
  const amount = formatQuantityLine({
    quantity: source.quantity,
    unit: source.unit,
    note: source.note,
  });
  const dateLabel = formatSourceDate(source.date);
  const name = source.recipeName || "（レシピ）";
  const head = dateLabel ? `${dateLabel} ${name}` : name;
  return amount !== "" ? `${head}　${amount}` : head;
}
