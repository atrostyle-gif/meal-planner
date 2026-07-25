import { Suspense } from "react";
import { LoginPage } from "@/components/auth/LoginPage";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-on-surface-variant">読み込み中…</p>}>
      <LoginPage />
    </Suspense>
  );
}
