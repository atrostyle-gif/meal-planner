"use client";

import Link from "next/link";

type DataHubItem = {
  href: string;
  title: string;
  description: string;
  available: boolean;
};

const DATA_ITEMS: DataHubItem[] = [
  {
    href: "/data/nutrition",
    title: "栄養ダッシュボード",
    description: "今日・今週の栄養バランスを確認",
    available: true,
  },
  {
    href: "/data/ai",
    title: "AI分析",
    description: "この家庭の学習傾向レポート",
    available: true,
  },
  {
    href: "/data/reviews",
    title: "レビュー分析",
    description: "評価・タグ・また作りたいの傾向",
    available: true,
  },
  {
    href: "/data/food-expenses",
    title: "食費分析",
    description: "今後利用予定",
    available: false,
  },
  {
    href: "/data/fridge",
    title: "冷蔵庫分析",
    description: "今後利用予定",
    available: false,
  },
];

/**
 * 分析・確認のためのデータハブ（設定とは分離）。
 */
export function DataHubPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">データ</h1>
        <p className="text-sm text-on-surface-variant">
          結果を確認する場所です
        </p>
      </header>

      <div className="grid gap-3">
        {DATA_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant transition-colors active:bg-surface-container ${
              item.available ? "" : "opacity-80"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-base font-semibold tracking-tight">
                  {item.title}
                </p>
                <p className="text-sm text-on-surface-variant">
                  {item.description}
                </p>
              </div>
              {item.available ? (
                <span
                  className="shrink-0 text-lg text-on-surface-variant"
                  aria-hidden
                >
                  ›
                </span>
              ) : (
                <span className="shrink-0 rounded-lg bg-surface-container px-2 py-1 text-[11px] font-medium text-on-surface-variant">
                  準備中
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
