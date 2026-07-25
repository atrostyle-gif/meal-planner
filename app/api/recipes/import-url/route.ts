import { NextResponse } from "next/server";
import {
  SafeFetchError,
  assertSafeUrl,
  safeFetchHtml,
} from "@/lib/recipe-import/safe-fetch";
import {
  logUrlImportDiagnostics,
  saveDebugImportHtml,
  type UrlImportDiagnostics,
} from "@/lib/recipe-import/url-import-debug";
import {
  rerunUrlImportFromSession,
  runUrlImportPipeline,
} from "@/lib/recipe-import/pipeline";

type ImportUrlRequest = {
  url?: unknown;
  saveDebugHtml?: unknown;
  forceAi?: unknown;
  skipCache?: unknown;
  prepSessionId?: unknown;
  reparse?: unknown;
};

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function shouldSaveDebugHtml(bodyFlag: unknown): boolean {
  if (!isDev()) return false;
  if (bodyFlag === true) return true;
  return process.env.RECIPE_IMPORT_DEBUG === "1";
}

const recentRequests = new Map<string, number>();
const RATE_LIMIT_MS = 2500;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const prev = recentRequests.get(key) ?? 0;
  if (now - prev < RATE_LIMIT_MS) return true;
  recentRequests.set(key, now);
  return false;
}

