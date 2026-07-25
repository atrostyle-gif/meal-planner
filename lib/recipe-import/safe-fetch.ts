/**
 * 外部URL取得の SSRF 対策付き fetch（デバッグメタデータ付き）
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15000;
const MAX_BYTES = 2_000_000;

export type SafeFetchErrorCode =
  | "invalid_url"
  | "blocked_host"
  | "timeout"
  | "too_large"
  | "not_html"
  | "http_error"
  | "redirect_blocked"
  | "fetch_failed";

export class SafeFetchError extends Error {
  code: SafeFetchErrorCode;
  httpStatus: number | null;
  contentType: string | null;
  finalUrl: string | null;

  constructor(
    code: SafeFetchErrorCode,
    message: string,
    meta?: {
      httpStatus?: number | null;
      contentType?: string | null;
      finalUrl?: string | null;
    },
  ) {
    super(message);
    this.code = code;
    this.httpStatus = meta?.httpStatus ?? null;
    this.contentType = meta?.contentType ?? null;
    this.finalUrl = meta?.finalUrl ?? null;
  }
}

export type SafeFetchResult = {
  html: string;
  httpStatus: number;
  contentType: string | null;
  finalUrl: string;
  htmlBytes: number;
};

function isPrivateOrLocalIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe80")) return true;
    return false;
  }
  return true;
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.com",
]);

export async function assertSafeUrl(urlText: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlText);
  } catch {
    throw new SafeFetchError("invalid_url", "URLを確認してください");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("invalid_url", "http / https 以外のURLは使えません");
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new SafeFetchError("blocked_host", "このURLは読み取れません");
  }
  if (host === "169.254.169.254" || host === "metadata") {
    throw new SafeFetchError("blocked_host", "このURLは読み取れません");
  }

  const ipLiteral = isIP(host);
  if (ipLiteral && isPrivateOrLocalIp(host)) {
    throw new SafeFetchError("blocked_host", "このURLは読み取れません");
  }

  if (!ipLiteral) {
    try {
      const records = await lookup(host, { all: true, verbatim: true });
      for (const record of records) {
        if (isPrivateOrLocalIp(record.address)) {
          throw new SafeFetchError("blocked_host", "このURLは読み取れません");
        }
      }
    } catch (error) {
      if (error instanceof SafeFetchError) throw error;
      throw new SafeFetchError("fetch_failed", "HTML取得に失敗しました");
    }
  }

  return url;
}

export async function safeFetchHtml(urlText: string): Promise<SafeFetchResult> {
  let current = await assertSafeUrl(urlText);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ja,en-US;q=0.8,en;q=0.7",
          // 多くのレシピサイトは極端な bot UA を弾くため、一般的なブラウザに近い文字列を使う
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      });

      const contentType = response.headers.get("content-type");

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new SafeFetchError(
            "redirect_blocked",
            "HTML取得に失敗しました（リダイレクト先がありません）",
            {
              httpStatus: response.status,
              contentType,
              finalUrl: current.toString(),
            },
          );
        }
        const next = new URL(location, current);
        current = await assertSafeUrl(next.toString());
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        throw new SafeFetchError(
          "http_error",
          "HTML取得に失敗しました（サイト側で読み取りが制限されています）",
          {
            httpStatus: response.status,
            contentType,
            finalUrl: current.toString(),
          },
        );
      }
      if (!response.ok) {
        throw new SafeFetchError(
          "http_error",
          `HTML取得に失敗しました（HTTP ${response.status}）`,
          {
            httpStatus: response.status,
            contentType,
            finalUrl: current.toString(),
          },
        );
      }

      if (
        contentType &&
        !/text\/html|application\/xhtml\+xml/i.test(contentType)
      ) {
        throw new SafeFetchError(
          "not_html",
          "HTML取得に失敗しました（HTML以外の応答です）",
          {
            httpStatus: response.status,
            contentType,
            finalUrl: current.toString(),
          },
        );
      }

      const lengthHeader = response.headers.get("content-length");
      if (lengthHeader && Number(lengthHeader) > MAX_BYTES) {
        throw new SafeFetchError("too_large", "HTML取得に失敗しました（サイズ超過）", {
          httpStatus: response.status,
          contentType,
          finalUrl: current.toString(),
        });
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new SafeFetchError("fetch_failed", "HTML取得に失敗しました", {
          httpStatus: response.status,
          contentType,
          finalUrl: current.toString(),
        });
      }
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > MAX_BYTES) {
            throw new SafeFetchError("too_large", "HTML取得に失敗しました（サイズ超過）", {
              httpStatus: response.status,
              contentType,
              finalUrl: current.toString(),
            });
          }
          chunks.push(value);
        }
      }
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const html = new TextDecoder("utf-8").decode(merged);
      return {
        html,
        httpStatus: response.status,
        contentType,
        finalUrl: current.toString(),
        htmlBytes: total,
      };
    } catch (error) {
      if (error instanceof SafeFetchError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new SafeFetchError("timeout", "HTML取得に失敗しました（タイムアウト）", {
          finalUrl: current.toString(),
        });
      }
      throw new SafeFetchError("fetch_failed", "HTML取得に失敗しました", {
        finalUrl: current.toString(),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  throw new SafeFetchError("redirect_blocked", "HTML取得に失敗しました（リダイレクト過多）", {
    finalUrl: current.toString(),
  });
}
