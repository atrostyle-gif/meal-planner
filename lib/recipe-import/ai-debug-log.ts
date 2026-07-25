/**
 * URL取り込み AI 解析の開発環境限定ログ
 * 本番では一切出力しない
 */

export type AiFailedReason =
  | "AI_EMPTY_RESPONSE"
  | "SCHEMA_VALIDATION_ERROR"
  | "NO_RECIPE_DETECTED"
  | "OPENAI_API_ERROR"
  | "AI_TIMEOUT"
  | "AI_UNAVAILABLE"
  | "INSUFFICIENT_RECIPE_CONTENT"
  | "JSON_PARSE_ERROR"
  | "UNKNOWN";

export type AiCallPreLog = {
  model: string;
  payloadCharCount: number;
  preparedCharCount: number;
  preparedHead1000: string;
    jsonLdQuality: {
      hasRecipeNode: boolean;
      sufficient: boolean;
      reasons: string[];
      missing: string[];
      ingredientCount: number;
      stepCount: number;
    };
    aiRunReason: string;
    sourceUrl: string;
    preprocess?: {
      selectedRoot: string;
      selectedRootSelector: string;
      charsBeforeExtract: number;
      charsAfterExtract: number;
      removedTagCount: number;
    } | null;
};

export type AiResponseLog = {
  httpStatus: number | null;
  requestId: string | null;
  finishReason: string | null;
  tokenUsage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  } | null;
  rawResponseJson: unknown;
  contentBeforeSchema: unknown;
  outputTextPreview: string | null;
  providerError: string | null;
};

export type AiSchemaLog = {
  ok: boolean;
  zodErrorFull: string | null;
  failedFields: string[];
  enumMismatches: string[];
  missingRequired: string[];
  jsonParseError: string | null;
  documentType: string | null;
};

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function line(char = "─", width = 56): string {
  return char.repeat(width);
}

function section(title: string): string {
  return `\n${line("═")}\n ${title}\n${line("═")}`;
}

function dump(value: unknown, max = 8000): string {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    if (text.length <= max) return text;
    return `${text.slice(0, max)}\n…(truncated ${text.length - max} chars)`;
  } catch {
    return String(value);
  }
}

/** AI呼び出し前 */
export function logAiCallBefore(info: AiCallPreLog): void {
  if (!isDev()) return;
  const parts = [
    section("AI呼び出し前"),
    `使用モデル: ${info.model}`,
    `AIへ送る本文文字数: ${info.payloadCharCount}`,
    `HTML前処理後の文字数: ${info.preparedCharCount}`,
    `AI実行理由: ${info.aiRunReason}`,
    `sourceUrl: ${info.sourceUrl}`,
    info.preprocess
      ? [
          "",
          "HTML前処理DOM選択:",
          `  selectedRoot: ${info.preprocess.selectedRoot}`,
          `  selector: ${info.preprocess.selectedRootSelector}`,
          `  本文抽出前文字数: ${info.preprocess.charsBeforeExtract}`,
          `  本文抽出後文字数: ${info.preprocess.charsAfterExtract}`,
          `  removeしたタグ数: ${info.preprocess.removedTagCount}`,
        ].join("\n")
      : null,
    "",
    "JSON-LD品質判定:",
    `  hasRecipeNode: ${info.jsonLdQuality.hasRecipeNode}`,
    `  sufficient: ${info.jsonLdQuality.sufficient}`,
    `  ingredients: ${info.jsonLdQuality.ingredientCount}`,
    `  steps: ${info.jsonLdQuality.stepCount}`,
    `  reasons: ${info.jsonLdQuality.reasons.join(" / ") || "—"}`,
    `  missing: ${info.jsonLdQuality.missing.join(", ") || "—"}`,
    "",
    "HTML前処理後の先頭1000文字:",
    info.preparedHead1000 || "(empty)",
    line(),
  ];
  console.info(parts.join("\n"));
}

/** AIレスポンス */
export function logAiResponse(info: AiResponseLog): void {
  if (!isDev()) return;
  const usage = info.tokenUsage
    ? `input=${info.tokenUsage.inputTokens ?? "—"} output=${info.tokenUsage.outputTokens ?? "—"} total=${info.tokenUsage.totalTokens ?? "—"}`
    : "—";
  const parts = [
    section("AIレスポンス"),
    `HTTPステータス: ${info.httpStatus ?? "—"}`,
    `OpenAI request id: ${info.requestId ?? "—"}`,
    `finish_reason / status: ${info.finishReason ?? "—"}`,
    `token使用量: ${usage}`,
    `providerError: ${info.providerError ?? "—"}`,
    "",
    "strict JSON Schema検証前の内容:",
    dump(info.contentBeforeSchema),
    "",
    "Responses APIの生レスポンス(JSON):",
    dump(info.rawResponseJson),
    line(),
  ];
  console.info(parts.join("\n"));
}

/** Schema検証 */
export function logAiSchemaValidation(info: AiSchemaLog): void {
  if (!isDev()) return;
  const parts = [
    section("Schema検証"),
    `ok: ${info.ok}`,
    `documentType: ${info.documentType ?? "—"}`,
    `JSON解析失敗理由: ${info.jsonParseError ?? "—"}`,
    "",
    "Zodエラー全文:",
    info.zodErrorFull ?? "(none)",
    "",
    `失敗したフィールド: ${info.failedFields.join(", ") || "—"}`,
    `enum不一致: ${info.enumMismatches.join(", ") || "—"}`,
    `必須項目不足: ${info.missingRequired.join(", ") || "—"}`,
    line(),
  ];
  console.info(parts.join("\n"));
}

/** 最終判定 */
export function logAiFinalDecision(input: {
  failedReason: AiFailedReason | null;
  code: string;
  detail?: string;
}): void {
  if (!isDev()) return;
  const parts = [
    section("最終判定"),
    `pipeline code: ${input.code}`,
    input.detail ? `detail: ${input.detail}` : null,
    "",
    input.failedReason
      ? `FAILED_REASON:\n${input.failedReason}`
      : "FAILED_REASON:\n(none — success or non-AI path)",
    line("═"),
  ].filter(Boolean);
  console.info(parts.join("\n"));
}

export function summarizeZodIssues(issues: Array<{
  code: string;
  path: PropertyKey[];
  message: string;
  expected?: unknown;
  received?: unknown;
}>): Omit<AiSchemaLog, "ok" | "documentType" | "jsonParseError"> {
  const failedFields = [
    ...new Set(
      issues.map((issue) =>
        issue.path.length > 0 ? issue.path.map(String).join(".") : "(root)",
      ),
    ),
  ];
  const enumMismatches = issues
    .filter((issue) => issue.code === "invalid_enum_value" || issue.code === "invalid_value")
    .map((issue) => {
      const path = issue.path.map(String).join(".") || "(root)";
      return `${path}: ${issue.message}`;
    });
  const missingRequired = issues
    .filter(
      (issue) =>
        issue.code === "invalid_type" &&
        (String(issue.received) === "undefined" || issue.message.includes("required")),
    )
    .map((issue) => issue.path.map(String).join(".") || "(root)");

  return {
    zodErrorFull: issues
      .map(
        (issue) =>
          `[${issue.code}] ${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`,
      )
      .join("\n"),
    failedFields,
    enumMismatches,
    missingRequired,
  };
}
