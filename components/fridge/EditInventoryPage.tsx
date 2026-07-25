"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { InventoryForm } from "@/components/fridge/InventoryForm";
import { deleteInventoryItem, updateInventoryItem } from "@/lib/inventory";
import { useIsClient } from "@/lib/use-is-client";
import { useInventoryItem } from "@/lib/use-inventory";
import type { InventoryInput } from "@/types/inventory";

type EditInventoryPageProps = {
  itemId: string;
};

export function EditInventoryPage({ itemId }: EditInventoryPageProps) {
  const router = useRouter();
  const isClient = useIsClient();
  const item = useInventoryItem(itemId);

  function handleSubmit(input: InventoryInput): void {
    updateInventoryItem(itemId, input);
    router.push("/fridge");
    router.refresh();
  }

  function handleDelete(): void {
    deleteInventoryItem(itemId);
    router.push("/fridge");
    router.refresh();
  }

  if (!isClient) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  if (item === null) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">食材が見つかりません</h1>
        <Link href="/fridge" className="text-sm font-medium text-primary">
          一覧へ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/fridge" className="text-sm font-medium text-primary">
          ← 一覧へ戻る
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">食材を編集</h1>
      </header>
      <InventoryForm
        initialItem={item}
        submitLabel="変更を保存"
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </div>
  );
}
