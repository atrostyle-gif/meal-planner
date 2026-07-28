/**
 * 同期時の項目単位マージ（updatedAt の新しい方を採用）。
 */

export type HasIdAndUpdatedAt = {
  id: string;
  updatedAt: string;
};

export type HasUpdatedAt = {
  updatedAt: string;
};

export type MergeByUpdatedAtOptions = {
  /** 指定キーはクラウド側を採用 */
  preferCloudIds?: ReadonlySet<string>;
  /** 指定キーは端末側を採用 */
  preferLocalIds?: ReadonlySet<string>;
};

/**
 * 任意キー単位で統合する。競合指定がなければ updatedAt の新しい方。
 */
export function mergeByKeyUpdatedAt<T extends HasUpdatedAt>(
  local: readonly T[],
  remote: readonly T[],
  getKey: (item: T) => string,
  options?: MergeByUpdatedAtOptions,
): T[] {
  const map = new Map<string, T>();
  const preferCloudIds = options?.preferCloudIds;
  const preferLocalIds = options?.preferLocalIds;

  for (const item of local) {
    map.set(getKey(item), item);
  }

  for (const item of remote) {
    const key = getKey(item);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      continue;
    }
    if (preferCloudIds?.has(key)) {
      map.set(key, item);
      continue;
    }
    if (preferLocalIds?.has(key)) {
      continue;
    }
    map.set(key, item.updatedAt >= prev.updatedAt ? item : prev);
  }

  return [...map.values()];
}

/** id 単位で統合する */
export function mergeByUpdatedAt<T extends HasIdAndUpdatedAt>(
  local: readonly T[],
  remote: readonly T[],
  options?: MergeByUpdatedAtOptions,
): T[] {
  return mergeByKeyUpdatedAt(local, remote, (item) => item.id, options);
}

/**
 * 最終同期以降に、同じキーを端末・クラウドの両方で更新した項目。
 */
export function findSameItemConflictsByKey<T extends HasUpdatedAt>(
  local: readonly T[],
  remote: readonly T[],
  lastSyncedAtMs: number,
  getKey: (item: T) => string,
): T[] {
  if (lastSyncedAtMs <= 0) {
    return [];
  }

  const localChanged = new Map<string, T>();
  for (const item of local) {
    const at = Date.parse(item.updatedAt);
    if (Number.isFinite(at) && at > lastSyncedAtMs) {
      localChanged.set(getKey(item), item);
    }
  }

  const conflicts: T[] = [];
  for (const remoteItem of remote) {
    const remoteAt = Date.parse(remoteItem.updatedAt);
    if (!Number.isFinite(remoteAt) || remoteAt <= lastSyncedAtMs) {
      continue;
    }
    const key = getKey(remoteItem);
    const localItem = localChanged.get(key);
    if (!localItem) {
      continue;
    }
    if (localItem.updatedAt !== remoteItem.updatedAt) {
      conflicts.push(localItem);
    }
  }
  return conflicts;
}

/** id 単位の同一項目競合 */
export function findSameItemConflicts<T extends HasIdAndUpdatedAt>(
  local: readonly T[],
  remote: readonly T[],
  lastSyncedAtMs: number,
): T[] {
  return findSameItemConflictsByKey(local, remote, lastSyncedAtMs, (item) => item.id);
}
