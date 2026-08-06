import Link from "next/link";
import { RecurringPurchaseIngredientsSection } from "@/components/settings/RecurringPurchaseIngredientsSection";

export default function RecurringPurchaseSettingsPage() {
  return (
    <div className="space-y-4">
      <Link href="/settings" className="text-sm text-primary">
        ← 設定へ
      </Link>
      <RecurringPurchaseIngredientsSection />
    </div>
  );
}