export async function POST(request: Request): Promise<NextResponse> {
  let diagnostics: UrlImportDiagnostics = {
    httpStatus: null,
    contentType: null,
    finalUrl: "",
    htmlBytes: 0,
    htmlHead1000: "",
    ldJsonScriptCount: 0,
    scripts: [],
    allTypes: [],
    recipeNodeCount: 0,
    failureReason: "html_fetch_failed",
    failureDetail: "",
    debugHtmlSavedTo: null,
  };

  try {
    const body: unknown = await request.json();
    const req = (
      typeof body === "object" && body !== null ? body : {}
    ) as ImportUrlRequest;

    // 再解析（整形本文セッション）
    if (req.reparse === true && typeof req.prepSessionId === "string") {
      if (isRateLimited(`reparse:${req.prepSessionId}`)) {
        return NextResponse.json(
          {
            code: "rate_limited",
            error: "短時間に操作が集中しています。少し待ってから再試行してください",
          },
          { status: 429 },
        );
      }
      const pipeline = await rerunUrlImportFromSession(req.prepSessionId, {
        forceAi: true,
        skipCache: true,
      });
      if (pipeline.code !== "ok" || !pipeline.draft) {
        return NextResponse.json(
          {
            code: pipeline.code,
            error: pipeline.userError ?? "再解析に失敗しました",
            diagnostics: isDev() ? pipeline.diagnostics : undefined,
            prepSessionId: pipeline.prepSessionId,
            proposedDraft: null,
          },
          { status: 422 },
        );
      }
      return NextResponse.json({
        draft: null,
        proposedDraft: pipeline.draft,
        prepSessionId: pipeline.prepSessionId,
        message: pipeline.userMessage,
        warnings: pipeline.draft.warnings ?? [],
        diagnostics: isDev()
          ? {
              ...pipeline.diagnostics,
              importSource: pipeline.importSource,
            }
          : {
              aiRan: pipeline.diagnostics.aiRan,
              successfulMethod: undefined,
            },
      });
    }

    const url = req.url;
    if (typeof url !== "string" || url.trim() === "") {
      return NextResponse.json(
        { code: "invalid_url", error: "URLを入力してください。" },
        { status: 400 },
      );
    }

    if (isRateLimited(`url:${url.trim()}`)) {
      return NextResponse.json(
        {
          code: "rate_limited",
          error: "短時間に操作が集中しています。少し待ってから再試行してください",
        },
        { status: 429 },
      );
    }

    const saveDebug = shouldSaveDebugHtml(req.saveDebugHtml);
    const safeUrl = await assertSafeUrl(url.trim());
    diagnostics.finalUrl = safeUrl.toString();

    const fetched = await safeFetchHtml(safeUrl.toString());
    diagnostics = {
      ...diagnostics,
      httpStatus: fetched.httpStatus,
      contentType: fetched.contentType,
      finalUrl: fetched.finalUrl,
      htmlBytes: fetched.htmlBytes,
      htmlHead1000: isDev() ? fetched.html.slice(0, 1000) : "",
    };

    const savedTo = await saveDebugImportHtml(fetched.html, saveDebug);
    diagnostics.debugHtmlSavedTo = isDev() ? savedTo : null;

    const pipeline = await runUrlImportPipeline(fetched.html, fetched.finalUrl, {
      forceAi: req.forceAi === true,
      skipCache: req.skipCache === true || req.forceAi === true,
    });

    diagnostics = {
      ...diagnostics,
      ldJsonScriptCount: pipeline.jsonLd.scripts.length,
      scripts: pipeline.jsonLd.scripts,
      allTypes: pipeline.jsonLd.allTypes,
      recipeNodeCount: pipeline.jsonLd.recipeNodes.length,
      failureReason:
        pipeline.code === "ok"
          ? "none"
          : pipeline.code === "not_recipe"
            ? "no_recipe_node"
            : pipeline.code === "insufficient_recipe_content"
              ? "insufficient_recipe_content"
              : pipeline.jsonLd.failureReason,
      failureDetail: pipeline.diagnostics.warnings.join(" / "),
      debugHtmlSavedTo: diagnostics.debugHtmlSavedTo,
    };

    logUrlImportDiagnostics(diagnostics);

    const publicDiagnostics = isDev()
      ? {
          httpStatus: diagnostics.httpStatus,
          contentType: diagnostics.contentType,
          finalUrl: diagnostics.finalUrl,
          htmlBytes: diagnostics.htmlBytes,
          ldJsonScriptCount: diagnostics.ldJsonScriptCount,
          allTypes: diagnostics.allTypes,
          recipeNodeCount: diagnostics.recipeNodeCount,
          importSource: pipeline.importSource,
          attemptedMethods: pipeline.diagnostics.attemptedMethods,
          successfulMethod: pipeline.diagnostics.successfulMethod,
          aiRan: pipeline.diagnostics.aiRan,
          aiSkipped: pipeline.diagnostics.aiSkipped,
          aiSkipReason: pipeline.diagnostics.aiSkipReason,
          htmlCharCount: pipeline.diagnostics.htmlCharCount,
          htmlHash: pipeline.diagnostics.htmlHash,
          cacheHit: pipeline.diagnostics.cacheHit,
          elapsedMs: pipeline.diagnostics.elapsedMs,
          detectedSections: pipeline.diagnostics.detectedSections,
          extractedFieldCount: pipeline.diagnostics.extractedFieldCount,
          failedReason: pipeline.diagnostics.failedReason,
          htmlHead1000: diagnostics.htmlHead1000,
          debugHtmlSavedTo: diagnostics.debugHtmlSavedTo,
          scripts: diagnostics.scripts,
        }
      : {
          finalUrl: diagnostics.finalUrl,
          importSource: pipeline.importSource,
          aiRan: pipeline.diagnostics.aiRan,
        };

    if (pipeline.code !== "ok" || !pipeline.draft) {
      return NextResponse.json(
        {
          code: pipeline.code,
          error:
            pipeline.userError ??
            "このページからレシピ情報を読み取れませんでした",
          diagnostics: publicDiagnostics,
          prepSessionId: pipeline.prepSessionId,
          warnings: pipeline.diagnostics.warnings,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      draft: pipeline.draft,
      warnings: pipeline.draft.warnings ?? [],
      diagnostics: publicDiagnostics,
      prepSessionId: pipeline.prepSessionId,
      message: pipeline.userMessage,
    });
  } catch (error) {
    if (error instanceof SafeFetchError) {
      diagnostics = {
        ...diagnostics,
        httpStatus: error.httpStatus,
        contentType: error.contentType,
        finalUrl: error.finalUrl ?? diagnostics.finalUrl,
        failureReason: "html_fetch_failed",
        failureDetail: `${error.code}: ${error.message}`,
      };
      logUrlImportDiagnostics(diagnostics);
      return NextResponse.json(
        {
          code: "fetch_failed",
          error: error.message.startsWith("HTML取得")
            ? error.message
            : `HTML取得に失敗しました（${error.message}）`,
          diagnostics: isDev()
            ? diagnostics
            : {
                httpStatus: diagnostics.httpStatus,
                contentType: diagnostics.contentType,
                finalUrl: diagnostics.finalUrl,
              },
        },
        { status: 400 },
      );
    }
    logUrlImportDiagnostics(diagnostics);
    return NextResponse.json(
      {
        code: "fetch_failed",
        error: "HTML取得に失敗しました",
      },
      { status: 500 },
    );
  }
}
