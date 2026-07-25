"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ImportReviewPanel } from "@/components/recipes/import/ImportReviewPanel";
import type { RecipeDraft } from "@/types/recipe-import";

type DiagnosticsPayload = {
  httpStatus?: number | null;
  contentType?: string | null;
  finalUrl?: string;
  htmlBytes?: number;
  htmlHead1000?: string;
  ldJsonScriptCount?: number;
  allTypes?: string[];
  recipeNodeCount?: number;
  importSource?: string | null;
  attemptedMethods?: Array<{ method: string; ok: boolean; detail: string }>;
  successfulMethod?: string | null;
  aiRan?: boolean;
  aiSkipped?: boolean;
  aiSkipReason?: string | null;
  htmlCharCount?: number;
  htmlHash?: string;
  cacheHit?: boolean;
  elapsedMs?: number;
  detectedSections?: string[];
  extractedFieldCount?: number;
  failedReason?: string | null;
  debugHtmlSavedTo?: string | null;
};

type ResponsePayload = {
  draft?: RecipeDraft;
  proposedDraft?: RecipeDraft | null;
  error?: string;
  code?: string;
  message?: string | null;
  prepSessionId?: string | null;
  warnings?: string[];
  diagnostics?: DiagnosticsPayload;
};

const isDev = process.env.NODE_ENV === "development";

const PROGRESS_STEPS = [
  "ページを取得しています",
  "レシピ情報を確認しています",
  "AIで材料と作り方を整理しています",
  "読み取り結果を準備しています",
] as const;

