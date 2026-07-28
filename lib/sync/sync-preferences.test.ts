import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSyncMergeMode,
  setSyncMergeMode,
} from "@/lib/sync/sync-preferences";

describe("sync-preferences", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
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

  it("初期値は auto", () => {
    expect(getSyncMergeMode()).toBe("auto");
  });

  it("ask を保存できる", () => {
    setSyncMergeMode("ask");
    expect(getSyncMergeMode()).toBe("ask");
  });
});
