"use client";

import { useEffect, useState } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";

/** この時間を超えた同期だけ「同期中…」を出す */
const SLOW_SYNC_MS = 1200;
/** 成功トーストの表示時間（フェードアウト含む） */
const SUCCESS_VISIBLE_MS = 1800;

/**
 * 同期状態の固定トースト。
 * ドキュメントフロー外のため、表示の有無でページが上下しない。
 */
export function SyncStatusBanner() {
  const {
    syncing,
    needsMigrationPrompt,
    syncConflict,
    lastSyncMessage,
    lastSyncError,
    clearSyncMessage,
    clearSyncError,
    pullLatest,
  } = useFamilySession();

  const [showSlowSync, setShowSlowSync] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!syncing) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        setShowSlowSync(true);
      }
    }, SLOW_SYNC_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.setTimeout(() => {
        setShowSlowSync(false);
      }, 0);
    };
  }, [syncing]);

  useEffect(() => {
    if (!lastSyncMessage) {
      return;
    }
    const timer = window.setTimeout(() => {
      clearSyncMessage();
    }, SUCCESS_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [lastSyncMessage, clearSyncMessage]);

  // 移行ダイアログ・競合ダイアログ表示中はトーストを出さない
  if (needsMigrationPrompt || syncConflict) {
    return null;
  }

  const showError = Boolean(lastSyncError);
  const showSuccess = Boolean(lastSyncMessage) && !showError && !syncing;
  const showSyncingHint = showSlowSync && syncing && !showError;

  if (!showError && !showSuccess && !showSyncingHint) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-end px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="pointer-events-auto w-full max-w-sm sm:w-auto sm:min-w-[14rem]">
        {showError ? (
          <div
            role="alert"
            className="rounded-2xl bg-error-container px-3.5 py-3 text-sm text-error shadow-lg ring-1 ring-error/20"
          >
            <p className="font-semibold">同期できませんでした</p>
            <p className="mt-1 text-xs leading-relaxed opacity-90">
              {lastSyncError}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={retrying || syncing}
                onClick={() => {
                  setRetrying(true);
                  void pullLatest({ force: true, notify: true })
                    .catch(() => undefined)
                    .finally(() => setRetrying(false));
                }}
                className="rounded-xl bg-error px-3 py-1.5 text-xs font-semibold text-on-primary disabled:opacity-50"
              >
                {retrying || syncing ? "再試行中…" : "再試行"}
              </button>
              <button
                type="button"
                onClick={() => clearSyncError()}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-error ring-1 ring-error/30"
              >
                閉じる
              </button>
            </div>
          </div>
        ) : null}

        {!showError && showSyncingHint ? (
          <div
            role="status"
            className="ml-auto w-fit rounded-full bg-surface-container-lowest/95 px-3 py-1.5 text-xs font-medium text-on-surface-variant shadow-md backdrop-blur-sm ring-1 ring-outline-variant"
          >
            同期中…
          </div>
        ) : null}

        {!showError && showSuccess ? (
          <div
            role="status"
            className="animate-sync-toast-fade ml-auto w-fit rounded-full bg-secondary-container/95 px-3 py-1.5 text-xs font-semibold text-on-secondary-container shadow-md backdrop-blur-sm"
          >
            {lastSyncMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
