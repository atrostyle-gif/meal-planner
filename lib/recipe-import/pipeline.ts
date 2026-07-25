/**
 * URL取り込みハイブリッドパイプライン
 * JSON-LD十分 → 採用 / 不足 → AI構造化（ルールは本文候補とAI不可時フォールバック）
 */
import { assessJsonLdQuality } from "@/lib/recipe-import/json-ld-quality";
import { diagnoseJsonLd } from "@/lib/recipe-import/url-import-debug";
import { extractOpenGraph, loadCleanDom } from "@/lib/recipe-import/html/dom";
import { extractByHtmlRules } from "@/lib/recipe-import/html/rules";
import { preparePageForAi } from "@/lib/recipe-import/html/preprocess-for-ai";
import { mergeRecipeSources } from "@/lib/recipe-import/merge-sources";
import {
  createPrepSession,
  getUrlImportCache,
  hashHtml,
  setUrlImportCache,
} from "@/lib/recipe-import/url-import-cache";
import {
  getRecipeUrlImportProvider,
  estimateAiPayloadCharCount,
  type RecipeUrlImportProvider,
} from "@/lib/recipe-import/url-provider";
import { validateAiExtraction } from "@/lib/recipe-import/validate-draft";
import { createSampleFoodMasters } from "@/lib/food-master/sample-data";
import type { RecipeDraft } from "@/types/recipe-import";
import {
  logAiCallBefore,
  logAiFinalDecision,
  logAiResponse,
  logAiSchemaValidation,
  type AiFailedReason,
} from "@/lib/recipe-import/ai-debug-log";
import { getRecipeImportModel } from "@/lib/recipe-import/ai-schema";

export type UrlImportPipelineOptions = {
  forceAi?: boolean;
  skipCache?: boolean;
  provider?: RecipeUrlImportProvider;
  foodMasterHints?: string[];
};

export type UrlImportPipelineResult = {
  draft: RecipeDraft | null;
  userError: string | null;
  userMessage: string | null;
  code:
    | "ok"
    | "not_recipe"
    | "insufficient_recipe_content"
    | "ai_unavailable"
    | "ai_timeout"
    | "ai_parse_failed"
    | "ai_failed"
    | "failed";
  importSource: RecipeDraft["importSource"];
  prepSessionId: string | null;
  diagnostics: {
    attemptedMethods: Array<{
      method: string;
      ok: boolean;
      detail: string;
    }>;
    successfulMethod: string | null;
    jsonLdSufficient: boolean;
    aiRan: boolean;
    aiSkipped: boolean;
    aiSkipReason: string | null;
    htmlCharCount: number;
    htmlHash: string;
    cacheHit: boolean;
    elapsedMs: number;
    warnings: string[];
    detectedSections: string[];
    extractedFieldCount: number;
    /** 開発診断用。失敗時の単一理由コード */
    failedReason: AiFailedReason | null;
  };
  jsonLd: ReturnType<typeof diagnoseJsonLd>;
};

function countFields(draft: RecipeDraft | null): number {
  if (!draft) return 0;
  let n = 0;
  if (draft.title) n += 1;
  if (draft.description) n += 1;
  if (draft.servings != null) n += 1;
  n += draft.ingredients.length + draft.steps.length;
  if (draft.imageUrl) n += 1;
  return n;
}

function defaultFoodHints(): string[] {
  return createSampleFoodMasters()
    .slice(0, 40)
    .flatMap((item) => [item.canonicalName, ...(item.aliases ?? []).slice(0, 2)]);
}

function userFacingMethodMessage(source: RecipeDraft["importSource"]): string | null {
  switch (source) {
    case "json_ld":
      return "ページの構造化データから読み取りました";
    case "ai_html":
      return "AIでページ本文を整理しました";
    case "hybrid":
      return "構造化データとAI解析を組み合わせました";
    case "html_rules":
      return "一部だけ読み取れました。内容を確認してください";
    default:
      return null;
  }
}

function isAcceptable(draft: RecipeDraft | null): boolean {
  if (!draft?.title) return false;
  return draft.ingredients.length >= 1 || draft.steps.length >= 1;
}

