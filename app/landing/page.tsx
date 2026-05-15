import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { getOneDayMoveMap, getTickerTape } from "@/lib/yahoo";
import {
  LandingClient,
  type LandingRanking,
  type LandingTicker,
} from "./LandingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "StockGPT — AI Stock Rankings & Portfolio Intelligence",
  description:
    "Unlock AI-powered stock rankings, portfolio tools, market news and investment research for investors who want clarity, not noise.",
};

type RankingRow = {
  id: string | number;
  rank: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
  updated_at: string | null;
};

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

  const [{ data: rankingsData }, { count: totalCount }, { count: bullishCount }] =
    await Promise.all([
      supabase
        .from("stock_rankings")
        .select("id,rank,ticker,company,sector,score,price,updated_at")
        .order("rank", { ascending: true })
        .limit(10),
      supabase.from("stock_rankings").select("*", { count: "exact", head: true }),
      supabase
        .from("stock_rankings")
        .select("*", { count: "exact", head: true })
        .gte("score", 7000),
    ]);

  const rankings = (rankingsData ?? []) as RankingRow[];

  const rankingTickers = rankings
    .map((row) => row.ticker?.trim().toUpperCase())
    .filter((ticker): ticker is string => Boolean(ticker));

  const tickerUniverse = Array.from(
    new Set([
      "^GSPC",
      "^IXIC",
      "^DJI",
      "^VIX",
      ...rankingTickers.slice(0, 10),
      "AAPL",
      "MSFT",
      "NVDA",
      "AMZN",
      "GOOGL",
      "META",
    ]),
  );

  const [moveMap, tickerTapeData] = await Promise.all([
    getOneDayMoveMap(rankingTickers),
    getTickerTape(tickerUniverse),
  ]);

  const liveRankings: LandingRanking[] = rankings.map((row, index) => {
    const ticker = row.ticker?.trim().toUpperCase() ?? "";
    const liveMove = ticker ? moveMap.get(ticker) : undefined;
    const dbPrice = numberOrNull(row.price);
    const livePrice = liveMove?.currentPrice ?? dbPrice;
    const score = numberOrNull(row.score);

    return {
      id: String(row.id ?? `${ticker}-${index}`),
      rank: row.rank ?? index + 1,
      ticker,
      company: row.company ?? ticker,
      sector: row.sector ?? "—",
      price: livePrice,
      score,
      movePct: liveMove?.changePct ?? null,
      updatedAt: row.updated_at,
      locked: true,
    };
  });

  const liveTickerTape: LandingTicker[] = tickerTapeData.map((item) => ({
    symbol: item.symbol,
    yahooSymbol: item.yahooSymbol,
    price: item.price,
    change: item.change,
    changePct: item.changePct,
  }));

  const totalStocks = totalCount ?? rankings.length;
  const bullishPct =
    totalStocks > 0 ? Math.round(((bullishCount ?? 0) / totalStocks) * 100) : 0;

  const latestUpdate =
    rankings
      .map((row) => row.updated_at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

  return (
    <LandingClient
      rankings={liveRankings}
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
