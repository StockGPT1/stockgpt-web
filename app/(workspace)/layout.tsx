import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const nativeApp = /StockGPTApp/i.test((await headers()).get("user-agent") ?? "");
  // One stable iPhone frame across all workspace routes. Leaf pages retain
  // their own authorization and deliver content/context to this shared shell.
  if (!nativeApp) return children;
  return <AppShell activePath="/dashboard" persistent>{children}</AppShell>;
}
