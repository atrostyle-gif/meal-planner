import type { ReactNode } from "react";
import { AppShellClient } from "@/components/layout/AppShellClient";

type AppShellProps = {
  children: ReactNode;
};

/** スマートフォン向け共通レイアウト */
export function AppShell({ children }: AppShellProps) {
  return <AppShellClient>{children}</AppShellClient>;
}
