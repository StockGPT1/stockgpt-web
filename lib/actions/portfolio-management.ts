"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { Portfolio } from "@/lib/portfolio";

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

function cleanTicker(ticker: string) {
  return ticker.trim().toUpperCase();
}

export async function savePortfolio(
  portfolio: Portfolio,
): Promise<ActionResult<{ portfolioId: string }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  await supabase.from("user_portfolios").delete().eq("user_id", user.id);

  const { data: newPortfolio, error: pErr } = await supabase
    .from("user_portfolios")
    .insert({
      user_id: user.id,
      name: "My Portfolio",
      risk_tolerance: portfolio.riskTolerance,
      time_horizon: portfolio.timeHorizon,
      investment_amount: portfolio.totalInvested,
    })
    .select("id")
    .single();

  if (pErr || !newPortfolio) {
    return {
      success: false,
      error: pErr?.message ?? "Could not save portfolio",
    };
  }

  const holdingsToInsert = portfolio.holdings.map((h) => ({
    portfolio_id: newPortfolio.id,
    ticker: h.ticker,
    entry_price: h.price,
    allocation_pct: h.allocationPct,
    shares: h.shares,
    score_at_entry: h.score,
    rank_at_entry: h.rank,
  }));

  const { error: hErr } = await supabase
    .from("portfolio_holdings")
    .insert(holdingsToInsert);

  if (hErr) return { success: false, error: hErr.message };

  revalidatePath("/portfolio");

  for (const holding of portfolio.holdings) {
    revalidatePath(`/stock/${holding.ticker}`);
  }

  return { success: true, data: { portfolioId: newPortfolio.id } };
}

export async function addHolding(
  ticker: string,
  entryPrice?: number,
  shares?: number,
): Promise<ActionResult> {
  const upperTicker = cleanTicker(ticker);

  if (!upperTicker) return { success: false, error: "Missing ticker" };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const { data: stock } = await supabase
    .from("stock_rankings")
    .select("ticker, price, score, rank")
    .eq("ticker", upperTicker)
    .maybeSingle();

  if (!stock) return { success: false, error: "Stock not found in rankings" };

  let { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) {
    const { data: newPortfolio, error: pErr } = await supabase
      .from("user_portfolios")
      .insert({
        user_id: user.id,
        name: "My Portfolio",
        risk_tolerance: "moderate",
        time_horizon: "medium",
      })
      .select("id")
      .single();

    if (pErr || !newPortfolio) {
      return { success: false, error: "Could not create portfolio" };
    }

    portfolio = newPortfolio;
  }

  const finalEntryPrice =
    entryPrice && Number.isFinite(entryPrice) && entryPrice > 0
      ? entryPrice
      : Number(stock.price);

  const finalShares =
    shares && Number.isFinite(shares) && shares > 0 ? shares : 1;

  const { error } = await supabase.from("portfolio_holdings").upsert(
    {
      portfolio_id: portfolio.id,
      ticker: upperTicker,
      entry_price: finalEntryPrice,
      shares: finalShares,
      score_at_entry: stock.score,
      rank_at_entry: stock.rank,
      last_reviewed_at: new Date().toISOString(),
    },
    { onConflict: "portfolio_id,ticker" },
  );

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");
  revalidatePath(`/stock/${upperTicker}`);

  return { success: true };
}

export async function removeHolding(ticker: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const upperTicker = cleanTicker(ticker);

  const { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) return { success: false, error: "No portfolio" };

  const { error } = await supabase
    .from("portfolio_holdings")
    .delete()
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker);

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");
  revalidatePath(`/stock/${upperTicker}`);

  return { success: true };
}

export async function updateEntryPrice(
  ticker: string,
  newPrice: number,
): Promise<ActionResult> {
  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    return { success: false, error: "Invalid price" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const upperTicker = cleanTicker(ticker);

  const { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) return { success: false, error: "No portfolio" };

  const { error } = await supabase
    .from("portfolio_holdings")
    .update({ entry_price: newPrice })
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker);

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");
  revalidatePath(`/stock/${upperTicker}`);

  return { success: true };
}

export async function updateShares(
  ticker: string,
  newShares: number,
): Promise<ActionResult> {
  if (!Number.isFinite(newShares) || newShares < 0) {
    return { success: false, error: "Invalid share count" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const upperTicker = cleanTicker(ticker);

  if (newShares === 0) {
    return removeHolding(upperTicker);
  }

  const { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) return { success: false, error: "No portfolio" };

  const { error } = await supabase
    .from("portfolio_holdings")
    .update({ shares: newShares })
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker);

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");
  revalidatePath(`/stock/${upperTicker}`);

  return { success: true };
}

export async function markReviewed(ticker: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const upperTicker = cleanTicker(ticker);

  const { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) return { success: false, error: "No portfolio" };

  const { error } = await supabase
    .from("portfolio_holdings")
    .update({ last_reviewed_at: new Date().toISOString() })
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker);

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");
  revalidatePath(`/stock/${upperTicker}`);

  return { success: true };
}

export async function deletePortfolio(): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const { data: existingHoldings } = await supabase
    .from("user_portfolios")
    .select("portfolio_holdings(ticker)")
    .eq("user_id", user.id)
    .maybeSingle();

  const tickers =
    existingHoldings?.portfolio_holdings?.map((holding: { ticker: string }) =>
      cleanTicker(holding.ticker),
    ) ?? [];

  const { error } = await supabase
    .from("user_portfolios")
    .delete()
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");

  for (const ticker of tickers) {
    revalidatePath(`/stock/${ticker}`);
  }

  return { success: true };
}
