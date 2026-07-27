import { Suspense } from "react";
import { ReceiptDonePage } from "@/components/receipt/ReceiptDonePage";

export default function ReceiptDoneRoute() {
  return (
    <Suspense fallback={<p className="text-sm">読み込み中…</p>}>
      <ReceiptDonePage />
    </Suspense>
  );
}
