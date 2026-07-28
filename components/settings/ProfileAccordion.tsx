"use client";

import type { ReactNode } from "react";

type ProfileAccordionProps = {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** スマホ向けの折りたたみセクション */
export function ProfileAccordion({
  title,
  summary,
  open,
  onToggle,
  children,
}: ProfileAccordionProps) {
  return (
    <section className="overflow-hidden rounded-2xl bg-surface-container-lowest ring-1 ring-outline-variant">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-on-surface">{title}</p>
          {summary && !open ? (
            <p className="mt-0.5 truncate text-xs text-on-surface-variant">
              {summary}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-primary">{open ? "▲" : "▼"}</span>
      </button>
      {open ? <div className="space-y-3 border-t border-outline-variant px-4 py-3">{children}</div> : null}
    </section>
  );
}
