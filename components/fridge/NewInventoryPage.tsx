"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { InventoryForm } from "@/components/fridge/InventoryForm";
import { createInventoryItem } from "@/lib/inventory";
import type { InventoryInput } from "@/types/inventory";

export function NewInventoryPage() {
  const router = useRouter();

  function handleSubmit(input: InventoryInput): void {
    createInventoryItem(input);
    router.push("/fridge");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/fridge" className="text-sm font-medium text-primary">
          ← 一覧へ戻る
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">食材を追加</h1>
      </header>
      <InventoryForm submitLabel="保存する" onSubmit={handleSubmit} />
    </div>
  );
}
