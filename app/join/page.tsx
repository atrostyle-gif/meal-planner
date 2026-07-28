import { Suspense } from "react";
import { JoinHouseholdPage } from "@/components/auth/JoinHouseholdPage";

export default function JoinRoutePage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-on-surface-variant">読み込み中…</p>}
    >
      <JoinHouseholdPage />
    </Suspense>
  );
}
