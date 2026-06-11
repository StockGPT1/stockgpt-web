import type { Metadata } from "next";
import { getTickerTape } from "@/lib/yahoo";
import { getLandingMarketSummary } from "@/lib/landing-data";
import { LandingClient, type LandingTicker } from "./LandingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "StockGPT — Stock Rankings, Portfolio Context & Market Research",
  description:
    "Try StockGPT free. Rank US stocks, understand portfolio exposure, track market news and start your research with structure instead of noise.",
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

  const [marketSummary, tickerTapeData] = await Promise.all([
    getLandingMarketSummary(),
    getTickerTape(publicTickerUniverse),
  ]);

  const liveTickerTape: LandingTicker[] = tickerTapeData.map((item) => ({
    symbol: item.symbol,
    yahooSymbol: item.yahooSymbol,
    price: item.price,
    change: item.change,
    changePct: item.changePct,
  }));

  const totalStocks = marketSummary.totalStocks;
  const bullishPct =
    totalStocks > 0 ? Math.round((marketSummary.bullishCount / totalStocks) * 100) : 0;

  return (
    <LandingClient
      tickerTape={liveTickerTape}
      metrics={{
        totalStocks,
        bullishPct,
        sentiment: getSentiment(bullishPct),
        lastUpdatedLabel: formatUpdatedAt(marketSummary.latestUpdate),
      }}
    />
  );
}
