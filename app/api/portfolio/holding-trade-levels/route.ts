import { NextRequest, NextResponse } from "next/server";
import { calculateTradeLevels } from "@/lib/trading-levels";
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
  score_at_entry: number | string | null;
  rank_at_entry: number | string | null;
  source: string | null;
};

type RankingRow = {
  ticker: string | null;
  price: number | string | null;
  score: number | string | null;
  rank: number | string | null;
  sector: string | null;
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

function shouldBackfillLevels(holding: HoldingLevelRow) {
  const source = String(holding.source ?? "").toLowerCase();
  if (!source) return false;
  return source !== "manual" && source !== "trading212";
}

function buildPayload({
  ticker,
  portfolio,
  holding,
  ranking,
}: {
  ticker: string;
  portfolio?: PortfolioRow;
  holding: HoldingLevelRow;
  ranking: RankingRow | null;
}) {
  return {
    ticker,
    currency: portfolio?.currency ?? "USD",
    entry_price: toNumber(holding.entry_price),
    risk_level_at_entry: toNumber(holding.risk_level_at_entry),
    target_level_at_entry: toNumber(holding.target_level_at_entry),
    current_price: toNumber(ranking?.price),
  };
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
    .select("portfolio_id,ticker,entry_price,risk_level_at_entry,target_level_at_entry,score_at_entry,rank_at_entry,source")
    .in("portfolio_id", scopedPortfolioIds)
    .eq("ticker", ticker)
    .order("added_at", { ascending: false })
    .limit(8);

  if (holdingError) {
    console.error("[holding-trade-levels] holding read error", holdingError);
    return NextResponse.json({ levels: null, reason: "Could not load holding levels." }, { status: 500 });
  }

  const holdings = ((holdingsData ?? []) as HoldingLevelRow[]).filter((holding) => cleanTicker(holding.ticker) === ticker);
  if (holdings.length === 0) return NextResponse.json({ levels: null });

  const { data: rankingData } = await supabase
    .from("stock_rankings")
    .select("ticker,price,score,rank,sector")
    .eq("ticker", ticker)
    .maybeSingle();

  const ranking = rankingData as RankingRow | null;
  const holdingWithLevels = holdings.find((holding) => toNumber(holding.risk_level_at_entry) !== null || toNumber(holding.target_level_at_entry) !== null);

  if (holdingWithLevels) {
    const portfolio = portfolios.find((item) => item.id === holdingWithLevels.portfolio_id);
    return NextResponse.json({ levels: buildPayload({ ticker, portfolio, holding: holdingWithLevels, ranking }) });
  }

  const holdingToBackfill = holdings.find(shouldBackfillLevels);
  if (!holdingToBackfill || !ranking) return NextResponse.json({ levels: null });

  const entryPrice = toNumber(holdingToBackfill.entry_price) ?? toNumber(ranking.price);
  if (!entryPrice || entryPrice <= 0) return NextResponse.json({ levels: null });

  const score = toNumber(holdingToBackfill.score_at_entry) ?? toNumber(ranking.score) ?? 0;
  const rank = toNumber(holdingToBackfill.rank_at_entry) ?? toNumber(ranking.rank);

  const levels = await calculateTradeLevels({
    ticker,
    price: entryPrice,
    score,
    rank,
    sector: ranking.sector ?? null,
  });

  if (!levels || levels.recommendation === "Avoid") return NextResponse.json({ levels: null });

  const { error: updateError } = await (supabase as any)
    .from("portfolio_holdings")
    .update({
      risk_level_at_entry: levels.stopLoss,
      target_level_at_entry: levels.takeProfit,
    })
    .eq("portfolio_id", holdingToBackfill.portfolio_id)
    .eq("ticker", ticker);

  if (updateError) {
    console.error("[holding-trade-levels] backfill error", updateError);
  }

  const backfilledHolding: HoldingLevelRow = {
    ...holdingToBackfill,
    risk_level_at_entry: levels.stopLoss,
    target_level_at_entry: levels.takeProfit,
  };
  const portfolio = portfolios.find((item) => item.id === backfilledHolding.portfolio_id);

  return NextResponse.json({ levels: buildPayload({ ticker, portfolio, holding: backfilledHolding, ranking }) });
}
