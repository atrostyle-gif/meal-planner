import { describe, expect, it } from "vitest";
import { resolveQuantityAndUnit, formatQuantity } from "@/lib/ingredient";
import {
  formatGroupQuantitySummary,
  formatQuantityAmount,
} from "@/lib/shopping/format-shopping-item";
import type { ShoppingListItem } from "@/types/shopping-list";

describe("買い物リスト数量表示", () => {
  it("1/3 を分数表記する", () => {
    expect(formatQuantity(1 / 3)).toBe("1/3");
  });

  it("原文メモから 1/3束 を復元する", () => {
    const resolved = resolveQuantityAndUnit(
      null,
      "束",
      "【添える野菜】 / 原文: にら 1/3束",
    );
    expect(resolved.quantity).toBeCloseTo(1 / 3, 5);
    expect(resolved.unit).toBe("束");
  });

  it("一覧では 1/3束 と表示する", () => {
    expect(
      formatQuantityAmount({
        quantity: null,
        unit: "束",
        note: "【添える野菜】 / 原文: にら 1/3束",
      }),
    ).toBe("1/3束");
  });

  it("グループ要約でも 1/3束 になる", () => {
    const item: ShoppingListItem = {
      id: "1",
      ingredientName: "にら",
      checked: false,
      manuallyAdded: false,
      ingredientType: "normal",
      listKind: "buy",
      quantities: [
        {
          quantity: null,
          unit: "束",
          note: "【添える野菜】 / 原文: にら 1/3束",
        },
      ],
      sources: [],
    };
    expect(formatGroupQuantitySummary(item)).toBe("1/3束");
  });
});
