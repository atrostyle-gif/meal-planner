"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ImportReviewPanel } from "@/components/recipes/import/ImportReviewPanel";
import type { RecipeDraft } from "@/types/recipe-import";

type ResponsePayload = {
  draft?: RecipeDraft;
  error?: string;
  code?: string;
  message?: string | null;
  warnings?: string[];
  video?: {
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string | null;
    canonicalUrl: string;
  };
};

const PROGRESS_STEPS = [
  "動画情報を取得しています",
  "説明文からレシピを読み取っています",
  "材料と作り方を整理しています",
  "確認用の下書きを準備しています",
] as const;

export function YoutubeImportPanel() {
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [videoMeta, setVideoMeta] = useState<ResponsePayload["video"] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);

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
    setWarnings([]);
    setDraft(null);
    setVideoMeta(null);
    try {
      const response = await fetch("/api/recipes/import-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as ResponsePayload;
      if (payload.warnings) setWarnings(payload.warnings);
      if (payload.video) setVideoMeta(payload.video);
      if (payload.message) setInfo(payload.message);
      if (!response.ok || !payload.draft) {
        throw new Error(payload.error ?? "YouTubeからの取り込みに失敗しました。");
      }
      setDraft(payload.draft);
      setInfo(payload.message ?? "読み取った内容を確認してください");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "YouTubeからの取り込みに失敗しました。",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <div>
          <h2 className="text-base font-semibold">YouTubeから取り込む</h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            動画ファイルはダウンロードしません。タイトル・説明文・チャンネル情報からレシピ候補を作ります。
          </p>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-on-surface-variant">
            YouTube URL
          </span>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="w-full rounded-xl bg-surface px-3 py-2.5 text-sm ring-1 ring-outline-variant"
            placeholder="https://www.youtube.com/watch?v=... または https://youtu.be/..."
            inputMode="url"
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          disabled={loading || url.trim() === ""}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50"
        >
          {loading ? "読み取り中…" : "動画情報から読み取る"}
        </button>
        {loading ? (
          <p className="text-sm text-on-surface-variant">
            {PROGRESS_STEPS[progressIndex]}
          </p>
        ) : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}
        {info && !error ? <p className="text-sm text-primary">{info}</p> : null}
        {warnings.length > 0 ? (
          <ul className="space-y-1 rounded-xl bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
            {warnings.map((warning) => (
              <li key={warning}>・{warning}</li>
            ))}
          </ul>
        ) : null}
        {videoMeta ? (
          <div className="flex gap-3 rounded-xl bg-surface-container px-3 py-2">
            {videoMeta.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={videoMeta.thumbnailUrl}
                alt=""
                className="h-16 w-28 rounded-lg object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{videoMeta.title}</p>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                {videoMeta.channelTitle || "チャンネル不明"}
              </p>
            </div>
          </div>
        ) : null}
      </form>

      {draft ? (
        <ImportReviewPanel
          key={`${draft.title ?? ""}-${draft.ingredients.length}-${draft.steps.length}-${draft.importedAt ?? ""}`}
          draft={draft}
        />
      ) : null}
    </div>
  );
}
