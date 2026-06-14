import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PortfolioRow = {
  id: string;
  currency: string | null;
};

type HoldingLevelRow = {
  portfolio_id: string;
  ticker: string | null;
  entry_price: number | string | null;
  risk_level_at_entry: number | string | null;
  target_level_at_entry: number | string | null;
};

type RankingRow = {
  price: number | string | null;
};

function cleanTicker(value: string | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const ticker = cleanTicker(req.nextUrl.searchParams.get("ticker"));
  if (!ticker) {
    return NextResponse.json({ levels: null, reason: "Missing ticker." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ levels: null, reason: "Login required." }, { status: 401 });
  }

  const { data: portfoliosData, error: portfolioError } = await (supabase as any)
    .from("user_portfolios")
    .select("id,currency")
    .eq("user_id", user.id)
    .is("archived_at", null);

  if (portfolioError) {
    console.error("[holding-trade-levels] portfolio read error", portfolioError);
    return NextResponse.json({ levels: null, reason: "Could not load portfolios." }, { status: 500 });
  }

  const portfolios = (portfoliosData ?? []) as PortfolioRow[];
  const portfolioIds = portfolios.map((portfolio) => portfolio.id);
  if (portfolioIds.length === 0) return NextResponse.json({ levels: null });

  const portfolioId = req.nextUrl.searchParams.get("portfolioId");
  const scopedPortfolioIds = portfolioId && portfolioIds.includes(portfolioId) ? [portfolioId] : portfolioIds;

  const { data: holdingsData, error: holdingError } = await (supabase as any)
    .from("portfolio_holdings")
    .select("portfolio_id,ticker,entry_price,risk_level_at_entry,target_level_at_entry")
    .in("portfolio_id", scopedPortfolioIds)
    .eq("ticker", ticker)
    .order("added_at", { ascending: false })
    .limit(8);

  if (holdingError) {
    console.error("[holding-trade-levels] holding read error", holdingError);
    return NextResponse.json({ levels: null, reason: "Could not load holding levels." }, { status: 500 });
  }

  const holdings = ((holdingsData ?? []) as HoldingLevelRow[]).filter((holding) => cleanTicker(holding.ticker) === ticker);
  const holdingWithLevels = holdings.find((holding) => toNumber(holding.risk_level_at_entry) !== null || toNumber(holding.target_level_at_entry) !== null);

  if (!holdingWithLevels) {
    return NextResponse.json({ levels: null });
  }

  const { data: rankingData } = await supabase
    .from("stock_rankings")
    .select("price")
    .eq("ticker", ticker)
    .maybeSingle();

  const portfolio = portfolios.find((item) => item.id === holdingWithLevels.portfolio_id);
  const ranking = rankingData as RankingRow | null;

  return NextResponse.json({
    levels: {
      ticker,
      currency: portfolio?.currency ?? "USD",
      entry_price: toNumber(holdingWithLevels.entry_price),
      risk_level_at_entry: toNumber(holdingWithLevels.risk_level_at_entry),
      target_level_at_entry: toNumber(holdingWithLevels.target_level_at_entry),
      current_price: toNumber(ranking?.price),
    },
  });
}
