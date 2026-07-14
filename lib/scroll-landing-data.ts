import { createAdminClient } from "@/utils/supabase/admin";
import type { LandingMetrics } from "@/app/landing/ScrollLandingScreens";

export type ScrollLandingData = {
  metrics: LandingMetrics;
};

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return "Awaiting live update";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function getSentiment(bullishPct: number) {
  if (bullishPct >= 50) return "Strong market";
  if (bullishPct >= 35) return "Healthy market";
  if (bullishPct >= 20) return "Cautious market";
  return "Weak market";
}

/**
 * Aggregate metrics for the marketing landing page (stock counts,
 * bullish percentage, last model run). The rankings shown in the
 * landing visuals are deliberately demo data, never live output.
 *
 * stock_rankings is RLS-locked to active subscribers, so these reads
 * run server-side with the service-role client (read-only, aggregate
 * counts only). Every failure path degrades to zeroed metrics — the
 * landing visuals substitute demo values so the page never looks broken.
 */
export async function getScrollLandingData(): Promise<ScrollLandingData> {
  let totalStocks = 0;
  let bullishPct = 0;
  let latestUpdate: string | null = null;

  try {
    const admin = createAdminClient();

    const [{ count: totalCount }, { count: bullishCount }, { data: latestRows }] =
      await Promise.all([
        admin.from("stock_rankings").select("*", { count: "exact", head: true }),
        admin
          .from("stock_rankings")
          .select("*", { count: "exact", head: true })
          .gte("score", 7000),
        admin
          .from("stock_rankings")
          .select("updated_at")
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);

    totalStocks = totalCount ?? 0;
    bullishPct =
      totalStocks > 0 ? Math.round(((bullishCount ?? 0) / totalStocks) * 100) : 0;
    latestUpdate = latestRows?.[0]?.updated_at ?? null;
  } catch (error) {
    console.error("[scroll-landing-data] falling back to static content", error);
  }

  return {
    metrics: {
      totalStocks,
      bullishPct,
      sentiment: getSentiment(bullishPct),
      lastUpdatedLabel: formatUpdatedAt(latestUpdate),
    },
  };
}
