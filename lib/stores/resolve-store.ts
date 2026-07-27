import { normalizeStoreName } from "@/lib/stores/normalize-store-name";
import type { Store } from "@/types/store";

export type StoreMatchSource =
  | "exact"
  | "alias"
  | "normalized"
  | "merge_history"
  | "fuzzy"
  | "ai"
  | "unregistered";

export type StoreResolveResult = {
  store: Store | null;
  matchSource: StoreMatchSource;
  confidence: number;
  suggestedBrandName: string | null;
  suggestedBranchName: string | null;
};

export type StoreMergeHistoryEntry = {
  rawName: string;
  normalizedRawName: string;
  storeId: string;
  createdAt: string;
};

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

/**
 * レシート店舗名 → 既存 Store 照合。
 * 優先: 完全一致 → alias → 正規化 → 統合履歴 → 曖昧 → 未登録
 * 未登録を勝手に確定しない。
 */
export function resolveStoreMatch(input: {
  rawName: string | null;
  brandName?: string | null;
  branchName?: string | null;
  stores: Store[];
  mergeHistory?: StoreMergeHistoryEntry[];
}): StoreResolveResult {
  const raw = input.rawName?.trim() || "";
  const key = normalizeStoreName(raw);
  const brandKey = input.brandName
    ? normalizeStoreName(input.brandName)
    : null;

  if (!raw && !brandKey) {
    return {
      store: null,
      matchSource: "unregistered",
      confidence: 0,
      suggestedBrandName: input.brandName ?? null,
      suggestedBranchName: input.branchName ?? null,
    };
  }

  // 1. 完全一致
  for (const store of input.stores) {
    if (store.name === raw || store.normalizedName === key) {
      return {
        store,
        matchSource: "exact",
        confidence: 1,
        suggestedBrandName: store.storeBrandName,
        suggestedBranchName: store.storeBranchName,
      };
    }
  }

  // 2. alias
  for (const store of input.stores) {
    if (store.aliases.some((a) => normalizeStoreName(a) === key || a === raw)) {
      return {
        store,
        matchSource: "alias",
        confidence: 0.95,
        suggestedBrandName: store.storeBrandName,
        suggestedBranchName: store.storeBranchName,
      };
    }
  }

  // 3. 正規化後（ブランド含む）
  for (const store of input.stores) {
    if (
      brandKey &&
      store.storeBrandName &&
      normalizeStoreName(store.storeBrandName) === brandKey
    ) {
      return {
        store,
        matchSource: "normalized",
        confidence: 0.85,
        suggestedBrandName: store.storeBrandName,
        suggestedBranchName: input.branchName ?? store.storeBranchName,
      };
    }
    if (
      store.storeBrandName &&
      key.includes(normalizeStoreName(store.storeBrandName))
    ) {
      return {
        store,
        matchSource: "normalized",
        confidence: 0.8,
        suggestedBrandName: store.storeBrandName,
        suggestedBranchName: input.branchName ?? store.storeBranchName,
      };
    }
  }

  // 4. 過去のユーザー統合履歴
  const history = (input.mergeHistory ?? []).find(
    (h) => h.normalizedRawName === key || h.rawName === raw,
  );
  if (history) {
    const store = input.stores.find((s) => s.id === history.storeId) ?? null;
    if (store) {
      return {
        store,
        matchSource: "merge_history",
        confidence: 0.9,
        suggestedBrandName: store.storeBrandName,
        suggestedBranchName: store.storeBranchName,
      };
    }
  }

  // 5. 曖昧一致
  let best: Store | null = null;
  let bestScore = 0;
  for (const store of input.stores) {
    const score = Math.max(
      fuzzyScore(key, store.normalizedName),
      ...store.aliases.map((a) => fuzzyScore(key, normalizeStoreName(a))),
    );
    if (score > bestScore) {
      bestScore = score;
      best = store;
    }
  }
  if (best && bestScore >= 0.6) {
    return {
      store: best,
      matchSource: "fuzzy",
      confidence: bestScore * 0.7,
      suggestedBrandName: best.storeBrandName,
      suggestedBranchName: best.storeBranchName,
    };
  }

  // 6/7. AI候補は呼び出し側。ここでは未登録
  return {
    store: null,
    matchSource: "unregistered",
    confidence: 0.2,
    suggestedBrandName: input.brandName ?? guessBrand(raw),
    suggestedBranchName: input.branchName ?? null,
  };
}

function guessBrand(raw: string): string | null {
  if (/ロピア/.test(raw)) return "ロピア";
  if (/イオン|AEON/i.test(raw)) return "イオン";
  if (/業務スーパー|業務ｽｰﾊﾟｰ/.test(raw)) return "業務スーパー";
  if (/コストコ|Costco/i.test(raw)) return "コストコ";
  return null;
}
