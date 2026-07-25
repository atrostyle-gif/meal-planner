/**
 * URL取り込みの短期メモリキャッシュ（同一URL+HTMLハッシュ）
 */
import { createHash } from "node:crypto";
import type { RecipeDraft } from "@/types/recipe-import";
import type { AiPreparedPage } from "@/lib/recipe-import/html/preprocess-for-ai";

export type CachedUrlImport = {
  draft: RecipeDraft;
  prepared: AiPreparedPage;
  htmlHash: string;
  importSource: RecipeDraft["importSource"];
  createdAt: number;
};

type CacheEntry = CachedUrlImport;

const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, CacheEntry>();

export function hashHtml(html: string): string {
  return createHash("sha256").update(html).digest("hex");
}

function cacheKey(url: string, htmlHash: string): string {
  return `${url}::${htmlHash}`;
}

export function getUrlImportCache(
  url: string,
  htmlHash: string,
): CacheEntry | null {
  const key = cacheKey(url, htmlHash);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry;
}

export function setUrlImportCache(url: string, entry: Omit<CacheEntry, "createdAt">): void {
  store.set(cacheKey(url, entry.htmlHash), {
    ...entry,
    createdAt: Date.now(),
  });
}

/** 再解析用の一時セッション（整形本文。永続DBには保存しない） */
type PrepSession = {
  sourceUrl: string;
  htmlHash: string;
  prepared: AiPreparedPage;
  jsonLdPartial: RecipeDraft | null;
  createdAt: number;
};

const prepSessions = new Map<string, PrepSession>();

export function createPrepSession(data: Omit<PrepSession, "createdAt">): string {
  const id = createHash("sha256")
    .update(`${data.sourceUrl}:${data.htmlHash}:${Date.now()}`)
    .digest("hex")
    .slice(0, 24);
  prepSessions.set(id, { ...data, createdAt: Date.now() });
  return id;
}

export function getPrepSession(id: string): PrepSession | null {
  const entry = prepSessions.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    prepSessions.delete(id);
    return null;
  }
  return entry;
}
