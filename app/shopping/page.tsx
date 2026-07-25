import { Suspense } from "react";
import { ShoppingListPage } from "@/components/shopping/ShoppingListPage";

export default function ShoppingRoutePage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-on-surface-variant">読み込み中…</p>}
    >
      <ShoppingListPage />
    </Suspense>
  );
}
