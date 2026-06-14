import { NextRequest, NextResponse } from "next/server";
import { calculateTradeLevels } from "@/lib/trading-levels";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PortfolioRow = {
  id: string;
  cash_balance: number | string | null;
  currency: string | null;
};

type StockRow = {
  ticker: string | null;
  price: number | string | null;
  score: number | string | null;
  rank: number | string | null;
  sector?: string | null;
};

type HoldingRow = {
  shares: number | string | null;
  entry_price: number | string | null;
  purchase_date?: string | null;
  notes?: string | null;
};

function cleanTicker(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundShares(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

async function getStock(supabase: Awaited<ReturnType<typeof createClient>>, ticker: string) {
  const { data } = await supabase
    .from("stock_rankings")
    .select("ticker,price,score,rank,sector")
    .eq("ticker", ticker)
    .maybeSingle();

  return data as StockRow | null;
}

async function recordTransaction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    portfolioId: string;
    userId: string;
    ticker: string;
    type: "buy" | "sell";
    shares: number;
    price: number;
    amount: number;
    realisedPnl?: number | null;
    currency: string;
    notes: string;
  },
) {
  await supabase.from("portfolio_transactions").insert({
    portfolio_id: input.portfolioId,
    user_id: input.userId,
    ticker: input.ticker,
    type: input.type,
    shares: input.shares,
    price: input.price,
    amount: roundMoney(input.amount),
    realised_pnl: input.realisedPnl == null ? null : roundMoney(input.realisedPnl),
    currency: input.currency,
    notes: input.notes,
  });
}

async function saveEntryTradeLevels(
  stock: StockRow,
  entryPrice: number,
) {
  const ticker = cleanTicker(stock.ticker);
  if (!ticker || entryPrice <= 0) return { risk: null as number | null, target: null as number | null };

  const tradeLevels = await calculateTradeLevels({
    ticker,
    price: entryPrice,
    score: toNumber(stock.score, 0),
    rank: Number.isFinite(Number(stock.rank)) ? Number(stock.rank) : null,
    sector: stock.sector ?? null,
  });

  if (!tradeLevels || tradeLevels.recommendation === "Avoid") {
    return { risk: null as number | null, target: null as number | null };
  }

  return {
    risk: tradeLevels.stopLoss > 0 ? tradeLevels.stopLoss : null,
    target: tradeLevels.takeProfit > 0 ? tradeLevels.takeProfit : null,
  };
}

