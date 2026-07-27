"use client";

import { useRef, useState } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";

/**
 * 端末とクラウドの両方に更新があり、自動解決できないときだけ表示する。
 */
export function SyncConflictDialog() {
  const { syncConflict, resolveSyncConflict, syncing } = useFamilySession();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  if (!syncConflict) {
    return null;
  }

  const busy = syncing || submitting;

  async function resolve(choice: "local" | "cloud"): Promise<void> {
    if (submittingRef.current || busy) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await resolveSyncConflict(choice);
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
    <div
      className="mb-4 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant"
      role="alertdialog"
      aria-labelledby="sync-conflict-title"
    >
      <h2 id="sync-conflict-title" className="text-base font-semibold">
        データの違いを解決してください
      </h2>
      <p className="mt-2 text-sm text-on-surface">
        この端末と家族の共有データの両方に、新しい変更があります。どちらを残すか選んでください。
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void resolve("local");
          }}
          className="w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60"
        >
          この端末の内容を優先
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void resolve("cloud");
          }}
          className="w-full rounded-xl px-3 py-2.5 text-sm font-medium ring-1 ring-outline-variant disabled:opacity-60"
        >
          家族の共有データを優先
        </button>
      </div>
    </div>
  );
}
