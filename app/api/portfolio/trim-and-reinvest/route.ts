import { NextRequest, NextResponse } from "next/server";
import { calculateTradeLevels } from "@/lib/trading-levels";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PortfolioRow = { id: string };
type StockRow = {
  ticker: string | null;
  price: number | string | null;
  score: number | string | null;
  rank: number | string | null;
  sector?: string | null;
};
type HoldingRow = {
  portfolio_id: string;
  entry_price: number | string | null;
};

function cleanTicker(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const valueAsNumber = Number(value);
  return Number.isFinite(valueAsNumber) ? valueAsNumber : null;
}

async function getStock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ticker: string,
): Promise<StockRow | null> {
  const { data, error } = await supabase
    .from("stock_rankings")
    .select("ticker,price,score,rank,sector")
    .eq("ticker", ticker)
    .maybeSingle();
  if (error) throw error;
  return data as StockRow | null;
}

/**
 * The migration 20261024152200_atomic_portfolio_reinvest.sql MUST be applied before
 * this handler is deployed. All portfolio and ledger writes happen in one RPC,
 * not as separate calls that could leave half of a transaction completed.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const requestedPortfolioId = String(body?.portfolioId ?? "").trim();
    const sourceTicker = cleanTicker(body?.ticker);
    const reinvestTicker = cleanTicker(body?.reinvestTicker);
    const percentage = numberOrNull(body?.percentage);

    if (!/^[A-Z][A-Z0-9.-]{0,11}$/.test(sourceTicker) ||
        !/^[A-Z][A-Z0-9.-]{0,11}$/.test(reinvestTicker) ||
        sourceTicker === reinvestTicker) {
      return NextResponse.json({ success: false, error: "Choose two valid, different tickers." }, { status: 400 });
    }

    if (percentage === null || percentage <= 0 || percentage > 100) {
      return NextResponse.json({ success: false, error: "Trim percentage must be between 1 and 100." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ success: false, error: "not_authenticated" }, { status: 401 });
    }

    const portfolioQuery = supabase
      .from("user_portfolios")
      .select("id")
      .eq("user_id", user.id)
      .is("archived_at", null);
    const { data: portfoliosData, error: portfolioError } = requestedPortfolioId
      ? await portfolioQuery.eq("id", requestedPortfolioId).limit(1)
      : await portfolioQuery.order("created_at", { ascending: true }).limit(25);

    if (portfolioError) throw portfolioError;
    const portfolios = (portfoliosData ?? []) as PortfolioRow[];
    if (portfolios.length === 0) {
      return NextResponse.json({ success: false, error: "Portfolio not found." }, { status: 404 });
    }

    const { data: holdingRows, error: holdingError } = await supabase
      .from("portfolio_holdings")
      .select("portfolio_id,entry_price")
      .in("portfolio_id", portfolios.map(portfolio => portfolio.id))
      .eq("ticker", sourceTicker)
      .order("added_at", { ascending: false })
      .limit(1);
    if (holdingError) throw holdingError;
    const sourceHolding = ((holdingRows ?? []) as HoldingRow[])[0];
    if (!sourceHolding?.portfolio_id) {
      return NextResponse.json({ success: false, error: "Holding not found." }, { status: 404 });
    }

    // Match the original API: a portfolio is always chosen from the signed-in
    // user's unarchived portfolios, never directly from an untrusted request.
    const portfolioId = sourceHolding.portfolio_id;
    if (!portfolios.some(portfolio => portfolio.id === portfolioId)) {
      return NextResponse.json({ success: false, error: "Portfolio not found." }, { status: 404 });
    }

    const [sourceStock, targetStock] = await Promise.all([
      getStock(supabase, sourceTicker),
      getStock(supabase, reinvestTicker),
    ]);
    if (!targetStock) {
      return NextResponse.json({ success: false, error: "Reinvestment stock not found in rankings." }, { status: 404 });
    }

    const sellPrice = numberOrNull(sourceStock?.price) ?? numberOrNull(sourceHolding.entry_price);
    const buyPrice = numberOrNull(targetStock.price);
    if (!sellPrice || sellPrice <= 0 || !buyPrice || buyPrice <= 0) {
      return NextResponse.json({ success: false, error: "A valid stock price is unavailable." }, { status: 400 });
    }

    const levels = await calculateTradeLevels({
      ticker: reinvestTicker,
      price: buyPrice,
      score: numberOrNull(targetStock.score) ?? 0,
      rank: numberOrNull(targetStock.rank),
      sector: targetStock.sector ?? null,
    });

    const { data, error } = await createAdminClient()
      .rpc("trim_and_reinvest_portfolio_atomic", {
        p_portfolio_id: portfolioId,
        p_user_id: user.id,
        p_source_ticker: sourceTicker,
        p_target_ticker: reinvestTicker,
        p_percentage: percentage,
        p_sell_price: sellPrice,
        p_buy_price: buyPrice,
        p_target_score: numberOrNull(targetStock.score),
        p_target_rank: numberOrNull(targetStock.rank),
        p_risk_level: levels && levels.recommendation !== "Avoid" && levels.stopLoss > 0
          ? levels.stopLoss : null,
        p_target_level: levels && levels.recommendation !== "Avoid" && levels.takeProfit > 0
          ? levels.takeProfit : null,
      });

    if (error || !data || typeof data !== "object" || data.success !== true) {
      console.error("[trim-and-reinvest] transaction rejected", {
        code: error?.code ?? "unexpected_response",
        message: error?.message ?? "No success response",
      });
      return NextResponse.json({
        success: false,
        error: "Could not complete the reinvestment. No changes were saved.",
      }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("[trim-and-reinvest] unexpected failure", error instanceof Error ? error.name : "Unknown");
    return NextResponse.json({
      success: false,
      error: "Could not complete the reinvestment. Please try again.",
    }, { status: 500 });
  }
}
