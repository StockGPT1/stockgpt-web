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

function savedLevel(value: unknown) {
  const n = toNumber(value);
  return n != null && n > 0 ? n : null;
}

function savedScore(value: unknown) {
  const n = toNumber(value);
  return n != null && n > 0 ? Math.round(n) : null;
}

function hasSavedLevels(holding: HoldingLevelRow) {
  return savedLevel(holding.risk_level_at_entry) !== null || savedLevel(holding.target_level_at_entry) !== null;
}

function isStockGPTWrittenHolding(holding: HoldingLevelRow) {
  const source = String(holding.source ?? "").trim().toLowerCase();
  return source !== "manual" && source !== "trading212" && source !== "import";
}

function holdingMeta(holding: HoldingLevelRow | null | undefined) {
  return {
    original_score_at_entry: savedScore(holding?.score_at_entry),
    original_rank_at_entry: savedScore(holding?.rank_at_entry),
  };
}

function payload({
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
  const risk = savedLevel(holding.risk_level_at_entry);
  const target = savedLevel(holding.target_level_at_entry);
  if (risk === null && target === null) return null;

  return {
    ticker,
    currency: portfolio?.currency ?? "USD",
    entry_price: toNumber(holding.entry_price),
    risk_level_at_entry: risk,
    target_level_at_entry: target,
    current_price: savedLevel(ranking?.price),
  };
}

async function saveExactTradeLevels({
  supabase,
  ticker,
  holding,
  ranking,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  ticker: string;
  holding: HoldingLevelRow;
  ranking: RankingRow | null;
}) {
  if (!isStockGPTWrittenHolding(holding) || !ranking) return null;

  const entryPrice = toNumber(holding.entry_price) ?? toNumber(ranking.price);
  if (!entryPrice || entryPrice <= 0) return null;

  const tradeLevels = await calculateTradeLevels({
    ticker,
    price: entryPrice,
    score: toNumber(holding.score_at_entry) ?? toNumber(ranking.score) ?? 0,
    rank: toNumber(holding.rank_at_entry) ?? toNumber(ranking.rank),
    sector: ranking.sector ?? null,
  });

  if (!tradeLevels || tradeLevels.recommendation === "Avoid") return null;

  const riskLevel = tradeLevels.stopLoss;
  const targetLevel = tradeLevels.takeProfit;
  if (!riskLevel || !targetLevel || riskLevel <= 0 || targetLevel <= 0) return null;

  const savedRisk = savedLevel(holding.risk_level_at_entry);
  const savedTarget = savedLevel(holding.target_level_at_entry);

  if (Math.abs((savedRisk ?? 0) - riskLevel) > 0.01 || Math.abs((savedTarget ?? 0) - targetLevel) > 0.01) {
    const { error: saveError } = await supabase
      .from("portfolio_holdings")
      .update({
        risk_level_at_entry: riskLevel,
        target_level_at_entry: targetLevel,
      })
      .eq("portfolio_id", holding.portfolio_id)
      .eq("ticker", ticker);

    if (saveError) {
      console.error("[holding-trade-levels] exact level save error", saveError);
      return null;
    }
  }

  return {
    ...holding,
    risk_level_at_entry: riskLevel,
    target_level_at_entry: targetLevel,
  } satisfies HoldingLevelRow;
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

  const { data: portfoliosData, error: portfolioError } = await supabase
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

  const requestedPortfolioId = String(req.nextUrl.searchParams.get("portfolioId") ?? "").trim();
  if (requestedPortfolioId && !portfolioIds.includes(requestedPortfolioId)) {
    return NextResponse.json({ levels: null, reason: "Portfolio not found." }, { status: 404 });
  }
  const scopedPortfolioIds = requestedPortfolioId ? [requestedPortfolioId] : portfolioIds;

  const { data: holdingsData, error: holdingError } = await supabase
    .from("portfolio_holdings")
    .select("portfolio_id,ticker,entry_price,risk_level_at_entry,target_level_at_entry,score_at_entry,rank_at_entry,source")
    .in("portfolio_id", scopedPortfolioIds)
    .eq("ticker", ticker)
    .order("added_at", { ascending: false })
    .limit(requestedPortfolioId ? 1 : 8);

  if (holdingError) {
    console.error("[holding-trade-levels] holding read error", holdingError);
    return NextResponse.json({ levels: null, reason: "Could not load holding levels." }, { status: 500 });
  }

  const holdings = ((holdingsData ?? []) as HoldingLevelRow[]).filter((holding) => cleanTicker(holding.ticker) === ticker);
  if (holdings.length === 0) return NextResponse.json({ levels: null });

  const { data: rankingData } = await supabase
    .from("stock_rankings")
    .select("price,score,rank,sector")
    .eq("ticker", ticker)
    .maybeSingle();

  const ranking = rankingData as RankingRow | null;
  const stockgptHolding = holdings.find(isStockGPTWrittenHolding);
  const exactHolding = stockgptHolding
    ? await saveExactTradeLevels({ supabase, ticker, holding: stockgptHolding, ranking })
    : null;

  if (exactHolding) {
    const portfolio = portfolios.find((item) => item.id === exactHolding.portfolio_id);
    const levels = payload({ ticker, portfolio, holding: exactHolding, ranking });
    return NextResponse.json({ levels, ...holdingMeta(exactHolding) });
  }

  const holdingWithLevels = holdings.find(hasSavedLevels);
  const displayHolding = holdingWithLevels ?? stockgptHolding ?? holdings[0];
  if (!holdingWithLevels) return NextResponse.json({ levels: null, ...holdingMeta(displayHolding) });

  const portfolio = portfolios.find((item) => item.id === holdingWithLevels.portfolio_id);
  const levels = payload({ ticker, portfolio, holding: holdingWithLevels, ranking });
  return NextResponse.json({ levels, ...holdingMeta(displayHolding) });
}
