import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type PortfolioHoldingMutationResult =
  | {
      success: true;
      data: {
        portfolioId: string;
        transactionId: string;
        holdingId: string | null;
        ticker: string;
        shares: number;
        entryPrice: number | null;
        cashBalance?: number;
        cashDepositedTotal?: number;
        realisedPnl?: number;
        updatedExisting?: boolean;
        closed?: boolean;
      };
    }
  | { success: false; error: string };

function customerHoldingError(message: string) {
  switch (message) {
    case "not_authenticated":
      return "not_authenticated";
    case "portfolio_id_required":
    case "portfolio_not_found":
      return "Portfolio not found.";
    case "holding_ticker_invalid":
      return "Enter a valid ticker.";
    case "holding_shares_invalid":
      return "Enter a positive share quantity.";
    case "holding_price_invalid":
      return "Enter a valid positive price.";
    case "holding_not_found":
      return "Holding not found.";
    case "holding_shares_exceeded":
      return "You cannot sell more shares than this holding contains.";
    case "insufficient_cash":
      return "This portfolio does not have enough available cash for that purchase.";
    case "portfolio_currency_unsupported":
      return "Holding changes are temporarily limited to USD portfolios while legacy currency balances are reconciled.";
    case "portfolio_financial_state_invalid":
    case "holding_financial_state_invalid":
      return "This portfolio's financial facts require review before this change can be saved.";
    default:
      return "The holding change could not be saved. Refresh the portfolio before trying again.";
  }
}

function failed(error: { message: string } | null) {
  return { success: false as const, error: customerHoldingError(error?.message ?? "") };
}

export async function buyPortfolioHolding(
  supabase: SupabaseClient<Database>,
  input: {
    portfolioId: string;
    ticker: string;
    shares: number;
    price: number;
    purchaseDate?: string | null;
    notes?: string | null;
  },
): Promise<PortfolioHoldingMutationResult> {
  const { data, error } = await supabase.rpc("buy_portfolio_holding", {
    p_portfolio_id: input.portfolioId,
    p_ticker: input.ticker,
    p_shares: input.shares,
    p_price: input.price,
    ...(input.purchaseDate ? { p_purchase_date: input.purchaseDate } : {}),
    ...(input.notes ? { p_notes: input.notes } : {}),
  });
  if (error) return failed(error);
  const row = data?.[0];
  if (!row) return failed(null);
  return {
    success: true,
    data: {
      portfolioId: row.portfolio_id,
      transactionId: row.transaction_id,
      holdingId: row.holding_id,
      ticker: row.ticker,
      shares: Number(row.shares),
      entryPrice: Number(row.entry_price),
      cashBalance: Number(row.cash_balance),
      cashDepositedTotal: Number(row.cash_deposited_total),
      updatedExisting: row.updated_existing,
    },
  };
}

export async function logExistingPortfolioHolding(
  supabase: SupabaseClient<Database>,
  input: {
    portfolioId: string;
    ticker: string;
    shares: number;
    entryPrice: number;
    purchaseDate?: string | null;
    notes?: string | null;
  },
): Promise<PortfolioHoldingMutationResult> {
  const { data, error } = await supabase.rpc("log_existing_portfolio_holding", {
    p_portfolio_id: input.portfolioId,
    p_ticker: input.ticker,
    p_shares: input.shares,
    p_entry_price: input.entryPrice,
    ...(input.purchaseDate ? { p_purchase_date: input.purchaseDate } : {}),
    ...(input.notes ? { p_notes: input.notes } : {}),
  });
  if (error) return failed(error);
  const row = data?.[0];
  if (!row) return failed(null);
  return {
    success: true,
    data: {
      portfolioId: row.portfolio_id,
      transactionId: row.transaction_id,
      holdingId: row.holding_id,
      ticker: row.ticker,
      shares: Number(row.shares),
      entryPrice: Number(row.entry_price),
      cashBalance: Number(row.cash_balance),
      cashDepositedTotal: Number(row.cash_deposited_total),
      updatedExisting: row.updated_existing,
    },
  };
}

export async function sellPortfolioHolding(
  supabase: SupabaseClient<Database>,
  input: { portfolioId: string; ticker: string; shares: number; price: number },
): Promise<PortfolioHoldingMutationResult> {
  const { data, error } = await supabase.rpc("sell_portfolio_holding", {
    p_portfolio_id: input.portfolioId,
    p_ticker: input.ticker,
    p_shares: input.shares,
    p_price: input.price,
  });
  if (error) return failed(error);
  const row = data?.[0];
  if (!row) return failed(null);
  return {
    success: true,
    data: {
      portfolioId: row.portfolio_id,
      transactionId: row.transaction_id,
      holdingId: row.holding_id,
      ticker: row.ticker,
      shares: Number(row.shares),
      entryPrice: Number(row.entry_price),
      cashBalance: Number(row.cash_balance),
      cashDepositedTotal: Number(row.cash_deposited_total),
      realisedPnl: Number(row.realised_pnl),
      closed: row.closed,
    },
  };
}

export async function correctPortfolioHolding(
  supabase: SupabaseClient<Database>,
  input: {
    portfolioId: string;
    ticker: string;
    shares: number;
    entryPrice: number;
    purchaseDate?: string | null;
    notes?: string | null;
  },
): Promise<PortfolioHoldingMutationResult> {
  const { data, error } = await supabase.rpc("correct_portfolio_holding", {
    p_portfolio_id: input.portfolioId,
    p_ticker: input.ticker,
    p_shares: input.shares,
    p_entry_price: input.entryPrice,
    ...(input.purchaseDate ? { p_purchase_date: input.purchaseDate } : {}),
    ...(input.notes ? { p_notes: input.notes } : {}),
  });
  if (error) return failed(error);
  const row = data?.[0];
  if (!row) return failed(null);
  return {
    success: true,
    data: {
      portfolioId: row.portfolio_id,
      transactionId: row.transaction_id,
      holdingId: row.holding_id,
      ticker: row.ticker,
      shares: Number(row.shares),
      entryPrice: Number(row.entry_price),
    },
  };
}

export async function removePortfolioHoldingTracking(
  supabase: SupabaseClient<Database>,
  input: { portfolioId: string; ticker: string },
): Promise<PortfolioHoldingMutationResult> {
  const { data, error } = await supabase.rpc("remove_portfolio_holding_tracking", {
    p_portfolio_id: input.portfolioId,
    p_ticker: input.ticker,
  });
  if (error) return failed(error);
  const row = data?.[0];
  if (!row) return failed(null);
  return {
    success: true,
    data: {
      portfolioId: row.portfolio_id,
      transactionId: row.transaction_id,
      holdingId: null,
      ticker: row.ticker,
      shares: Number(row.removed_shares),
      entryPrice: null,
      cashBalance: Number(row.cash_balance),
      cashDepositedTotal: Number(row.cash_deposited_total),
    },
  };
}