async function recalculatePortfolioTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  portfolioId: string,
) {
  const [{ data: holdings }, { data: portfolio }] = await Promise.all([
    supabase.from("portfolio_holdings").select("entry_price,shares").eq("portfolio_id", portfolioId),
    supabase.from("user_portfolios").select("cash_balance,cash_deposited_total").eq("id", portfolioId).maybeSingle(),
  ]);

  const holdingsCost = ((holdings ?? []) as Array<{ entry_price: number | string | null; shares: number | string | null }>).reduce(
    (sum, holding) => sum + toNumber(holding.entry_price) * toNumber(holding.shares),
    0,
  );
  const cashBalance = toNumber((portfolio as any)?.cash_balance);
  const deposited = toNumber((portfolio as any)?.cash_deposited_total);

  await supabase
    .from("user_portfolios")
    .update({
      investment_amount: roundMoney(holdingsCost),
      cash_deposited_total: roundMoney(Math.max(deposited, cashBalance + holdingsCost)),
    })
    .eq("id", portfolioId);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const portfolioId = String(body?.portfolioId ?? "").trim();
  const sourceTicker = cleanTicker(body?.ticker);
  const reinvestTicker = cleanTicker(body?.reinvestTicker);
  const percentage = Number(body?.percentage);

  if (!portfolioId) return NextResponse.json({ success: false, error: "Missing portfolio." }, { status: 400 });
  if (!sourceTicker) return NextResponse.json({ success: false, error: "Missing holding ticker." }, { status: 400 });
  if (!reinvestTicker) return NextResponse.json({ success: false, error: "Missing reinvestment ticker." }, { status: 400 });
  if (reinvestTicker === sourceTicker) return NextResponse.json({ success: false, error: "Reinvestment target must be a different stock." }, { status: 400 });
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
    return NextResponse.json({ success: false, error: "Trim percentage must be between 1 and 100." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ success: false, error: "not_authenticated" }, { status: 401 });

  const { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id,cash_balance,currency")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .maybeSingle();

  if (!portfolio) return NextResponse.json({ success: false, error: "Portfolio not found." }, { status: 404 });

  const { data: sourceHolding } = await supabase
    .from("portfolio_holdings")
    .select("shares,entry_price")
    .eq("portfolio_id", portfolioId)
    .eq("ticker", sourceTicker)
    .maybeSingle();

  if (!sourceHolding) return NextResponse.json({ success: false, error: "Holding not found." }, { status: 404 });

  const [sourceStock, targetStock] = await Promise.all([
    getStock(supabase, sourceTicker),
    getStock(supabase, reinvestTicker),
  ]);

  if (!targetStock) return NextResponse.json({ success: false, error: "Reinvestment stock not found in rankings." }, { status: 404 });

  const currentShares = toNumber((sourceHolding as HoldingRow).shares);
  const sourceEntryPrice = toNumber((sourceHolding as HoldingRow).entry_price);
  const sellPrice = toNumber(sourceStock?.price, sourceEntryPrice);
  const buyPrice = toNumber(targetStock.price);

  if (currentShares <= 0 || sellPrice <= 0) {
    return NextResponse.json({ success: false, error: "Could not calculate trim value." }, { status: 400 });
  }

  if (buyPrice <= 0) {
    return NextResponse.json({ success: false, error: "Could not find a valid reinvestment price." }, { status: 400 });
  }

  const sharesToSell = percentage >= 100 ? currentShares : roundShares(currentShares * (percentage / 100));
  const remainingShares = roundShares(currentShares - sharesToSell);
  const proceeds = roundMoney(sharesToSell * sellPrice);
  const realisedPnl = roundMoney((sellPrice - sourceEntryPrice) * sharesToSell);
  const boughtShares = roundShares(proceeds / buyPrice);

  if (sharesToSell <= 0 || proceeds <= 0 || boughtShares <= 0) {
    return NextResponse.json({ success: false, error: "Trim amount is too small to reinvest." }, { status: 400 });
  }

  const { data: existingTarget } = await supabase
    .from("portfolio_holdings")
    .select("shares,entry_price,purchase_date,notes")
    .eq("portfolio_id", portfolioId)
    .eq("ticker", reinvestTicker)
    .maybeSingle();

  const oldTargetShares = toNumber((existingTarget as HoldingRow | null)?.shares);
  const oldTargetEntry = toNumber((existingTarget as HoldingRow | null)?.entry_price);
  const nextTargetShares = roundShares(oldTargetShares + boughtShares);
  const nextTargetEntry = nextTargetShares > 0
    ? ((oldTargetShares * oldTargetEntry) + proceeds) / nextTargetShares
    : buyPrice;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const levels = await saveEntryTradeLevels(targetStock, buyPrice);

  if (remainingShares <= 0.000001) {
    const { error: deleteError } = await supabase
      .from("portfolio_holdings")
      .delete()
      .eq("portfolio_id", portfolioId)
      .eq("ticker", sourceTicker);
    if (deleteError) return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
  } else {
    const { error: updateError } = await supabase
      .from("portfolio_holdings")
      .update({ shares: remainingShares })
      .eq("portfolio_id", portfolioId)
      .eq("ticker", sourceTicker);
    if (updateError) return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  }

  const { error: upsertError } = await supabase.from("portfolio_holdings").upsert(
    {
      portfolio_id: portfolioId,
      ticker: reinvestTicker,
      entry_price: Math.round(nextTargetEntry * 10_000) / 10_000,
      shares: nextTargetShares,
      allocation_pct: null,
      score_at_entry: toNumber(targetStock.score, null),
      rank_at_entry: Number.isFinite(Number(targetStock.rank)) ? Number(targetStock.rank) : null,
      risk_level_at_entry: levels.risk,
      target_level_at_entry: levels.target,
      last_reviewed_at: now,
      purchase_date: (existingTarget as HoldingRow | null)?.purchase_date ?? today,
      source: "reinvest",
      notes: (existingTarget as HoldingRow | null)?.notes ?? `Reinvested from ${sourceTicker} trim.`,
    },
    { onConflict: "portfolio_id,ticker" },
  );

  if (upsertError) return NextResponse.json({ success: false, error: upsertError.message }, { status: 500 });

  const { error: cashError } = await supabase
    .from("user_portfolios")
    .update({ cash_balance: roundMoney(toNumber((portfolio as PortfolioRow).cash_balance)) })
    .eq("id", portfolioId)
    .eq("user_id", user.id);

  if (cashError) return NextResponse.json({ success: false, error: cashError.message }, { status: 500 });

  const currency = (portfolio as PortfolioRow).currency ?? "USD";
  await recordTransaction(supabase, {
    portfolioId,
    userId: user.id,
    ticker: sourceTicker,
    type: "sell",
    shares: sharesToSell,
    price: sellPrice,
    amount: proceeds,
    realisedPnl,
    currency,
    notes: `Trimmed ${percentage.toFixed(0)}% of ${sourceTicker} and reinvested into ${reinvestTicker}.`,
  });
  await recordTransaction(supabase, {
    portfolioId,
    userId: user.id,
    ticker: reinvestTicker,
    type: "buy",
    shares: boughtShares,
    price: buyPrice,
    amount: proceeds,
    currency,
    notes: `Reinvested ${sourceTicker} trim proceeds into ${reinvestTicker}.`,
  });

  await recalculatePortfolioTotals(supabase, portfolioId);

  return NextResponse.json({
    success: true,
    soldTicker: sourceTicker,
    boughtTicker: reinvestTicker,
    soldShares: sharesToSell,
    boughtShares,
    amount: proceeds,
  });
}
