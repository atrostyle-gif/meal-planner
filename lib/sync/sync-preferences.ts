/**
 * 同期方法の設定（端末保存）。
 * 初期値は自動で結合する。
 */

export type SyncMergeMode = "auto" | "ask";

const STORAGE_KEY = "meal-planner:syncMergeMode";

const SYNC_MERGE_MODE_CHANGED = "meal-planner:syncMergeModeChanged";

export function getSyncMergeMode(): SyncMergeMode {
  if (typeof window === "undefined") {
    return "auto";
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "ask" || raw === "auto") {
      return raw;
    }
  } catch {
    // ignore
  }
  return "auto";
}

export function setSyncMergeMode(mode: SyncMergeMode): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new Event(SYNC_MERGE_MODE_CHANGED));
}

export function subscribeSyncMergeMode(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  window.addEventListener(SYNC_MERGE_MODE_CHANGED, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(SYNC_MERGE_MODE_CHANGED, listener);
    window.removeEventListener("storage", listener);
  };
}

export function getSyncMergeModeLabel(mode: SyncMergeMode): string {
  return mode === "ask" ? "毎回確認する" : "自動で結合する（推奨）";
}
