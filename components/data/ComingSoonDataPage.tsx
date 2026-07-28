"use client";

import Link from "next/link";

/** 今後利用予定のプレースホルダ */
export function ComingSoonDataPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p>
          <Link href="/data" className="text-sm text-primary">
            ← データ
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-on-surface-variant">{description}</p>
      </header>
      <section className="rounded-2xl bg-surface-container-lowest px-4 py-8 text-center ring-1 ring-outline-variant">
        <p className="text-sm font-medium text-on-surface">準備中です</p>
        <p className="mt-2 text-xs text-on-surface-variant">
          今後、ここに分析レポートを表示します
        </p>
      </section>
    </div>
  );
}
