import { normalizeStoreName } from "@/lib/stores/normalize-store-name";
import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  isStoreType,
  type Store,
  type StoreInput,
  type WeekStorePlan,
  DEFAULT_WEEK_STORE_PLAN,
} from "@/types/store";

export type StoreRepository = {
  list(): Store[];
  getById(id: string): Store | null;
  findByNameOrAlias(name: string): Store | null;
  upsert(input: StoreInput & { id?: string }): Store;
  remove(id: string): void;
  setPrimary(id: string): void;
  mergeAlias(targetId: string, aliasName: string): Store | null;
  getWeekPlan(weekStart: string): WeekStorePlan;
  saveWeekPlan(plan: WeekStorePlan): void;
};

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cached: Store[] = [];
let weekPlansRaw: string | null | undefined;
let weekPlans: WeekStorePlan[] = [];

function createId(): string {
  return crypto.randomUUID();
}

function migrateStore(value: unknown): Store | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.name !== "string") return null;
  const now = new Date().toISOString();
  return {
    id: item.id,
    name: item.name.trim(),
    normalizedName:
      typeof item.normalizedName === "string"
        ? item.normalizedName
        : normalizeStoreName(item.name),
    aliases: Array.isArray(item.aliases)
      ? item.aliases.filter((a): a is string => typeof a === "string")
      : [],
    storeType: isStoreType(item.storeType) ? item.storeType : "supermarket",
    isPrimary: item.isPrimary === true,
    prefersBulkPurchase: item.prefersBulkPurchase === true,
    defaultPackSizeMultiplier:
      typeof item.defaultPackSizeMultiplier === "number" &&
      item.defaultPackSizeMultiplier > 0
        ? item.defaultPackSizeMultiplier
        : 1.5,
    storeBrandName:
      typeof item.storeBrandName === "string" ? item.storeBrandName : null,
    storeBranchName:
      typeof item.storeBranchName === "string" ? item.storeBranchName : null,
    notes: typeof item.notes === "string" ? item.notes : "",
    createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

function writeStores(stores: Store[]): void {
  writeStorage(STORAGE_KEYS.stores, stores);
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.stores);
  cached = stores;
  listeners.forEach((l) => l());
}

function ensureSeed(): Store[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.stores)) {
    // 初期は空。ユーザーが「ロピア」を主な買い物先として登録できる
    writeStores([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.stores);
  if (raw === cachedRaw && cachedRaw !== undefined) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.stores);
  const list = Array.isArray(stored)
    ? stored.map(migrateStore).filter((s): s is Store => s !== null)
    : [];
  cachedRaw = raw;
  cached = list;
  return list;
}

function writeWeekPlans(plans: WeekStorePlan[]): void {
  writeStorage(STORAGE_KEYS.weekStorePlans, plans);
  weekPlansRaw = window.localStorage.getItem(STORAGE_KEYS.weekStorePlans);
  weekPlans = plans;
  listeners.forEach((l) => l());
}

