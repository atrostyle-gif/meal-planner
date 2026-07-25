import Link from "next/link";

export default function FridgePage() {
  return (
    <div className="space-y-4 rounded-2xl bg-surface-container-lowest p-5 ring-1 ring-outline-variant">
      <h1 className="text-xl font-bold">冷蔵庫の管理場所が変わりました</h1>
      <p className="text-sm text-on-surface-variant">
        余っている食材は献立画面、常備品は設定画面から管理できます。
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/meals" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary">
          献立へ
        </Link>
        <Link href="/settings/pantry" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-primary ring-1 ring-outline-variant">
          常備品へ
        </Link>
      </div>
    </div>
  );
}
