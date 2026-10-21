import type { Metadata } from "next";
import { AskStockGPTWorkspace } from "@/components/AskStockGPTWorkspace";
import { hasActiveSubscription } from "@/lib/subscription";
import { getServerViewer, getViewerProfile } from "@/lib/server-viewer";
import { askContextFromSearchParams } from "@/lib/ask-context";

export const metadata: Metadata = {
  title: "Ask StockGPT",
  description: "Portfolio-aware AI coach for StockGPT members.",
};

export default async function AskStockGPTPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initialContext = askContextFromSearchParams(await searchParams);
  const [{ user }, profile] = await Promise.all([getServerViewer(), getViewerProfile()]);
  const canUseAskStockGPT = !!user && hasActiveSubscription(profile?.subscription_status);

  return (
    <AskStockGPTWorkspace
      canUseAskStockGPT={canUseAskStockGPT}
      isAuthenticated={!!user}
      initialContext={initialContext}
    />
  );
}
