import {
  AMOUNT_PRESET_LABELS,
  type AmountPreset,
  type InventoryAmount,
} from "@/types/inventory";

/** 残量を一覧表示用の短い文字列にする */
export function formatInventoryAmount(
  amount: InventoryAmount | null,
  unit: string,
): string {
  if (amount === null) {
    return unit.trim() !== "" ? `単位: ${unit.trim()}` : "残量未設定";
  }

  const unitText = unit.trim();

  if (amount.kind === "preset") {
    const label = AMOUNT_PRESET_LABELS[amount.preset];
    return unitText !== "" ? `${label}（${unitText}）` : label;
  }

  if (amount.kind === "text") {
    const value = amount.value.trim();
    if (value === "") {
      return unitText !== "" ? `単位: ${unitText}` : "残量未設定";
    }
    return unitText !== "" ? `${value}${unitText}` : value;
  }

  // quantity（将来用）
  const quantityText = String(amount.value);
  return unitText !== "" ? `${quantityText}${unitText}` : quantityText;
}

export function isAmountPreset(value: string): value is AmountPreset {
  return value === "little" || value === "half" || value === "lot";
}
