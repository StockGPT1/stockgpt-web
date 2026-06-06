import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type HoldingRow = {
  ticker: string | null;
  shares: number | null;
  entry_price: number | null;
};

type RankingRow = {
  ticker: string | null;
  company: string | null;
  sector: string | null;
  rank: number | null;
  score: number | string | null;
  price: number | string | null;
};

function cleanTicker(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ holdings: [] }, { status: 401 });
  }

  const { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!portfolio?.id) {
    return NextResponse.json({ holdings: [] });
  }

  const { data: holdingsData } = await supabase
    .from("portfolio_holdings")
    .select("ticker,shares,entry_price")
    .eq("portfolio_id", portfolio.id)
    .order("ticker", { ascending: true });

  const holdings = ((holdingsData ?? []) as HoldingRow[])
    .map((holding) => ({
      ticker: cleanTicker(holding.ticker),
      shares: toNumber(holding.shares, 0),
      entryPrice: toNumber(holding.entry_price, 0),
    }))
    .filter((holding) => holding.ticker && holding.shares > 0);

  if (holdings.length === 0) {
    return NextResponse.json({ holdings: [] });
  }

  const { data: rankingData } = await supabase
    .from("stock_rankings")
    .select("ticker,company,sector,rank,score,price")
    .in("ticker", holdings.map((holding) => holding.ticker));

  const rankingMap = new Map(
    ((rankingData ?? []) as RankingRow[])
      .filter((row) => row.ticker)
      .map((row) => [cleanTicker(row.ticker), row]),
  );

  return NextResponse.json({
    holdings: holdings.map((holding) => {
      const ranking = rankingMap.get(holding.ticker);
      const price = toNumber(ranking?.price, holding.entryPrice);
      return {
        ticker: holding.ticker,
        company: ranking?.company ?? null,
        sector: ranking?.sector ?? null,
        rank: ranking?.rank ?? null,
        score: ranking?.score == null ? null : Number(ranking.score),
        shares: holding.shares,
        currentValue: price * holding.shares,
      };
    }),
  });
}
