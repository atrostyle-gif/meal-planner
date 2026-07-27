import Link from "next/link";
import type { ReactNode } from "react";

type SettingsGroupProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** 設定トップのグループ見出し＋リスト */
export function SettingsGroup({
  title,
  description,
  children,
}: SettingsGroupProps) {
  return (
    <section className="space-y-2">
      <div className="px-0.5">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {/* 説明は通常非表示。必要な画面だけ description を渡す */}
        {description ? (
          <p className="mt-0.5 text-xs text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-2xl bg-surface-container-lowest ring-1 ring-outline-variant">
        <div className="divide-y divide-outline-variant">{children}</div>
      </div>
    </section>
  );
}

type SettingsLinkRowProps = {
  href: string;
  title: string;
  description?: string;
};

/** スマホ向けの大きめタップ領域の設定行 */
export function SettingsLinkRow({
  href,
  title,
  description,
}: SettingsLinkRowProps) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center justify-between gap-3 px-4 py-3.5 transition-colors active:bg-surface-container"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-on-surface">{title}</p>
        {description ? (
          <p className="text-xs leading-relaxed text-on-surface-variant">
            {description}
          </p>
        ) : null}
      </div>
      <span
        className="shrink-0 text-lg leading-none text-on-surface-variant"
        aria-hidden
      >
        ›
      </span>
    </Link>
  );
}
