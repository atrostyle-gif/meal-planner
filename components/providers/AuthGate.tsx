"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";

const PUBLIC_PATHS = ["/login"];

type AuthGateProps = {
  children: ReactNode;
};

/**
 * Supabase モード時のみ認証・家庭所属をチェックする。
 * local モードでは何もしない。
 * session 取得完了まで同じ HTML（null）を返し、Hydration mismatch を防ぐ。
 */
export function AuthGate({ children }: AuthGateProps) {
  const { mode, ready, session, household } = useFamilySession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ready || mode !== "supabase") {
      return;
    }

    const isPublic = PUBLIC_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

    if (!session && !isPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (session && pathname === "/login") {
      router.replace(household ? "/today" : "/setup-household");
      return;
    }

    if (
      session &&
      !household &&
      pathname !== "/setup-household" &&
      !pathname.startsWith("/settings")
    ) {
      router.replace("/setup-household");
    }
  }, [mode, ready, session, household, pathname, router]);

  // サーバー描画・クライアント初回描画を一致させる（browser API は使わない）
  if (!ready) {
    return null;
  }

  return <>{children}</>;
}
