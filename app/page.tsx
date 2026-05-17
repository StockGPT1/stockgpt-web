import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { getTickerTape } from "@/lib/yahoo";
import { LandingClient, type LandingTicker } from "./landing/LandingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "StockGPT — AI Stock Rankings & Portfolio Intelligence",
  description:
    "Unlock AI-powered stock rankings, portfolio tools, market news and investment research for investors who want clarity, not noise.",
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

export default async function LandingPage() {
  const supabase = await createClient();

  const [{ count: totalCount }, { count: bullishCount }, { data: latestRows }] =
    await Promise.all([
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

  const publicTickerUniverse = [
    "^GSPC",
    "^IXIC",
    "^DJI",
    "^VIX",
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "GOOGL",
    "META",
    "TSLA",
    "JPM",
    "V",
    "MA",
  ];

  const tickerTapeData = await getTickerTape(publicTickerUniverse);

  const liveTickerTape: LandingTicker[] = tickerTapeData.map((item) => ({
    symbol: item.symbol,
    yahooSymbol: item.yahooSymbol,
    price: item.price,
    change: item.change,
    changePct: item.changePct,
  }));

  const totalStocks = totalCount ?? 0;
  const bullishPct =
    totalStocks > 0 ? Math.round(((bullishCount ?? 0) / totalStocks) * 100) : 0;

  const latestUpdate = latestRows?.[0]?.updated_at ?? null;

  return (
    <LandingClient
      tickerTape={liveTickerTape}
      metrics={{
        totalStocks,
        bullishPct,
        sentiment: getSentiment(bullishPct),
        lastUpdatedLabel: formatUpdatedAt(latestUpdate),
      }}
    />
  );
}
