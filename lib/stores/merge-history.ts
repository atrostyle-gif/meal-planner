import { normalizeStoreName } from "@/lib/stores/normalize-store-name";
import type { StoreMergeHistoryEntry } from "@/lib/stores/resolve-store";
import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";

function load(): StoreMergeHistoryEntry[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.storeMergeHistory)) return [];
  const stored = readStorage<unknown>(STORAGE_KEYS.storeMergeHistory);
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (item): item is StoreMergeHistoryEntry =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as StoreMergeHistoryEntry).rawName === "string" &&
      typeof (item as StoreMergeHistoryEntry).storeId === "string",
  );
}

export function listStoreMergeHistory(): StoreMergeHistoryEntry[] {
  return load();
}

export function recordStoreMerge(rawName: string, storeId: string): void {
  const trimmed = rawName.trim();
  if (!trimmed || !storeId) return;
  const entry: StoreMergeHistoryEntry = {
    rawName: trimmed,
    normalizedRawName: normalizeStoreName(trimmed),
    storeId,
    createdAt: new Date().toISOString(),
  };
  const next = [
    entry,
    ...load().filter(
      (h) =>
        h.normalizedRawName !== entry.normalizedRawName ||
        h.storeId !== storeId,
    ),
  ].slice(0, 200);
  writeStorage(STORAGE_KEYS.storeMergeHistory, next);
}

export function replaceStoreMergeHistory(
  entries: StoreMergeHistoryEntry[],
): void {
  writeStorage(STORAGE_KEYS.storeMergeHistory, entries);
}
