import { findFoodMaster } from "@/lib/food-master/match";
import { loadFoodAliasMappings, loadFoodMasters } from "@/lib/food-master/store";
import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import { normalizeStoreName } from "@/lib/stores/normalize-store-name";
import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  isMatchSource,
  normalizeMatchSource,
  type MatchSource,
  type StoreProductMapping,
} from "@/types/store-product-mapping";

export type MappingResolveResult = {
  ingredientName: string;
  normalizedIngredientName: string;
  foodCode: string | null;
  matchSource: MatchSource;
  confidence: number;
  mappingId: string | null;
  needsReview: boolean;
};

export type StoreProductMappingRepository = {
  list(): StoreProductMapping[];
  resolve(input: {
    storeName: string;
    storeId?: string | null;
    rawProductName: string;
    aliases?: string[];
  }): MappingResolveResult;
  confirm(input: {
    storeName: string;
    storeId?: string | null;
    rawProductName: string;
    ingredientName: string;
    previousIngredientName?: string | null;
    foodCode?: string | null;
    createdBy?: string | null;
  }): StoreProductMapping;
  replaceAll(items: StoreProductMapping[]): void;
};

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cached: StoreProductMapping[] = [];

function normalizeRawProduct(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u3000\s]+/g, "")
    .replace(/[★☆●○■□◆◇]/g, "");
}

function migrate(value: unknown): StoreProductMapping | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.rawProductName !== "string" ||
    typeof item.normalizedIngredientName !== "string"
  ) {
    return null;
  }
  const now = new Date().toISOString();
  const source = isMatchSource(item.matchSource)
    ? normalizeMatchSource(item.matchSource)
    : "unknown";
  return {
    id: item.id,
    storeId: typeof item.storeId === "string" ? item.storeId : null,
    storeName: typeof item.storeName === "string" ? item.storeName : "",
    rawProductName: item.rawProductName,
    normalizedRawProductName:
      typeof item.normalizedRawProductName === "string"
        ? item.normalizedRawProductName
        : normalizeRawProduct(item.rawProductName),
    normalizedIngredientName: item.normalizedIngredientName,
    foodCode: typeof item.foodCode === "string" ? item.foodCode : null,
    matchSource: source,
    confirmationCount:
      typeof item.confirmationCount === "number" ? item.confirmationCount : 0,
    correctionCount:
      typeof item.correctionCount === "number" ? item.correctionCount : 0,
    confidence: typeof item.confidence === "number" ? item.confidence : 0,
    firstSeenAt: typeof item.firstSeenAt === "string" ? item.firstSeenAt : now,
    lastSeenAt: typeof item.lastSeenAt === "string" ? item.lastSeenAt : now,
    createdBy: typeof item.createdBy === "string" ? item.createdBy : null,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

function write(items: StoreProductMapping[]): void {
  writeStorage(STORAGE_KEYS.storeProductMappings, items);
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.storeProductMappings);
  cached = items;
  listeners.forEach((l) => l());
}

function load(): StoreProductMapping[] {
  if (typeof window === "undefined") return [];
  if (!hasStorageKey(STORAGE_KEYS.storeProductMappings)) {
    write([]);
    return [];
  }
  const raw = window.localStorage.getItem(STORAGE_KEYS.storeProductMappings);
  if (raw === cachedRaw && cachedRaw !== undefined) return cached;
  const stored = readStorage<unknown>(STORAGE_KEYS.storeProductMappings);
  const list = Array.isArray(stored)
    ? stored.map(migrate).filter((m): m is StoreProductMapping => m !== null)
    : [];
  cachedRaw = raw;
  cached = list;
  return list;
}

function fuzzyScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.75;
  let shared = 0;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  for (let i = 0; i < shorter.length - 1; i += 1) {
    if (longer.includes(shorter.slice(i, i + 2))) shared += 1;
  }
  return shared / Math.max(1, shorter.length - 1);
}

function sameStore(
  m: StoreProductMapping,
  storeId: string | null | undefined,
  storeKey: string,
): boolean {
  return (
    (storeId != null && m.storeId === storeId) ||
    normalizeStoreName(m.storeName) === storeKey
  );
}

