import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/lib/storage";
import {
  areSampleRecipesDismissed,
  areSampleRecipesInitialized,
  deleteRecipe,
  loadRecipes,
  removeSampleRecipes,
  replaceRecipes,
  resetSampleRecipes,
} from "@/lib/recipes";
import type { Recipe } from "@/types/recipe";

function stubLocalStorage(): void {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("window", {
    localStorage: localStorageMock,
    dispatchEvent: () => true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
  vi.stubGlobal(
    "CustomEvent",
    class CustomEvent<T> {
      detail: T | undefined;
      constructor(_type: string, init?: { detail?: T }) {
        this.detail = init?.detail;
      }
    },
  );
}

function userRecipe(id: string): Recipe {
  return {
    id,
    name: "ユーザーレシピ",
    ingredients: [
      {
        id: "i1",
        name: "玉ねぎ",
        quantity: 1,
        unit: "個",
        note: "",
        ingredientType: "normal",
      },
    ],
    steps: [{ id: "s1", order: 1, text: "切る" }],
    category: "和食",
    course: "主菜",
    tags: [],
    servings: 2,
    cookingTimeMinutes: 10,
    memo: "",
    calories: 100,
    protein: 5,
    fat: 3,
    carbohydrates: 10,
    salt: 1,
    vegetables: 50,
    proteinType: null,
    season: null,
    difficulty: 1,
    favoriteScore: 0,
    healthyScore: 0,
    isSample: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("サンプルレシピ初回投入のみ", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it("初回のみサンプルを投入し、initialized を保存する", () => {
    expect(areSampleRecipesInitialized()).toBe(false);
    const first = loadRecipes();
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((recipe) => recipe.isSample)).toBe(true);
    expect(areSampleRecipesInitialized()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.sampleRecipesInitialized)).toBe(
      "true",
    );
  });

  it("削除後にリロード相当でもサンプルは復活しない", () => {
    loadRecipes();
    const removed = removeSampleRecipes();
    expect(removed).toBeGreaterThan(0);
    expect(areSampleRecipesDismissed()).toBe(true);
    expect(loadRecipes().some((recipe) => recipe.isSample)).toBe(false);

    // リロード相当: recipes キーが残ったまま再読込
    expect(loadRecipes().some((recipe) => recipe.isSample)).toBe(false);
  });

  it("recipes キー欠落後も再シードしない", () => {
    loadRecipes();
    removeSampleRecipes();
    localStorage.removeItem(STORAGE_KEYS.recipes);

    const after = loadRecipes();
    expect(after).toEqual([]);
    expect(after.some((recipe) => recipe.isSample)).toBe(false);
    expect(areSampleRecipesInitialized()).toBe(true);
    expect(areSampleRecipesDismissed()).toBe(true);
  });

  it("initialized 済みでキー欠落しても空配列を書き、再投入しない", () => {
    localStorage.setItem(STORAGE_KEYS.sampleRecipesInitialized, "true");
    expect(loadRecipes()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEYS.recipes)).not.toBeNull();
    expect(loadRecipes().some((recipe) => recipe.isSample)).toBe(false);
  });

  it("明示的な resetSampleRecipes では再投入できる", () => {
    loadRecipes();
    removeSampleRecipes();
    replaceRecipes([userRecipe("user-1")]);

    const count = resetSampleRecipes();
    expect(count).toBeGreaterThan(0);
    expect(areSampleRecipesDismissed()).toBe(false);

    const recipes = loadRecipes();
    expect(recipes.some((recipe) => recipe.isSample)).toBe(true);
    expect(recipes.some((recipe) => recipe.id === "user-1")).toBe(true);
  });

  it("最後のサンプルを個別削除すると dismissed になる", () => {
    const samples = loadRecipes();
    expect(samples.length).toBeGreaterThan(0);

    for (const sample of samples.slice(0, -1)) {
      deleteRecipe(sample.id);
    }
    expect(areSampleRecipesDismissed()).toBe(false);

    const last = loadRecipes().find((recipe) => recipe.isSample);
    expect(last).toBeDefined();
    deleteRecipe(last!.id);
    expect(areSampleRecipesDismissed()).toBe(true);
    expect(loadRecipes().some((recipe) => recipe.isSample)).toBe(false);
  });
});
