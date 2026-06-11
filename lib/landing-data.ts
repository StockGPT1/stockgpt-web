import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/utils/supabase/public";

export type LandingMarketSummary = {
  totalStocks: number;
  bullishCount: number;
  latestUpdate: string | null;
};

const getLandingMarketSummaryFromSupabase = unstable_cache(
  async (): Promise<LandingMarketSummary> => {
    const supabase = createPublicClient();

    const [totalResult, bullishResult, latestResult] = await Promise.all([
      supabase.from("stock_rankings").select("*", { count: "exact", head: true }),
      supabase
        .from("stock_rankings")
        .select("*", { count: "exact", head: true })
        .gte("score", 7000),
      supabase
        .from("stock_rankings")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1),
    ]);

    if (totalResult.error) {
      console.warn("[landing-data] total stock count failed", totalResult.error.message);
    }

    if (bullishResult.error) {
      console.warn("[landing-data] bullish stock count failed", bullishResult.error.message);
    }

    if (latestResult.error) {
      console.warn("[landing-data] latest update lookup failed", latestResult.error.message);
    }

    return {
      totalStocks: totalResult.count ?? 0,
      bullishCount: bullishResult.count ?? 0,
      latestUpdate: latestResult.data?.[0]?.updated_at ?? null,
    };
  },
  ["landing-market-summary-v1"],
  { revalidate: 60 },
);

export async function getLandingMarketSummary() {
  return getLandingMarketSummaryFromSupabase();
}
