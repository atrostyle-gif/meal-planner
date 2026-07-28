import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  checkShoppingItemsMatchingNames,
  createOrRegenerateShoppingList,
  getShoppingListByWeek,
  replaceShoppingLists,
} from "@/lib/shopping-lists";
import type { MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";

function makeRecipe(): Recipe {
  const now = "2026-07-01T00:00:00.000Z";
  return {
    id: "r1",
    name: "炒め",
    category: "和食",
    course: "主菜",
    servings: 2,
    cookingTimeMinutes: 15,
    ingredients: [
      {
        id: "i1",
        name: "玉ねぎ",
        quantity: 1,
        unit: "個",
        note: "",
        ingredientType: "normal",
      },
      {
        id: "i2",
        name: "にんじん",
        quantity: 1,
        unit: "本",
        note: "",
        ingredientType: "normal",
      },
    ],
    steps: [],
    tags: [],
    memo: "",
    favoriteScore: null,
    createdAt: now,
    updatedAt: now,
  };
}

function makePlan(): MealPlan {
  return {
    id: "p1",
    weekStart: "2026-07-20",
    days: [
      {
        date: "2026-07-20",
        locked: false,
        servings: 2,
        servingsMode: "custom",
        items: [
          {
            id: "m1",
            recipeId: "r1",
            course: "主菜",
            order: 1,
            source: "manual",
          },
        ],
      },
      ...[
        "2026-07-21",
        "2026-07-22",
        "2026-07-23",
        "2026-07-24",
        "2026-07-25",
        "2026-07-26",
      ].map((date) => ({
        date,
        locked: false,
        items: [] as MealPlan["days"][0]["items"],
      })),
    ],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

describe("レシート保存時の買い物リスト自動チェック", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", {
      localStorage: storage,
      dispatchEvent: () => true,
    });
    vi.stubGlobal("CustomEvent", class CustomEvent {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    });
    replaceShoppingLists([]);
  });

  it("一致する食材を購入済みにする", () => {
    createOrRegenerateShoppingList(makePlan(), [makeRecipe()]);
    const before = getShoppingListByWeek("2026-07-20");
    expect(before?.items.some((i) => !i.checked)).toBe(true);

    const names = (before?.items ?? []).map((i) => i.ingredientName);
    const target = names[0];
    expect(target).toBeTruthy();

    const count = checkShoppingItemsMatchingNames("2026-07-20", [
      target!,
      "別の食材",
    ]);
    expect(count).toBe(1);

    const after = getShoppingListByWeek("2026-07-20");
    expect(after?.items.find((i) => i.ingredientName === target)?.checked).toBe(
      true,
    );
  });
});
