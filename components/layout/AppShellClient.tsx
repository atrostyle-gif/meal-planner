"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DevConsoleHelpers } from "@/components/dev/DevConsoleHelpers";
import { BottomNav } from "@/components/layout/BottomNav";
import { AuthGate } from "@/components/providers/AuthGate";
import {
  FamilySessionProvider,
  useFamilySession,
} from "@/components/providers/FamilySessionProvider";
import { MigrationPrompt } from "@/components/providers/MigrationPrompt";
import { SyncConflictDialog } from "@/components/providers/SyncConflictDialog";
import { SyncStatusBanner } from "@/components/providers/SyncStatusBanner";

const HIDE_CHROME = ["/login", "/setup-household", "/join"];

export function AppShellClient({ children }: { children: ReactNode }) {
  return (
    <FamilySessionProvider>
      <AuthGate>
        <AppShellFrame>{children}</AppShellFrame>
      </AuthGate>
    </FamilySessionProvider>
  );
}

/**
 * AuthGate 通過後（ready）のみ描画するシェル。
 * pathname による chrome 切替はクライアント確定後のため Hydration 差分を出さない。
 */
function AppShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready } = useFamilySession();
  const hideChrome = HIDE_CHROME.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  // AuthGate と同条件のガード（二重でも安全）
  if (!ready) {
    return null;
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col bg-surface text-on-surface">
      <DevConsoleHelpers />
      <main
        className={`flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] ${
          hideChrome ? "pb-8" : "pb-24"
        }`}
      >
        {!hideChrome ? <MigrationPrompt /> : null}
        {!hideChrome ? <SyncConflictDialog /> : null}
        {children}
      </main>
      {!hideChrome ? <SyncStatusBanner /> : null}
      {!hideChrome ? <BottomNav /> : null}
    </div>
  );
}
