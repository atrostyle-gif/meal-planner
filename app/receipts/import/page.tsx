import Link from "next/link";
import { ReceiptImportPanel } from "@/components/receipt/ReceiptImportPanel";

export default function ReceiptImportPage() {
  return (
    <div className="space-y-4">
      <Link href="/settings/ingredient-prices" className="text-sm text-primary">
        ← 食材価格へ
      </Link>
      <ReceiptImportPanel />
    </div>
  );
}
