"use client";

import { useEffect, useState, type ReactNode } from "react";

type FirstVisitTipProps = {
  storageKey: string;
  title?: string;
  children: ReactNode;
  /** 強制表示（？ボタンなど） */
  forceOpen?: boolean;
  onForceClose?: () => void;
};

/**
 * 初回だけ説明を出す。以降は storageKey で抑止し、？から再表示。
 */
export function FirstVisitTip({
  storageKey,
  title = "ヒント",
  children,
  forceOpen = false,
  onForceClose,
}: FirstVisitTipProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      if (forceOpen) {
        setOpen(true);
        return;
      }
      if (window.localStorage.getItem(storageKey) !== "true") {
        setOpen(true);
      }
    });
  }, [storageKey, forceOpen]);

  function dismiss(): void {
    setOpen(false);
    window.localStorage.setItem(storageKey, "true");
    onForceClose?.();
  }

  if (!open) return null;

  return (
    <div className="rounded-2xl bg-surface-container px-3 py-3 text-sm">
      <p className="font-medium">{title}</p>
      <div className="mt-1 text-on-surface-variant">{children}</div>
      <button
        type="button"
        onClick={dismiss}
        className="mt-2 text-sm font-medium text-primary"
      >
        閉じる
      </button>
    </div>
  );
}

export function HelpButton({
  onClick,
  label = "ヘルプ",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-2.5 py-1 text-sm font-medium text-on-surface-variant ring-1 ring-outline-variant"
      aria-label={label}
    >
      ？
    </button>
  );
}
