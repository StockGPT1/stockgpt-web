import type { Metadata } from "next";
import { AskStockGPTWorkspace } from "@/components/AskStockGPTWorkspace";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/utils/supabase/server";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canUseAskStockGPT = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    canUseAskStockGPT = hasActiveSubscription(profile?.subscription_status);
  }

  return (
    <AskStockGPTWorkspace
      canUseAskStockGPT={canUseAskStockGPT}
      isAuthenticated={!!user}
      initialContext={initialContext}
    />
  );
}
