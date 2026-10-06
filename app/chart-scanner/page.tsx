import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ChartScannerClient } from "@/components/ChartScannerClient";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Chart Scanner | StockGPT",
  description: "App-only AI technical chart scanner for StockGPT.",
  robots: { index: false, follow: false },
};

export default async function ChartScannerPage() {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") ?? "";

  if (!userAgent.includes("StockGPTApp")) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/chart-scanner");
  }

  return (
    <AppShell activePath="/chart-scanner">
      <ChartScannerClient />
    </AppShell>
  );
}
