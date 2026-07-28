"use client";

import { useFamilySession } from "@/components/providers/FamilySessionProvider";

/**
 * 同期中、または同期完了の短い通知を表示する。
 */
export function SyncStatusBanner() {
  const {
    syncing,
    needsMigrationPrompt,
    syncConflict,
    lastSyncMessage,
  } = useFamilySession();

  if (needsMigrationPrompt || syncConflict) {
    return null;
  }

  if (syncing) {
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

  if (!lastSyncMessage) {
    return null;
  }

  return (
    <div
      className="mb-3 rounded-2xl bg-secondary-container px-4 py-2.5 text-sm font-medium text-on-secondary-container"
      role="status"
      aria-live="polite"
    >
      {lastSyncMessage}
    </div>
  );
}
