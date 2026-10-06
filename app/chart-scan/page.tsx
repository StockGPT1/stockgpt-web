import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ChartScannerWorkspace } from "@/components/ChartScannerWorkspace";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Chart Scanner | StockGPT",
  description: "App-only AI chart pattern scanner for StockGPT.",
  robots: { index: false, follow: false },
};

export default async function ChartScanPage() {
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") ?? "";

  if (!/StockGPTApp/i.test(userAgent)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/chart-scan");
  }

  return (
    <AppShell activePath="/chart-scan">
      <ChartScannerWorkspace />
    </AppShell>
  );
}
