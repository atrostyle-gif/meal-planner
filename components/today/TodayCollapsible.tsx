"use client";

import { useState, type ReactNode } from "react";

type TodayCollapsibleProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

/** ホーム用の簡潔な折りたたみ */
export function TodayCollapsible({
  title,
  children,
  defaultOpen = false,
}: TodayCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl bg-surface-container-lowest ring-1 ring-outline-variant">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-on-surface-variant" aria-hidden>
          {open ? "▾" : "›"}
        </span>
      </button>
      {open ? (
        <div className="space-y-1.5 border-t border-outline-variant/40 px-3 py-2.5 text-sm">
          {children}
        </div>
      ) : null}
    </section>
  );
}