export function UrlImportPanel() {
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [proposedDraft, setProposedDraft] = useState<RecipeDraft | null>(null);
  const [prepSessionId, setPrepSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsPayload | null>(null);
  const [showDiag, setShowDiag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [reparsing, setReparsing] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => {
      setProgressIndex((current) =>
        current < PROGRESS_STEPS.length - 1 ? current + 1 : current,
      );
    }, 1200);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setProgressIndex(0);
    setError(null);
    setInfo(null);
    setDiagnostics(null);
    setDraft(null);
    setProposedDraft(null);
    try {
      const response = await fetch("/api/recipes/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as ResponsePayload;
      if (payload.diagnostics) setDiagnostics(payload.diagnostics);
      if (payload.prepSessionId) setPrepSessionId(payload.prepSessionId);
      if (payload.message) setInfo(payload.message);
      if (!response.ok || !payload.draft) {
        throw new Error(payload.error ?? "取り込みに失敗しました。");
      }
      setDraft(payload.draft);
      setInfo(payload.message ?? "読み取った内容を確認してください");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "取り込みに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  async function handleReparse(): Promise<void> {
    if (!prepSessionId) {
      setError("再解析用のデータがありません。URLから再度読み取ってください。");
      return;
    }
    setReparsing(true);
    setError(null);
    try {
      const response = await fetch("/api/recipes/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reparse: true,
          prepSessionId,
          forceAi: true,
          skipCache: true,
        }),
      });
      const payload = (await response.json()) as ResponsePayload;
      if (payload.diagnostics) setDiagnostics(payload.diagnostics);
      if (!response.ok || !payload.proposedDraft) {
        throw new Error(payload.error ?? "再解析に失敗しました。");
      }
      setProposedDraft(payload.proposedDraft);
      setInfo("AI再解析の結果です。内容を確認してから反映してください。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "再解析に失敗しました。");
    } finally {
      setReparsing(false);
    }
  }

  function applyProposed(): void {
    if (!proposedDraft) return;
    setDraft(proposedDraft);
    setProposedDraft(null);
    setInfo("AI再解析の結果を反映しました。内容を確認してください。");
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant"
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium">レシピページのURL</span>
          <input
            type="url"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/recipe"
            className="w-full rounded-xl bg-surface-container px-3 py-3 ring-1 ring-outline-variant"
          />
        </label>
        <p className="text-xs text-on-surface-variant">
          構造化データまたはAIを使って、公開されているレシピページを読み取ります
        </p>
        {loading ? (
          <ol className="space-y-1 rounded-xl bg-surface-container px-3 py-3 text-sm">
            {PROGRESS_STEPS.map((step, index) => (
              <li
                key={step}
                className={
                  index <= progressIndex
                    ? "font-medium text-on-surface"
                    : "text-on-surface-variant"
                }
              >
                {index + 1}. {step}
                {index === progressIndex ? "…" : ""}
              </li>
            ))}
          </ol>
        ) : null}
        {info ? (
          <p className="rounded-xl bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">
            {info}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        ) : null}
        <button
          disabled={loading}
          className="w-full rounded-2xl bg-primary px-4 py-3 font-semibold text-on-primary disabled:opacity-60"
        >
          {loading ? "読み取り中…" : "URLから読み取る"}
        </button>
      </form>

      {isDev && diagnostics ? (
        <section className="space-y-2 rounded-2xl bg-surface-container p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">開発用診断</h2>
            <button
              type="button"
              className="text-xs text-primary"
              onClick={() => setShowDiag((value) => !value)}
            >
              {showDiag ? "隠す" : "表示"}
            </button>
          </div>
          {showDiag ? (
            <div className="space-y-1 text-xs text-on-surface-variant">
              <p>HTTP: {diagnostics.httpStatus ?? "—"} / {diagnostics.contentType ?? "—"}</p>
              <p>HTMLサイズ: {diagnostics.htmlBytes ?? "—"} / 送信文字数: {diagnostics.htmlCharCount ?? "—"}</p>
              <p>JSON-LD件数: {diagnostics.ldJsonScriptCount ?? "—"} / Recipe: {diagnostics.recipeNodeCount ?? "—"}</p>
              <p>AI実行: {String(diagnostics.aiRan)} / skip: {diagnostics.aiSkipReason ?? "—"}</p>
              <p>採用: {diagnostics.successfulMethod ?? diagnostics.importSource ?? "—"}</p>
              <p>
                FAILED_REASON:{" "}
                <span className="font-semibold text-error">
                  {diagnostics.failedReason ?? "(none)"}
                </span>
              </p>
              <p>cache: {String(diagnostics.cacheHit)} / {diagnostics.elapsedMs ?? "—"}ms</p>
              <p>sections: {(diagnostics.detectedSections ?? []).join(" / ") || "—"}</p>
              {diagnostics.debugHtmlSavedTo ? (
                <p>debug-import.html: {diagnostics.debugHtmlSavedTo}</p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {proposedDraft ? (
        <section className="space-y-3 rounded-2xl bg-secondary-container p-4 text-sm text-on-secondary-container">
          <h2 className="font-semibold">AI再解析の候補</h2>
          <p>現在の結果はまだ上書きされていません。内容を確認して反映してください。</p>
          <p>材料 {proposedDraft.ingredients.length}件 / 手順 {proposedDraft.steps.length}件</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyProposed}
              className="rounded-xl bg-primary px-4 py-2 font-semibold text-on-primary"
            >
              この結果を反映する
            </button>
            <button
              type="button"
              onClick={() => setProposedDraft(null)}
              className="rounded-xl px-4 py-2 ring-1 ring-outline-variant"
            >
              破棄する
            </button>
          </div>
        </section>
      ) : null}

      {draft ? (
        <div className="space-y-3">
          <button
            type="button"
            disabled={reparsing || !prepSessionId}
            onClick={() => void handleReparse()}
            className="w-full rounded-2xl bg-surface-container px-4 py-3 text-sm font-semibold ring-1 ring-outline-variant disabled:opacity-60"
          >
            {reparsing ? "AIで再整理中…" : "AIでもう一度整理する"}
          </button>
          <ImportReviewPanel
            key={`${draft.title ?? ""}-${draft.ingredients.length}-${draft.steps.length}-${draft.importedAt ?? ""}`}
            draft={draft}
          />
        </div>
      ) : null}
    </div>
  );
}
