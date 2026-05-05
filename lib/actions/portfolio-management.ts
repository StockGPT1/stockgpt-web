"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { Portfolio } from "@/lib/portfolio";

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ── Save a generated portfolio (replaces existing if any) ──
export async function savePortfolio(
  portfolio: Portfolio
): Promise<ActionResult<{ portfolioId: string }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "not_authenticated" };

  // Delete existing portfolio (one per user for now)
  await supabase
    .from("user_portfolios")
    .delete()
    .eq("user_id", user.id);

  // Create new portfolio
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
    return { success: false, error: pErr?.message ?? "Could not save portfolio" };
  }

  // Insert all holdings with entry price = current price
  const holdingsToInsert = portfolio.holdings.map((h) => ({
    portfolio_id: newPortfolio.id,
    ticker: h.ticker,
    entry_price: h.price,
    allocation_pct: h.allocationPct,
    score_at_entry: h.score,
    rank_at_entry: h.rank,
  }));

  const { error: hErr } = await supabase
    .from("portfolio_holdings")
    .insert(holdingsToInsert);

  if (hErr) return { success: false, error: hErr.message };

  revalidatePath("/portfolio");
  return { success: true, data: { portfolioId: newPortfolio.id } };
}

// ── Add a single stock to user's portfolio ──
export async function addHolding(
  ticker: string,
  entryPrice?: number
): Promise<ActionResult> {
  if (!ticker) return { success: false, error: "Missing ticker" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "not_authenticated" };

  const upperTicker = ticker.toUpperCase();

  // Verify the stock exists
  const { data: stock } = await supabase
    .from("stock_rankings")
    .select("ticker, price, score, rank")
    .eq("ticker", upperTicker)
    .maybeSingle();

  if (!stock) return { success: false, error: "Stock not found" };

  // Get or create portfolio
  let { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) {
    const { data: newP, error: pErr } = await supabase
      .from("user_portfolios")
      .insert({ user_id: user.id, name: "My Portfolio" })
      .select("id")
      .single();
    if (pErr || !newP) return { success: false, error: "Could not create portfolio" };
    portfolio = newP;
  }

  const finalEntryPrice = entryPrice ?? Number(stock.price);

  const { error } = await supabase
    .from("portfolio_holdings")
    .upsert(
      {
        portfolio_id: portfolio.id,
        ticker: upperTicker,
        entry_price: finalEntryPrice,
        score_at_entry: stock.score,
        rank_at_entry: stock.rank,
      },
      { onConflict: "portfolio_id,ticker" }
    );

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");
  return { success: true };
}

// ── Remove a holding ──
export async function removeHolding(ticker: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "not_authenticated" };

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
    .eq("ticker", ticker.toUpperCase());

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");
  return { success: true };
}

// ── Update entry price ──
export async function updateEntryPrice(
  ticker: string,
  newPrice: number
): Promise<ActionResult> {
  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    return { success: false, error: "Invalid price" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "not_authenticated" };

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
    .eq("ticker", ticker.toUpperCase());

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");
  return { success: true };
}

// ── Mark a holding as reviewed ──
export async function markReviewed(ticker: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "not_authenticated" };

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
    .eq("ticker", ticker.toUpperCase());

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");
  return { success: true };
}

// ── Delete entire portfolio ──
export async function deletePortfolio(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("user_portfolios")
    .delete()
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");
  return { success: true };
}