export async function runUrlImportPipeline(
  html: string,
  sourceUrl: string,
  options: UrlImportPipelineOptions = {},
): Promise<UrlImportPipelineResult> {
  const started = Date.now();
  const attemptedMethods: UrlImportPipelineResult["diagnostics"]["attemptedMethods"] = [];
  const htmlHash = hashHtml(html);
  const jsonLdDiag = diagnoseJsonLd(html);

  if (!options.skipCache && !options.forceAi) {
    const cached = getUrlImportCache(sourceUrl, htmlHash);
    if (cached) {
      return {
        draft: cached.draft,
        userError: null,
        userMessage: userFacingMethodMessage(cached.importSource),
        code: "ok",
        importSource: cached.importSource,
        prepSessionId: null,
        jsonLd: jsonLdDiag,
        diagnostics: {
          attemptedMethods: [{ method: "cache", ok: true, detail: "短期キャッシュを再利用" }],
          successfulMethod: "cache",
          jsonLdSufficient: cached.importSource === "json_ld",
          aiRan: false,
          aiSkipped: true,
          aiSkipReason: "キャッシュヒット",
          htmlCharCount: cached.prepared.charCount,
          htmlHash,
          cacheHit: true,
          elapsedMs: Date.now() - started,
          warnings: cached.draft.warnings ?? [],
          detectedSections: cached.prepared.candidateSections,
          extractedFieldCount: countFields(cached.draft),
        failedReason: null,
        },
      };
    }
  }

  const quality = assessJsonLdQuality(html, sourceUrl);
  attemptedMethods.push({
    method: "json_ld",
    ok: quality.sufficient,
    detail: quality.reasons.join(" / ") || "JSON-LD評価",
  });

  const prepared = preparePageForAi(html, sourceUrl);
  const $ = loadCleanDom(html);
  const og = extractOpenGraph($);
  const rulesExtraction = extractByHtmlRules($, sourceUrl, og);

  const prepSessionId = createPrepSession({
    sourceUrl,
    htmlHash,
    prepared,
    jsonLdPartial: quality.draft,
  });

  if (quality.sufficient && quality.draft && !options.forceAi) {
    const merged = mergeRecipeSources({
      sourceUrl,
      jsonLd: quality.draft,
      jsonLdSufficient: true,
      ai: null,
      rules: null,
      og,
    });
    setUrlImportCache(sourceUrl, {
      draft: merged.draft,
      prepared,
      htmlHash,
      importSource: "json_ld",
    });
    return {
      draft: merged.draft,
      userError: null,
      userMessage: userFacingMethodMessage("json_ld"),
      code: "ok",
      importSource: "json_ld",
      prepSessionId,
      jsonLd: jsonLdDiag,
      diagnostics: {
        attemptedMethods,
        successfulMethod: "json_ld",
        jsonLdSufficient: true,
        aiRan: false,
        aiSkipped: true,
        aiSkipReason: "JSON-LDが十分のためスキップ",
        htmlCharCount: prepared.charCount,
        htmlHash,
        cacheHit: false,
        elapsedMs: Date.now() - started,
        warnings: merged.warnings,
        detectedSections: prepared.candidateSections,
        extractedFieldCount: countFields(merged.draft),
      failedReason: null,
      },
    };
  }

  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
  const provider =
    options.provider ?? getRecipeUrlImportProvider();

  if (!hasApiKey && !options.provider) {
    attemptedMethods.push({
      method: "ai_html",
      ok: false,
      detail: "OPENAI_API_KEY 未設定",
    });
    const merged = mergeRecipeSources({
      sourceUrl,
      jsonLd: quality.draft,
      jsonLdSufficient: false,
      ai: null,
      rules: rulesExtraction.draft,
      og,
    });
    attemptedMethods.push({
      method: "html_rules",
      ok: isAcceptable(merged.draft),
      detail: "AI未設定のため限定的ルールフォールバック",
    });

    if (isAcceptable(merged.draft)) {
      return {
        draft: {
          ...merged.draft,
          warnings: [
            ...(merged.draft.warnings ?? []),
            "AIによるページ解析を利用するには、サーバー側のOPENAI_API_KEY設定が必要です",
            "内容を確認してください",
          ],
        },
        userError: null,
        userMessage: "一部だけ読み取れました。内容を確認してください",
        code: "ok",
        importSource: merged.importSource,
        prepSessionId,
        jsonLd: jsonLdDiag,
        diagnostics: {
          attemptedMethods,
          successfulMethod: "html_rules_fallback",
          jsonLdSufficient: false,
          aiRan: false,
          aiSkipped: true,
          aiSkipReason: "OPENAI_API_KEY 未設定",
          htmlCharCount: prepared.charCount,
          htmlHash,
          cacheHit: false,
          elapsedMs: Date.now() - started,
          warnings: merged.warnings,
          detectedSections: prepared.candidateSections,
          extractedFieldCount: countFields(merged.draft),
        failedReason: null,
        },
      };
    }

    logAiFinalDecision({
      failedReason: "AI_UNAVAILABLE",
      code: "ai_unavailable",
      detail: "OPENAI_API_KEY 未設定かつフォールバック不足",
    });
    return {
      draft: null,
      userError:
        "AIによるページ解析を利用するには、サーバー側のOPENAI_API_KEY設定が必要です",
      userMessage: null,
      code: "ai_unavailable",
      importSource: "failed",
      prepSessionId,
      jsonLd: jsonLdDiag,
      diagnostics: {
        attemptedMethods,
        successfulMethod: null,
        jsonLdSufficient: false,
        aiRan: false,
        aiSkipped: true,
        aiSkipReason: "OPENAI_API_KEY 未設定",
        htmlCharCount: prepared.charCount,
        htmlHash,
        cacheHit: false,
        elapsedMs: Date.now() - started,
        warnings: [],
        detectedSections: prepared.candidateSections,
        extractedFieldCount: 0,
        failedReason: "AI_UNAVAILABLE",
      },
    };
  }

  const foodMasterHints = options.foodMasterHints ?? defaultFoodHints();
  const aiInput = {
    sourceUrl,
    prepared,
    jsonLdPartial: quality.draft,
    foodMasterHints,
  };
  const aiRunReason = options.forceAi
    ? "ユーザーがAI再解析を指定"
    : quality.sufficient
      ? "force/不足判定の再評価"
      : `JSON-LD不十分: ${quality.reasons.join(" / ") || quality.missing.join(", ") || "不明"}`;

  logAiCallBefore({
    model: options.provider ? "custom-provider" : getRecipeImportModel(),
    payloadCharCount: estimateAiPayloadCharCount(aiInput),
    preparedCharCount: prepared.charCount,
    preparedHead1000: prepared.structuredText.slice(0, 1000),
    jsonLdQuality: {
      hasRecipeNode: quality.hasRecipeNode,
      sufficient: quality.sufficient,
      reasons: quality.reasons,
      missing: quality.missing,
      ingredientCount: quality.ingredientCount,
      stepCount: quality.stepCount,
    },
    aiRunReason,
    sourceUrl,
    preprocess: prepared.preprocessDebug
      ? {
          selectedRoot: prepared.preprocessDebug.selectedRoot,
          selectedRootSelector: prepared.preprocessDebug.selectedRootSelector,
          charsBeforeExtract: prepared.preprocessDebug.charsBeforeExtract,
          charsAfterExtract: prepared.preprocessDebug.charsAfterExtract,
          removedTagCount: prepared.preprocessDebug.removedTagCount,
        }
      : null,
  });

  const aiResponse = await provider.extractRecipeFromPage(aiInput);

  logAiResponse({
    httpStatus: aiResponse.debug.httpStatus,
    requestId: aiResponse.debug.requestId,
    finishReason: aiResponse.debug.finishReason,
    tokenUsage: aiResponse.debug.tokenUsage,
    rawResponseJson: aiResponse.debug.rawResponseJson,
    contentBeforeSchema: aiResponse.debug.contentBeforeSchema,
    outputTextPreview: aiResponse.debug.outputTextPreview,
    providerError: aiResponse.error,
  });

  if (aiResponse.error && !aiResponse.raw) {
    attemptedMethods.push({
      method: "ai_html",
      ok: false,
      detail: aiResponse.error,
    });
    const failedReason: AiFailedReason =
      aiResponse.error === "ai_timeout"
        ? "AI_TIMEOUT"
        : aiResponse.error === "ai_unavailable"
          ? "AI_UNAVAILABLE"
          : aiResponse.debug.jsonParseError === "empty output_text"
            ? "AI_EMPTY_RESPONSE"
            : aiResponse.debug.jsonParseError
              ? "JSON_PARSE_ERROR"
              : "OPENAI_API_ERROR";

    logAiSchemaValidation({
      ok: false,
      zodErrorFull: null,
      failedFields: [],
      enumMismatches: [],
      missingRequired: [],
      jsonParseError: aiResponse.debug.jsonParseError,
      documentType: null,
    });

    const merged = mergeRecipeSources({
      sourceUrl,
      jsonLd: quality.draft,
      jsonLdSufficient: false,
      ai: null,
      rules: rulesExtraction.draft,
      og,
    });
    if (isAcceptable(merged.draft)) {
      logAiFinalDecision({
        failedReason: null,
        code: "ok",
        detail: "AI失敗後にルールフォールバック成功",
      });
      return {
        draft: {
          ...merged.draft,
          warnings: [
            ...(merged.draft.warnings ?? []),
            "AI解析に失敗したため、限定的な結果です。内容を確認してください",
          ],
        },
        userError: null,
        userMessage: "一部だけ読み取れました。内容を確認してください",
        code: "ok",
        importSource: merged.importSource,
        prepSessionId,
        jsonLd: jsonLdDiag,
        diagnostics: {
          attemptedMethods,
          successfulMethod: "fallback_after_ai_error",
          jsonLdSufficient: false,
          aiRan: true,
          aiSkipped: false,
          aiSkipReason: null,
          htmlCharCount: prepared.charCount,
          htmlHash,
          cacheHit: false,
          elapsedMs: Date.now() - started,
          warnings: merged.warnings,
          detectedSections: prepared.candidateSections,
          extractedFieldCount: countFields(merged.draft),
          failedReason: null,
        },
      };
    }
    const code =
      aiResponse.error === "ai_timeout"
        ? "ai_timeout"
        : aiResponse.error === "ai_parse_failed"
          ? "ai_parse_failed"
          : aiResponse.error === "ai_unavailable"
            ? "ai_unavailable"
            : "ai_failed";
    logAiFinalDecision({
      failedReason,
      code,
      detail: aiResponse.error,
    });
    return {
      draft: null,
      userError:
        code === "ai_timeout"
          ? "AI解析がタイムアウトしました。時間をおいて再試行してください"
          : "このページからレシピを読み取れませんでした",
      userMessage: null,
      code,
      importSource: "failed",
      prepSessionId,
      jsonLd: jsonLdDiag,
      diagnostics: {
        attemptedMethods,
        successfulMethod: null,
        jsonLdSufficient: false,
        aiRan: true,
        aiSkipped: false,
        aiSkipReason: null,
        htmlCharCount: prepared.charCount,
        htmlHash,
        cacheHit: false,
        elapsedMs: Date.now() - started,
        warnings: [],
        detectedSections: prepared.candidateSections,
        extractedFieldCount: 0,
        failedReason,
      },
    };
  }

  const validated = validateAiExtraction(aiResponse.raw, sourceUrl);
  logAiSchemaValidation({
    ok: validated.ok,
    zodErrorFull: validated.schemaDebug.zodErrorFull,
    failedFields: validated.schemaDebug.failedFields,
    enumMismatches: validated.schemaDebug.enumMismatches,
    missingRequired: validated.schemaDebug.missingRequired,
    jsonParseError: validated.schemaDebug.jsonParseError,
    documentType: validated.documentType,
  });
  attemptedMethods.push({
    method: "ai_html",
    ok: validated.ok,
    detail: validated.ok
      ? "AI構造化に成功"
      : validated.errors.join(" / ") || "AI検証失敗",
  });

  if (!validated.ok && validated.documentType !== "not_recipe" && !validated.draft) {
    const failedReason: AiFailedReason = validated.schemaDebug.zodErrorFull
      ? "SCHEMA_VALIDATION_ERROR"
      : "INSUFFICIENT_RECIPE_CONTENT";
    // schema失敗時もルールフォールバックを試す
    const merged = mergeRecipeSources({
      sourceUrl,
      jsonLd: quality.draft,
      jsonLdSufficient: false,
      ai: null,
      rules: rulesExtraction.draft,
      og,
    });
    if (isAcceptable(merged.draft)) {
      logAiFinalDecision({
        failedReason: null,
        code: "ok",
        detail: "Schema失敗後にルールフォールバック成功",
      });
      return {
        draft: {
          ...merged.draft,
          warnings: [
            ...(merged.draft.warnings ?? []),
            "AI応答の検証に失敗したため、限定的な結果です。内容を確認してください",
            ...validated.errors.slice(0, 3),
          ],
        },
        userError: null,
        userMessage: "一部だけ読み取れました。内容を確認してください",
        code: "ok",
        importSource: merged.importSource,
        prepSessionId,
        jsonLd: jsonLdDiag,
        diagnostics: {
          attemptedMethods,
          successfulMethod: "fallback_after_schema_error",
          jsonLdSufficient: false,
          aiRan: true,
          aiSkipped: false,
          aiSkipReason: null,
          htmlCharCount: prepared.charCount,
          htmlHash,
          cacheHit: false,
          elapsedMs: Date.now() - started,
          warnings: [...merged.warnings, ...validated.errors],
          detectedSections: prepared.candidateSections,
          extractedFieldCount: countFields(merged.draft),
          failedReason: null,
        },
      };
    }
    logAiFinalDecision({
      failedReason,
      code: "ai_parse_failed",
      detail: validated.errors.join(" / "),
    });
    return {
      draft: null,
      userError: "このページからレシピを読み取れませんでした",
      userMessage: null,
      code: "ai_parse_failed",
      importSource: "failed",
      prepSessionId,
      jsonLd: jsonLdDiag,
      diagnostics: {
        attemptedMethods,
        successfulMethod: null,
        jsonLdSufficient: false,
        aiRan: true,
        aiSkipped: false,
        aiSkipReason: null,
        htmlCharCount: prepared.charCount,
        htmlHash,
        cacheHit: false,
        elapsedMs: Date.now() - started,
        warnings: validated.errors,
        detectedSections: prepared.candidateSections,
        extractedFieldCount: 0,
        failedReason,
      },
    };
  }

  if (validated.documentType === "not_recipe") {
    logAiFinalDecision({
      failedReason: "NO_RECIPE_DETECTED",
      code: "not_recipe",
      detail: "documentType=not_recipe",
    });
    return {
      draft: null,
      userError: "このページからレシピを読み取れませんでした",
      userMessage: null,
      code: "not_recipe",
      importSource: "failed",
      prepSessionId,
      jsonLd: jsonLdDiag,
      diagnostics: {
        attemptedMethods,
        successfulMethod: null,
        jsonLdSufficient: false,
        aiRan: true,
        aiSkipped: false,
        aiSkipReason: null,
        htmlCharCount: prepared.charCount,
        htmlHash,
        cacheHit: false,
        elapsedMs: Date.now() - started,
        warnings: validated.warnings,
        detectedSections: prepared.candidateSections,
        extractedFieldCount: 0,
        failedReason: "NO_RECIPE_DETECTED",
      },
    };
  }

  const merged = mergeRecipeSources({
    sourceUrl,
    jsonLd: quality.draft,
    jsonLdSufficient: false,
    ai: validated.draft,
    rules: null, // AI優先。ルールはフォールバック時のみ
    og,
  });

  if (!isAcceptable(merged.draft)) {
    // AI不足時のみルールで最終フォールバック
    const withRules = mergeRecipeSources({
      sourceUrl,
      jsonLd: quality.draft,
      jsonLdSufficient: false,
      ai: validated.draft,
      rules: rulesExtraction.draft,
      og,
    });
    if (!isAcceptable(withRules.draft)) {
      logAiFinalDecision({
        failedReason: "INSUFFICIENT_RECIPE_CONTENT",
        code: "insufficient_recipe_content",
        detail: `title=${Boolean(withRules.draft?.title)} ingredients=${withRules.draft?.ingredients.length ?? 0} steps=${withRules.draft?.steps.length ?? 0}`,
      });
      return {
        draft: null,
        userError:
          "ページは取得できましたが、材料または作り方を確認できませんでした",
        userMessage: null,
        code: "insufficient_recipe_content",
        importSource: "failed",
        prepSessionId,
        jsonLd: jsonLdDiag,
        diagnostics: {
          attemptedMethods,
          successfulMethod: null,
          jsonLdSufficient: false,
          aiRan: true,
          aiSkipped: false,
          aiSkipReason: null,
          htmlCharCount: prepared.charCount,
          htmlHash,
          cacheHit: false,
          elapsedMs: Date.now() - started,
          warnings: withRules.warnings,
          detectedSections: prepared.candidateSections,
          extractedFieldCount: countFields(withRules.draft),
          failedReason: "INSUFFICIENT_RECIPE_CONTENT",
        },
      };
    }
    setUrlImportCache(sourceUrl, {
      draft: withRules.draft,
      prepared,
      htmlHash,
      importSource: withRules.importSource ?? "hybrid",
    });
    logAiFinalDecision({
      failedReason: null,
      code: "ok",
      detail: "AI不足後にルール統合成功",
    });
    return {
      draft: withRules.draft,
      userError: null,
      userMessage: userFacingMethodMessage(withRules.importSource),
      code: "ok",
      importSource: withRules.importSource,
      prepSessionId,
      jsonLd: jsonLdDiag,
      diagnostics: {
        attemptedMethods,
        successfulMethod: withRules.importSource ?? "hybrid",
        jsonLdSufficient: false,
        aiRan: true,
        aiSkipped: false,
        aiSkipReason: null,
        htmlCharCount: prepared.charCount,
        htmlHash,
        cacheHit: false,
        elapsedMs: Date.now() - started,
        warnings: withRules.warnings,
        detectedSections: prepared.candidateSections,
        extractedFieldCount: countFields(withRules.draft),
      failedReason: null,
      },
    };
  }

  setUrlImportCache(sourceUrl, {
    draft: merged.draft,
    prepared,
    htmlHash,
    importSource: merged.importSource ?? "ai_html",
  });

  logAiFinalDecision({
    failedReason: null,
    code: "ok",
    detail: `importSource=${merged.importSource}`,
  });

  return {
    draft: merged.draft,
    userError: null,
    userMessage: userFacingMethodMessage(merged.importSource),
    code: "ok",
    importSource: merged.importSource,
    prepSessionId,
    jsonLd: jsonLdDiag,
    diagnostics: {
      attemptedMethods,
      successfulMethod: merged.importSource ?? "ai_html",
      jsonLdSufficient: false,
      aiRan: true,
      aiSkipped: false,
      aiSkipReason: null,
      htmlCharCount: prepared.charCount,
      htmlHash,
      cacheHit: false,
      elapsedMs: Date.now() - started,
      warnings: merged.warnings,
      detectedSections: prepared.candidateSections,
      extractedFieldCount: countFields(merged.draft),
      failedReason: null,
    },
  };
}

