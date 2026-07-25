/**
 * URL取り込みのデバッグ診断（原因調査用）
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

export type JsonLdScriptDiag = {
  index: number;
  parseOk: boolean;
  parseError: string | null;
  hasGraph: boolean;
  types: string[];
  rawPreview: string;
};

export type UrlImportDiagnostics = {
  httpStatus: number | null;
  contentType: string | null;
  finalUrl: string;
  htmlBytes: number;
  htmlHead1000: string;
  ldJsonScriptCount: number;
  scripts: JsonLdScriptDiag[];
  allTypes: string[];
  recipeNodeCount: number;
  failureReason:
    | "none"
    | "html_fetch_failed"
    | "no_json_ld"
    | "json_ld_parse_failed"
    | "no_recipe_node"
    | "html_sections_not_found"
    | "insufficient_recipe_content";
  failureDetail: string;
  debugHtmlSavedTo: string | null;
};

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function collectTypes(data: unknown, out: Set<string>): void {
  if (data == null) return;
  if (Array.isArray(data)) {
    data.forEach((item) => collectTypes(item, out));
    return;
  }
  if (typeof data !== "object") return;
  const obj = data as Record<string, unknown>;
  for (const item of asArray(obj["@type"])) {
    out.add(String(item));
  }
  if (obj["@graph"]) collectTypes(obj["@graph"], out);
}

function hasRecipeType(typeValue: unknown): boolean {
  return asArray(typeValue).some((item) => {
    const text = String(item);
    return (
      text === "Recipe" ||
      text.endsWith("/Recipe") ||
      text.toLowerCase() === "recipe"
    );
  });
}

function collectRecipeNodes(
  data: unknown,
  out: Record<string, unknown>[],
): void {
  if (data == null) return;
  if (Array.isArray(data)) {
    data.forEach((item) => collectRecipeNodes(item, out));
    return;
  }
  if (typeof data !== "object") return;
  const obj = data as Record<string, unknown>;
  if (hasRecipeType(obj["@type"])) {
    out.push(obj);
  }
  if (obj["@graph"]) collectRecipeNodes(obj["@graph"], out);
}

/** type 属性の位置が前後しても拾う */
export function findLdJsonScriptContents(html: string): string[] {
  const contents: string[] = [];
  const scriptTagRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptTagRegex.exec(html)) !== null) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    if (!/type\s*=\s*["']?application\/ld\+json["']?/i.test(attrs)) {
      continue;
    }
    const trimmed = body.trim();
    if (trimmed) contents.push(trimmed);
  }
  return contents;
}

export function diagnoseJsonLd(html: string): {
  scripts: JsonLdScriptDiag[];
  allTypes: string[];
  recipeNodes: Record<string, unknown>[];
  failureReason: UrlImportDiagnostics["failureReason"];
  failureDetail: string;
} {
  const rawScripts = findLdJsonScriptContents(html);
  const scripts: JsonLdScriptDiag[] = [];
  const allTypes = new Set<string>();
  const recipeNodes: Record<string, unknown>[] = [];
  let anyParseOk = false;
  let anyParseFail = false;

  rawScripts.forEach((raw, index) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      anyParseOk = true;
      const types = new Set<string>();
      collectTypes(parsed, types);
      types.forEach((t) => allTypes.add(t));
      const recipes: Record<string, unknown>[] = [];
      collectRecipeNodes(parsed, recipes);
      recipeNodes.push(...recipes);
      const hasGraph =
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        "@graph" in (parsed as object);
      scripts.push({
        index,
        parseOk: true,
        parseError: null,
        hasGraph,
        types: [...types],
        rawPreview: raw.slice(0, 200),
      });
    } catch (error) {
      anyParseFail = true;
      scripts.push({
        index,
        parseOk: false,
        parseError: error instanceof Error ? error.message : "parse error",
        hasGraph: false,
        types: [],
        rawPreview: raw.slice(0, 200),
      });
    }
  });

  if (rawScripts.length === 0) {
    return {
      scripts,
      allTypes: [],
      recipeNodes: [],
      failureReason: "no_json_ld",
      failureDetail: "script[type=application/ld+json] が0件でした",
    };
  }
  if (!anyParseOk && anyParseFail) {
    return {
      scripts,
      allTypes: [...allTypes],
      recipeNodes: [],
      failureReason: "json_ld_parse_failed",
      failureDetail: "JSON-LD の JSON.parse にすべて失敗しました",
    };
  }
  if (recipeNodes.length === 0) {
    return {
      scripts,
      allTypes: [...allTypes],
      recipeNodes: [],
      failureReason: "no_recipe_node",
      failureDetail:
        allTypes.size > 0
          ? `JSON-LDはありますが @type に Recipe がありません（見つかった型: ${[...allTypes].join(", ")}）`
          : "JSON-LDはありますが @type が空、または Recipe ノードがありません",
    };
  }
  return {
    scripts,
    allTypes: [...allTypes],
    recipeNodes,
    failureReason: "none",
    failureDetail: "",
  };
}

export async function saveDebugImportHtml(
  html: string,
  enabled: boolean,
): Promise<string | null> {
  // 本番ではローカル保存を許可しない
  if (process.env.NODE_ENV !== "development") return null;
  if (!enabled) return null;
  const filePath = path.join(process.cwd(), "debug-import.html");
  await writeFile(filePath, html, "utf8");
  return filePath;
}

export function logUrlImportDiagnostics(diag: UrlImportDiagnostics): void {
  // 調査用。URL全体は finalUrl のみ（クエリ過多でも必要最小限）
  console.info("[recipe-import-url:debug]", {
    httpStatus: diag.httpStatus,
    contentType: diag.contentType,
    finalUrl: diag.finalUrl,
    htmlBytes: diag.htmlBytes,
    htmlHead1000: diag.htmlHead1000,
    ldJsonScriptCount: diag.ldJsonScriptCount,
    jsonLdParseResults: diag.scripts.map((script) => ({
      index: script.index,
      parseOk: script.parseOk,
      parseError: script.parseError,
      hasGraph: script.hasGraph,
      types: script.types,
      rawPreview: script.rawPreview,
    })),
    hasGraphAny: diag.scripts.some((script) => script.hasGraph),
    allTypes: diag.allTypes,
    recipeNodeCount: diag.recipeNodeCount,
    failureReason: diag.failureReason,
    failureDetail: diag.failureDetail,
    debugHtmlSavedTo: diag.debugHtmlSavedTo,
  });
}

export function failureReasonToUserMessage(
  reason: UrlImportDiagnostics["failureReason"],
  detail: string,
): { code: string; error: string } {
  switch (reason) {
    case "html_fetch_failed":
      return { code: "html_fetch_failed", error: "HTML取得に失敗しました" };
    case "no_json_ld":
      return {
        code: "no_json_ld",
        error: "JSON-LDなし（ページ内に application/ld+json が見つかりませんでした）",
      };
    case "json_ld_parse_failed":
      return {
        code: "json_ld_parse_failed",
        error: "JSON-LD解析失敗（スクリプトはあるが JSON として読めませんでした）",
      };
    case "no_recipe_node":
      return {
        code: "no_recipe_node",
        error: detail || "Recipeノードなし（JSON-LDに Recipe 型がありませんでした）",
      };
    default:
      return { code: "recipe_not_found", error: "ページ内にレシピ情報が見つかりませんでした" };
  }
}
