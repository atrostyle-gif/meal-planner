import Link from "next/link";
import { PantryStockSection } from "@/components/fridge/PantryStockSection";

export default function PantrySettingsPage() {
  return (
    <div className="space-y-4">
      <Link href="/settings" className="text-sm text-primary">
        ← 設定へ
      </Link>
      <PantryStockSection />
    </div>
  );
}