/** 再解析（保存済み整形本文セッション） */
export async function rerunUrlImportFromSession(
  prepSessionId: string,
  options: UrlImportPipelineOptions = {},
): Promise<UrlImportPipelineResult> {
  const { getPrepSession } = await import("@/lib/recipe-import/url-import-cache");
  const session = getPrepSession(prepSessionId);
  if (!session) {
    return {
      draft: null,
      userError: "再解析用の一時データが見つかりません。URLから再度読み取ってください",
      userMessage: null,
      code: "failed",
      importSource: "failed",
      prepSessionId: null,
      jsonLd: diagnoseJsonLd(""),
      diagnostics: {
        attemptedMethods: [],
        successfulMethod: null,
        jsonLdSufficient: false,
        aiRan: false,
        aiSkipped: true,
        aiSkipReason: "セッションなし",
        htmlCharCount: 0,
        htmlHash: "",
        cacheHit: false,
        elapsedMs: 0,
        warnings: [],
        detectedSections: [],
        extractedFieldCount: 0,
      failedReason: null,
      },
    };
  }

  // HTMLが無いので、空HTMLではなくセッションの prepared を直接使う薄い経路
  const started = Date.now();
  const provider = options.provider ?? getRecipeUrlImportProvider();
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY) || Boolean(options.provider);

  if (!hasApiKey) {
    return {
      draft: null,
      userError:
        "AIによるページ解析を利用するには、サーバー側のOPENAI_API_KEY設定が必要です",
      userMessage: null,
      code: "ai_unavailable",
      importSource: "failed",
      prepSessionId,
      jsonLd: diagnoseJsonLd(""),
      diagnostics: {
        attemptedMethods: [{ method: "ai_html", ok: false, detail: "APIキー未設定" }],
        successfulMethod: null,
        jsonLdSufficient: false,
        aiRan: false,
        aiSkipped: true,
        aiSkipReason: "OPENAI_API_KEY 未設定",
        htmlCharCount: session.prepared.charCount,
        htmlHash: session.htmlHash,
        cacheHit: false,
        elapsedMs: Date.now() - started,
        warnings: [],
        detectedSections: session.prepared.candidateSections,
        extractedFieldCount: 0,
      failedReason: null,
      },
    };
  }

  const aiResponse = await provider.extractRecipeFromPage({
    sourceUrl: session.sourceUrl,
    prepared: session.prepared,
    jsonLdPartial: session.jsonLdPartial,
    foodMasterHints: options.foodMasterHints ?? defaultFoodHints(),
  });

  const validated = validateAiExtraction(aiResponse.raw, session.sourceUrl);
  const merged = mergeRecipeSources({
    sourceUrl: session.sourceUrl,
    jsonLd: session.jsonLdPartial,
    jsonLdSufficient: false,
    ai: validated.draft,
    rules: null,
    og: {
      title: session.prepared.pageTitle,
      description: session.prepared.metaDescription,
      image: null,
      author: null,
    },
  });

  if (!isAcceptable(merged.draft)) {
    return {
      draft: null,
      userError: "AIでもう一度整理しましたが、十分な内容を確認できませんでした",
      userMessage: null,
      code: "insufficient_recipe_content",
      importSource: "failed",
      prepSessionId,
      jsonLd: diagnoseJsonLd(""),
      diagnostics: {
        attemptedMethods: [{ method: "ai_html", ok: false, detail: "再解析不足" }],
        successfulMethod: null,
        jsonLdSufficient: false,
        aiRan: true,
        aiSkipped: false,
        aiSkipReason: null,
        htmlCharCount: session.prepared.charCount,
        htmlHash: session.htmlHash,
        cacheHit: false,
        elapsedMs: Date.now() - started,
        warnings: merged.warnings,
        detectedSections: session.prepared.candidateSections,
        extractedFieldCount: countFields(merged.draft),
      failedReason: null,
      },
    };
  }

  // 再解析はキャッシュを更新（強制）
  setUrlImportCache(session.sourceUrl, {
    draft: merged.draft,
    prepared: session.prepared,
    htmlHash: session.htmlHash,
    importSource: merged.importSource ?? "ai_html",
  });

  return {
    draft: merged.draft,
    userError: null,
    userMessage: "AIでページ本文を整理しました（再解析）",
    code: "ok",
    importSource: merged.importSource,
    prepSessionId,
    jsonLd: diagnoseJsonLd(""),
    diagnostics: {
      attemptedMethods: [{ method: "ai_html", ok: true, detail: "再解析成功" }],
      successfulMethod: "ai_html_reparse",
      jsonLdSufficient: false,
      aiRan: true,
      aiSkipped: false,
      aiSkipReason: null,
      htmlCharCount: session.prepared.charCount,
      htmlHash: session.htmlHash,
      cacheHit: false,
      elapsedMs: Date.now() - started,
      warnings: merged.warnings,
      detectedSections: session.prepared.candidateSections,
      extractedFieldCount: countFields(merged.draft),
    failedReason: null,
    },
  };
}
