"use client";

import Link from "next/link";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import { getDataModeLabel } from "@/lib/supabase/env";

export function ModeBadge() {
  const { mode, household, syncing } = useFamilySession();
  const label = getDataModeLabel(mode);

  return (
    <div className="mb-3 flex items-center justify-between gap-2 text-xs text-on-surface-variant">
      <Link
        href="/settings"
        className="rounded-full bg-surface-container px-2.5 py-1 ring-1 ring-outline-variant"
      >
        {label}
        {mode === "supabase" && household ? `・${household.name}` : null}
        {syncing ? "・同期中" : null}
      </Link>
      <Link href="/settings" className="text-primary">
        設定
      </Link>
    </div>
  );
}
