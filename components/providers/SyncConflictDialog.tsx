"use client";

import { useRef, useState } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";

/**
 * 同じ項目を複数端末で編集したときだけ表示する確認ダイアログ。
 * （設定が「毎回確認する」のときは双方向更新時にも表示）
 */
export function SyncConflictDialog() {
  const { syncConflict, resolveSyncConflict, syncing } = useFamilySession();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  if (!syncConflict) {
    return null;
  }

  const busy = syncing || submitting;
  const itemLabels = syncConflict.items.slice(0, 5).map((item) => item.label);
  const remaining = Math.max(0, syncConflict.items.length - itemLabels.length);
  const isItemConflict = syncConflict.reason === "item_conflict";

  async function resolve(
    choice: "local" | "cloud" | "merge",
  ): Promise<void> {
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
        {isItemConflict
          ? "同じデータを別の端末でも変更しています"
          : "ほかの端末でも変更があります"}
      </h2>
      <p className="mt-2 text-sm text-on-surface">
        {isItemConflict
          ? "同じレシピやプロフィールなどを、別々に編集したようです。どちらを残すか選んでください。"
          : "変更をまとめて同期できます。必要ならどちらかの内容にそろえることもできます。"}
      </p>
      {itemLabels.length > 0 ? (
        <ul className="mt-2 list-inside list-disc text-sm text-on-surface-variant">
          {itemLabels.map((label) => (
            <li key={label}>{label}</li>
          ))}
          {remaining > 0 ? <li>ほか {remaining} 件</li> : null}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-col gap-2">
        {!isItemConflict ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void resolve("merge");
            }}
            className="w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60"
          >
            変更をまとめて同期する
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void resolve("local");
          }}
          className={`w-full rounded-xl px-3 py-2.5 text-sm font-semibold disabled:opacity-60 ${
            isItemConflict
              ? "bg-primary text-on-primary"
              : "bg-secondary-container text-on-secondary-container"
          }`}
        >
          このスマホの変更を残す
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void resolve("cloud");
          }}
          className="w-full rounded-xl px-3 py-2.5 text-sm font-medium ring-1 ring-outline-variant disabled:opacity-60"
        >
          ほかの端末の変更を使う
        </button>
      </div>
    </div>
  );
}
