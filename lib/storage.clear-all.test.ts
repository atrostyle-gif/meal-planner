import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllLocalAppData, STORAGE_KEYS } from "@/lib/storage";

describe("clearAllLocalAppData", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const localStorageMock = {
      get length() {
        return store.size;
      },
      key: (index: number) => [...store.keys()][index] ?? null,
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("meal-planner: のキーだけ削除する", () => {
    localStorage.setItem(STORAGE_KEYS.recipes, "[]");
    localStorage.setItem(STORAGE_KEYS.mealPlans, "[]");
    localStorage.setItem("other-app:data", "keep");
    localStorage.setItem("meal-planner:cook-done:2026-01-01:r1", "1");

    const result = clearAllLocalAppData();

    expect(result.removedCount).toBe(3);
    expect(localStorage.getItem(STORAGE_KEYS.recipes)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.mealPlans)).toBeNull();
    expect(localStorage.getItem("meal-planner:cook-done:2026-01-01:r1")).toBeNull();
    expect(localStorage.getItem("other-app:data")).toBe("keep");
  });
});
