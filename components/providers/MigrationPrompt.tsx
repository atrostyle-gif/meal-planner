"use client";

import { useMemo, useRef, useState } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import { getLocalMigrationPreview } from "@/lib/sync/cloud-sync";

/**
 * 初回参加時のみ表示。
 * コピーまたは破棄を選ぶと migrationCompleted=true になり、二度と出ない。
 */
export function MigrationPrompt() {
  const {
    needsMigrationPrompt,
    migrateLocalToCloud,
    discardLocalMigration,
    syncing,
    household,
  } = useFamilySession();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const preview = useMemo(() => {
    if (!needsMigrationPrompt) {
      return null;
    }
    return getLocalMigrationPreview();
  }, [needsMigrationPrompt]);

  if (!needsMigrationPrompt) {
    return null;
  }

  const busy = syncing || submitting;
  const householdName = household?.name?.trim() ?? "";

  async function handleCopy(): Promise<void> {
    if (submittingRef.current || busy) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await migrateLocalToCloud();
      if (!result || result.errors.length > 0) {
        setError(
          result?.errors[0] ??
            "コピーに失敗しました。通信状況を確認して再度お試しください。",
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleDiscard(): Promise<void> {
    if (submittingRef.current || busy) {
      return;
    }
    const ok = window.confirm(
      "この端末だけのデータは家族共有に送りません。共有スペースの内容を使います。よろしいですか？",
    );
    if (!ok) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await discardLocalMigration();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (busy) {
    return (
      <div
        className="mb-4 rounded-2xl bg-surface-container-lowest px-4 py-3 text-sm ring-1 ring-outline-variant"
        role="status"
      >
        <p className="font-medium text-primary">同期しています…</p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
      <h2 className="text-base font-semibold text-on-surface">
        この端末のデータを家族へコピーしますか？
      </h2>

      <p className="mt-2 text-sm text-on-surface">
        この端末だけに保存されているデータがあります。家族で使う共有スペースへ一度だけ送れます。
      </p>

      {householdName !== "" ? (
        <p className="mt-2 text-sm font-medium text-primary">
          「{householdName}」へコピーします
        </p>
      ) : null}

      {preview ? (
        <ul className="mt-3 space-y-0.5 text-sm text-on-surface-variant">
          {preview.recipes > 0 ? <li>・レシピ {preview.recipes}件</li> : null}
          {preview.mealPlanDays > 0 ? (
            <li>・週間献立 {preview.mealPlanDays}日分</li>
          ) : null}
          {preview.shoppingLists > 0 ? (
            <li>・買い物リスト {preview.shoppingLists}件</li>
          ) : null}
          {preview.inventory > 0 ? (
            <li>・冷蔵庫 {preview.inventory}件</li>
          ) : null}
          {preview.pantry > 0 ? <li>・常備品 {preview.pantry}件</li> : null}
        </ul>
      ) : null}

      <p className="mt-3 text-xs text-on-surface-variant">
        コピーまたは破棄を選ぶと、この確認は再表示されません。以降は自動で同期します。
      </p>

      {error ? (
        <p className="mt-2 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void handleDiscard();
          }}
          className="flex-1 rounded-xl px-3 py-2.5 text-sm font-medium ring-1 ring-outline-variant disabled:opacity-60"
        >
          破棄
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void handleCopy();
          }}
          className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60"
        >
          コピー
        </button>
      </div>
    </div>
  );
}
