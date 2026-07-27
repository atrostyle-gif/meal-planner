"use client";

import Link from "next/link";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";

/** 設定への短い導線のみ（説明文は出さない） */
export function ModeBadge() {
  const { household } = useFamilySession();

  return (
    <div className="mb-2 flex items-center justify-end">
      <Link
        href="/settings"
        className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface-variant ring-1 ring-outline-variant"
        aria-label="設定"
      >
        ⚙{household?.name ? ` ${household.name}` : " 設定"}
      </Link>
    </div>
  );
}
