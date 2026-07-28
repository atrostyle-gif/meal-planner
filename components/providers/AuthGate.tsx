"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";

const PUBLIC_PATHS = ["/login"];

type AuthGateProps = {
  children: ReactNode;
};

function isHouseholdSetupPath(pathname: string): boolean {
  return (
    pathname === "/setup-household" ||
    pathname === "/join" ||
    pathname.startsWith("/join/")
  );
}

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
    const search =
      typeof window !== "undefined" ? window.location.search : "";
    const nextPath = `${pathname}${search}`;

    if (!session && !isPublic) {
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    if (session && pathname === "/login") {
      const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
      const next = params.get("next");
      if (household) {
        router.replace(next && next.startsWith("/") ? next : "/today");
      } else if (next && (next.startsWith("/join") || next.startsWith("/setup-household"))) {
        router.replace(next);
      } else {
        router.replace("/setup-household");
      }
      return;
    }

    if (
      session &&
      !household &&
      !isHouseholdSetupPath(pathname) &&
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