function loadWeekPlans(): WeekStorePlan[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.weekStorePlans)) {
    writeWeekPlans([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.weekStorePlans);
  if (raw === weekPlansRaw && weekPlansRaw !== undefined) return weekPlans;
  const stored = readStorage<unknown>(STORAGE_KEYS.weekStorePlans);
  const list = Array.isArray(stored)
    ? stored.filter(
        (p): p is WeekStorePlan =>
          typeof p === "object" &&
          p !== null &&
          typeof (p as WeekStorePlan).weekStart === "string",
      )
    : [];
  weekPlansRaw = raw;
  weekPlans = list;
  return list;
}

export class LocalStoreRepository implements StoreRepository {
  list(): Store[] {
    return ensureSeed();
  }

  getById(id: string): Store | null {
    return this.list().find((s) => s.id === id) ?? null;
  }

  findByNameOrAlias(name: string): Store | null {
    const key = normalizeStoreName(name);
    if (!key) return null;
    for (const store of this.list()) {
      if (store.normalizedName === key) return store;
      if (normalizeStoreName(store.name) === key) return store;
      if (store.aliases.some((a) => normalizeStoreName(a) === key)) return store;
      // ブランド名を含む長い店名（例: ロピア寝屋川…）
      if (
        store.storeBrandName &&
        key.includes(normalizeStoreName(store.storeBrandName))
      ) {
        return store;
      }
      if (key.includes(store.normalizedName) || store.normalizedName.includes(key)) {
        return store;
      }
    }
    return null;
  }

  upsert(input: StoreInput & { id?: string }): Store {
    const now = new Date().toISOString();
    const stores = this.list();
    const existing = input.id
      ? stores.find((s) => s.id === input.id)
      : null;
    const store: Store = {
      id: existing?.id ?? input.id ?? createId(),
      name: input.name.trim(),
      normalizedName: normalizeStoreName(input.name),
      aliases: input.aliases ?? existing?.aliases ?? [],
      storeType: input.storeType ?? existing?.storeType ?? "supermarket",
      isPrimary: input.isPrimary ?? existing?.isPrimary ?? stores.length === 0,
      prefersBulkPurchase:
        input.prefersBulkPurchase ?? existing?.prefersBulkPurchase ?? false,
      defaultPackSizeMultiplier:
        input.defaultPackSizeMultiplier ??
        existing?.defaultPackSizeMultiplier ??
        1.5,
      storeBrandName:
        input.storeBrandName !== undefined
          ? input.storeBrandName
          : (existing?.storeBrandName ?? null),
      storeBranchName:
        input.storeBranchName !== undefined
          ? input.storeBranchName
          : (existing?.storeBranchName ?? null),
      notes: input.notes ?? existing?.notes ?? "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    let next = existing
      ? stores.map((s) => (s.id === store.id ? store : s))
      : [store, ...stores];
    if (store.isPrimary) {
      next = next.map((s) =>
        s.id === store.id ? s : { ...s, isPrimary: false },
      );
    }
    writeStores(next);
    return store;
  }

  remove(id: string): void {
    writeStores(this.list().filter((s) => s.id !== id));
  }

  setPrimary(id: string): void {
    writeStores(
      this.list().map((s) => ({
        ...s,
        isPrimary: s.id === id,
        updatedAt: new Date().toISOString(),
      })),
    );
  }

  mergeAlias(targetId: string, aliasName: string): Store | null {
    const target = this.getById(targetId);
    if (!target) return null;
    const alias = aliasName.trim();
    if (!alias) return target;
    const aliases = [...new Set([...target.aliases, alias])];
    return this.upsert({
      id: target.id,
      name: target.name,
      aliases,
      storeBrandName: target.storeBrandName ?? target.name,
    });
  }

  getWeekPlan(weekStart: string): WeekStorePlan {
    const found = loadWeekPlans().find((p) => p.weekStart === weekStart);
    if (found) return found;
    const primary = this.list().find((s) => s.isPrimary);
    return {
      weekStart,
      ...DEFAULT_WEEK_STORE_PLAN,
      plannedStoreIds: primary ? [primary.id] : [],
      primaryPlannedStoreId: primary?.id ?? null,
    };
  }

  saveWeekPlan(plan: WeekStorePlan): void {
    const plans = loadWeekPlans();
    const index = plans.findIndex((p) => p.weekStart === plan.weekStart);
    const next =
      index >= 0
        ? plans.map((p, i) => (i === index ? plan : p))
        : [plan, ...plans];
    writeWeekPlans(next);
  }
}

/** Supabase 実装の差し替え口（テーブル未整備時は Local へフォールバック） */
export class SupabaseStoreRepository implements StoreRepository {
  private local = new LocalStoreRepository();

  list(): Store[] {
    return this.local.list();
  }
  getById(id: string): Store | null {
    return this.local.getById(id);
  }
  findByNameOrAlias(name: string): Store | null {
    return this.local.findByNameOrAlias(name);
  }
  upsert(input: StoreInput & { id?: string }): Store {
    return this.local.upsert(input);
  }
  remove(id: string): void {
    this.local.remove(id);
  }
  setPrimary(id: string): void {
    this.local.setPrimary(id);
  }
  mergeAlias(targetId: string, aliasName: string): Store | null {
    return this.local.mergeAlias(targetId, aliasName);
  }
  getWeekPlan(weekStart: string): WeekStorePlan {
    return this.local.getWeekPlan(weekStart);
  }
  saveWeekPlan(plan: WeekStorePlan): void {
    this.local.saveWeekPlan(plan);
  }
}

let defaultRepo: StoreRepository | null = null;

export function getStoreRepository(): StoreRepository {
  if (!defaultRepo) {
    defaultRepo = new LocalStoreRepository();
  }
  return defaultRepo;
}

/** テスト用 */
export function setStoreRepositoryForTest(repo: StoreRepository | null): void {
  defaultRepo = repo;
}

export function subscribeStores(onChange: Listener): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent): void => {
    if (
      event.key === STORAGE_KEYS.stores ||
      event.key === STORAGE_KEYS.weekStorePlans ||
      event.key === null
    ) {
      cachedRaw = undefined;
      weekPlansRaw = undefined;
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getStoresSnapshot(): Store[] {
  return getStoreRepository().list();
}

const EMPTY_STORES: Store[] = [];
export function getStoresServerSnapshot(): Store[] {
  return EMPTY_STORES;
}

/** 主な買い物先が無いとき、名前で初期登録（固定IDは埋め込まない） */
export function ensurePrimaryStoreByName(name: string): Store {
  const repo = getStoreRepository();
  const existing = repo.findByNameOrAlias(name);
  if (existing) {
    if (!existing.isPrimary) repo.setPrimary(existing.id);
    return repo.getById(existing.id) ?? existing;
  }
  return repo.upsert({
    name,
    isPrimary: true,
    prefersBulkPurchase: /ロピア|業務スーパー|コストコ/.test(name),
    defaultPackSizeMultiplier: 1.5,
    storeBrandName: name,
    storeType: "discount_store",
    notes: "",
  });
}
