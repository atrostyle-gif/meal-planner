"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  {
    href: "/today",
    label: "今日",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.5V7h-2v7h6v-2h-4z" />
      </svg>
    ),
  },
  {
    href: "/meals",
    label: "献立",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
        <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z" />
      </svg>
    ),
  },
  {
    href: "/recipes",
    label: "レシピ",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
        <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5L14 3.5zM8 11h8v1.5H8V11zm0 3h8v1.5H8V14zm0 3h5v1.5H8V17z" />
      </svg>
    ),
  },
  {
    href: "/shopping",
    label: "買い物",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
        <path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6.2 6l.4 2h12.7l-1.4 7H8.1L6.2 6zM5.5 4H3v1.5h1.8l2.5 12.2A2 2 0 0 0 9.2 19h9.3v-1.5H9.2l-.3-1.5h9.6L20.8 6H5.5V4z" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-outline bg-surface-container-lowest pb-[env(safe-area-inset-bottom)]"
      aria-label="メインナビ"
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch justify-around">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-on-surface-variant"
                }`}
              >
                <span
                  className={`rounded-2xl px-3 py-1 ${
                    active ? "bg-secondary-container text-on-secondary-container" : ""
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
