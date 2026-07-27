"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type CompactMenuItem = {
  id: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type CompactMenuProps = {
  label: string;
  items: CompactMenuItem[];
  /** トリガー見た目。省略時は「…」 */
  trigger?: ReactNode;
  align?: "left" | "right";
};

/** スマホ向けの簡易メニュー（… / その他） */
export function CompactMenu({
  label,
  items,
  trigger,
  align = "right",
}: CompactMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const enabledItems = items.filter((item) => !item.disabled);

  if (enabledItems.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg px-2 py-1 text-sm font-medium text-on-surface-variant hover:bg-surface-container"
      >
        {trigger ?? "…"}
      </button>
      {open ? (
        <ul
          id={menuId}
          role="menu"
          className={`absolute z-20 mt-1 min-w-40 overflow-hidden rounded-xl bg-surface-container-lowest py-1 shadow-md ring-1 ring-outline-variant ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {enabledItems.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`block w-full px-3 py-2.5 text-left text-sm ${
                  item.danger
                    ? "text-error hover:bg-error-container"
                    : "text-on-surface hover:bg-surface-container"
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
