"use client";

import { useFamilySession } from "@/components/providers/FamilySessionProvider";

/**
 * 普段は何も出さない。同期中だけ「同期しています…」を表示する。
 * 初回コピーダイアログ表示中はそちらに任せる。
 */
export function SyncStatusBanner() {
  const { syncing, needsMigrationPrompt, syncConflict } = useFamilySession();

  if (!syncing || needsMigrationPrompt || syncConflict) {
    return null;
  }

  return (
    <div
      className="mb-3 rounded-2xl bg-surface-container px-4 py-2.5 text-sm font-medium text-on-surface-variant"
      role="status"
      aria-live="polite"
    >
      同期しています…
    </div>
  );
}
