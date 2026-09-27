import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolveOwnedPortfolioContext } from "@/lib/portfolio-context-server";
import { loadAllInvestments } from "@/lib/all-investments";
import { loadConnectedPortfolioIntelligence } from "@/lib/connected-portfolio-intelligence";

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

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ portfolios: [], portfolioId: null, holdings: [] }, { status: 401 });
  }

  /* All the user's portfolios feed the workspace's focus picker; the
     requested one (validated against ownership by the user_id filter)
     decides which holdings load. */
  const { data: portfoliosData } = await supabase
    .from("user_portfolios")
    .select("id,name,management_source,created_at")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  const sourcePortfolios = ((portfoliosData ?? []) as Array<{ id: string; name: string | null; management_source: "manual" | "connected"; created_at: string }>).map(
    (portfolio, index) => ({
      id: portfolio.id,
      name: String(portfolio.name ?? "").trim() || `Portfolio ${index + 1}`,
      source: portfolio.management_source,
      createdAt: portfolio.created_at,
    }),
  );
  const portfolios = sourcePortfolios.length ? [{ id: "all-investments", name: "All Investments" }, ...sourcePortfolios.map(({ id, name }) => ({ id, name }))] : [];

  if (portfolios.length === 0) {
    return NextResponse.json({ portfolios: [], portfolioId: null, holdings: [] });
  }

  const requestedId = new URL(request.url).searchParams.get("portfolioId")?.trim() ?? "";
  const context = await resolveOwnedPortfolioContext(supabase, user.id, requestedId, sourcePortfolios);
  if (!context) return NextResponse.json({ portfolios: [], portfolioId: null, holdings: [] });
  if (context.kind === "all_investments") {
    const aggregate = await loadAllInvestments(supabase, user.id, sourcePortfolios, new Date().toISOString());
    return NextResponse.json({ portfolios, portfolioId: "all-investments", holdings: aggregate.input.holdings.map((holding) => ({ ticker: holding.ticker ?? holding.instrumentKey, company: null, sector: null, rank: holding.ranking?.currentRank ?? null, score: holding.ranking?.currentScore ?? null, shares: holding.shares ?? null, currentValue: holding.currentValue })) });
  }
  const portfolio = sourcePortfolios.find((item) => item.id === context.portfolioId)!;
  if (portfolio.source === "connected") {
    const connected = await loadConnectedPortfolioIntelligence(supabase, portfolio.id, new Date().toISOString());
    return NextResponse.json({ portfolios, portfolioId: portfolio.id, holdings: (connected?.input.holdings ?? []).map((holding) => ({ ticker: holding.ticker ?? holding.instrumentKey, company: null, sector: null, rank: holding.ranking?.currentRank ?? null, score: holding.ranking?.currentScore ?? null, shares: holding.shares ?? null, currentValue: holding.currentValue })) });
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
    return NextResponse.json({ portfolios, portfolioId: portfolio.id, holdings: [] });
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
    portfolios,
    portfolioId: portfolio.id,
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
