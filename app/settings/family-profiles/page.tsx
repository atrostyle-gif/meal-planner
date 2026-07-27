import { Suspense } from "react";
import { FamilyProfilesPage } from "@/components/settings/FamilyProfilesPage";

export default function FamilyProfilesRoutePage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-on-surface-variant">読み込み中…</p>}
    >
      <FamilyProfilesPage />
    </Suspense>
  );
}