export class LocalStoreProductMappingRepository
  implements StoreProductMappingRepository
{
  list(): StoreProductMapping[] {
    return load();
  }

  resolve(input: {
    storeName: string;
    storeId?: string | null;
    rawProductName: string;
    aliases?: string[];
  }): MappingResolveResult {
    const rawKey = normalizeRawProduct(input.rawProductName);
    const storeKey = normalizeStoreName(input.storeName);
    const all = this.list();

    // 1. user_confirmed 完全一致（店舗別）— correction 多い順
    const confirmed = all
      .filter(
        (m) =>
          m.matchSource === "user_confirmed" &&
          m.normalizedRawProductName === rawKey &&
          sameStore(m, input.storeId, storeKey),
      )
      .sort(
        (a, b) =>
          b.confirmationCount +
          b.correctionCount * 2 -
          (a.confirmationCount + a.correctionCount * 2),
      )[0];
    if (confirmed) {
      return {
        ingredientName: confirmed.normalizedIngredientName,
        normalizedIngredientName: confirmed.normalizedIngredientName,
        foodCode: confirmed.foodCode,
        matchSource: "user_confirmed",
        confidence: Math.min(1, 0.85 + confirmed.confirmationCount * 0.02),
        mappingId: confirmed.id,
        needsReview: false,
      };
    }

    // 2. 同一店舗の過去マッピング
    const history = all.find(
      (m) =>
        m.normalizedRawProductName === rawKey &&
        sameStore(m, input.storeId, storeKey),
    );
    if (history) {
      return {
        ingredientName: history.normalizedIngredientName,
        normalizedIngredientName: history.normalizedIngredientName,
        foodCode: history.foodCode,
        matchSource: "exact_history",
        confidence: 0.8,
        mappingId: history.id,
        needsReview: false,
      };
    }

    // 3. 店舗 alias（呼び出し側）
    const aliasHit = (input.aliases ?? []).find(
      (a) => normalizeRawProduct(a) === rawKey,
    );
    if (aliasHit) {
      const name = normalizeIngredientName(aliasHit);
      return {
        ingredientName: name,
        normalizedIngredientName: name,
        foodCode: null,
        matchSource: "store_alias",
        confidence: 0.7,
        mappingId: null,
        needsReview: false,
      };
    }

    // 4. 食品DB alias / Food Master
    try {
      const masters = loadFoodMasters();
      const foodAliases = loadFoodAliasMappings();
      const aliasMap = new Map(
        foodAliases.map((a) => [
          normalizeIngredientName(a.aliasName),
          a.masterId,
        ]),
      );
      const foodHit = findFoodMaster(input.rawProductName, masters, aliasMap);
      if (foodHit.master && foodHit.confidence === "exact") {
        return {
          ingredientName: foodHit.master.canonicalName,
          normalizedIngredientName: normalizeIngredientName(
            foodHit.master.canonicalName,
          ),
          foodCode: foodHit.master.id,
          matchSource: "food_alias",
          confidence: 0.75,
          mappingId: null,
          needsReview: false,
        };
      }
      if (foodHit.master && foodHit.confidence === "alias") {
        return {
          ingredientName: foodHit.master.canonicalName,
          normalizedIngredientName: normalizeIngredientName(
            foodHit.master.canonicalName,
          ),
          foodCode: foodHit.master.id,
          matchSource: "food_alias",
          confidence: 0.72,
          mappingId: null,
          needsReview: false,
        };
      }
      if (foodHit.master && foodHit.confidence === "partial") {
        return {
          ingredientName: foodHit.master.canonicalName,
          normalizedIngredientName: normalizeIngredientName(
            foodHit.master.canonicalName,
          ),
          foodCode: foodHit.master.id,
          matchSource: "normalized_match",
          confidence: 0.55,
          mappingId: null,
          needsReview: true,
        };
      }
    } catch {
      // Food Master 未整備でも続行
    }

    // 5. 正規化一致（他店の同じ raw）
    const cross = all.find((m) => m.normalizedRawProductName === rawKey);
    if (cross) {
      return {
        ingredientName: cross.normalizedIngredientName,
        normalizedIngredientName: cross.normalizedIngredientName,
        foodCode: cross.foodCode,
        matchSource: "normalized_match",
        confidence: 0.65,
        mappingId: cross.id,
        needsReview: true,
      };
    }

    // 6. 曖昧一致
    let best: StoreProductMapping | null = null;
    let bestScore = 0;
    for (const m of all) {
      if (
        input.storeId &&
        m.storeId &&
        m.storeId !== input.storeId &&
        normalizeStoreName(m.storeName) !== storeKey
      ) {
        continue;
      }
      const score = fuzzyScore(rawKey, m.normalizedRawProductName);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    if (best && bestScore >= 0.55) {
      return {
        ingredientName: best.normalizedIngredientName,
        normalizedIngredientName: best.normalizedIngredientName,
        foodCode: best.foodCode,
        matchSource: "fuzzy",
        confidence: bestScore * 0.7,
        mappingId: best.id,
        needsReview: true,
      };
    }

    // 7/8. AI候補は呼び出し側。未分類
    const fallback = normalizeIngredientName(input.rawProductName);
    return {
      ingredientName: fallback || input.rawProductName,
      normalizedIngredientName: fallback || input.rawProductName,
      foodCode: null,
      matchSource: "unknown",
      confidence: 0.2,
      mappingId: null,
      needsReview: true,
    };
  }

  confirm(input: {
    storeName: string;
    storeId?: string | null;
    rawProductName: string;
    ingredientName: string;
    previousIngredientName?: string | null;
    foodCode?: string | null;
    createdBy?: string | null;
  }): StoreProductMapping {
    const now = new Date().toISOString();
    const rawKey = normalizeRawProduct(input.rawProductName);
    const normalizedIngredient = normalizeIngredientName(input.ingredientName);
    const all = this.list();
    const existing = all.find(
      (m) =>
        m.normalizedRawProductName === rawKey &&
        sameStore(m, input.storeId, normalizeStoreName(input.storeName)),
    );

    const corrected =
      input.previousIngredientName != null &&
      normalizeIngredientName(input.previousIngredientName) !==
        normalizedIngredient;

    // 誤候補の信頼度を下げる
    let nextAll = all;
    if (corrected && input.previousIngredientName) {
      nextAll = all.map((m) => {
        if (
          m.normalizedRawProductName === rawKey &&
          m.normalizedIngredientName ===
            normalizeIngredientName(input.previousIngredientName ?? "") &&
          m.id !== existing?.id
        ) {
          return {
            ...m,
            confidence: Math.max(0.1, m.confidence - 0.2),
            updatedAt: now,
          };
        }
        return m;
      });
    }

    if (existing) {
      const next: StoreProductMapping = {
        ...existing,
        normalizedIngredientName: normalizedIngredient,
        foodCode: input.foodCode ?? existing.foodCode,
        matchSource: "user_confirmed",
        confirmationCount: existing.confirmationCount + 1,
        correctionCount: existing.correctionCount + (corrected ? 1 : 0),
        confidence: Math.min(1, existing.confidence + 0.05),
        lastSeenAt: now,
        updatedAt: now,
        storeId: input.storeId ?? existing.storeId,
        storeName: input.storeName,
        createdBy: input.createdBy ?? existing.createdBy,
      };
      write(nextAll.map((m) => (m.id === existing.id ? next : m)));
      return next;
    }

    const created: StoreProductMapping = {
      id: crypto.randomUUID(),
      storeId: input.storeId ?? null,
      storeName: input.storeName,
      rawProductName: input.rawProductName,
      normalizedRawProductName: rawKey,
      normalizedIngredientName: normalizedIngredient,
      foodCode: input.foodCode ?? null,
      matchSource: "user_confirmed",
      confirmationCount: 1,
      correctionCount: corrected ? 1 : 0,
      confidence: 0.9,
      firstSeenAt: now,
      lastSeenAt: now,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    };
    write([created, ...nextAll]);
    return created;
  }

  replaceAll(items: StoreProductMapping[]): void {
    write(items);
  }
}

let mappingRepo: StoreProductMappingRepository | null = null;

export function getMappingRepository(): StoreProductMappingRepository {
  if (!mappingRepo) mappingRepo = new LocalStoreProductMappingRepository();
  return mappingRepo;
}

export function setMappingRepositoryForTest(
  repo: StoreProductMappingRepository | null,
): void {
  mappingRepo = repo;
}

export function subscribeMappings(onChange: Listener): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
