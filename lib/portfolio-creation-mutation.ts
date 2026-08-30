import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type CreationResultRow = {
  portfolio_id: string;
  holdings_count: number;
  holdings_basis: number;
  cash_balance: number;
  cash_deposited_total: number;
};

export type PortfolioCreationResult =
  | {
      success: true;
      data: {
        portfolioId: string;
        holdingsCount: number;
        holdingsBasis: number;
        cashBalance: number;
        cashDepositedTotal: number;
      };
    }
  | { success: false; error: string };

export type PortfolioDeletionResult =
  | { success: true; data: { portfolioId: string } }
  | { success: false; error: string };

function customerCreationError(message: string) {
  switch (message) {
    case "not_authenticated":
      return "not_authenticated";
    case "portfolio_name_invalid":
      return "Enter a portfolio name up to 80 characters.";
    case "portfolio_objective_invalid":
      return "Choose a valid portfolio goal.";
    case "portfolio_risk_tolerance_invalid":
    case "portfolio_time_horizon_invalid":
      return "The portfolio preferences are invalid.";
    case "portfolio_starting_cash_invalid":
      return "Starting cash must be zero or more.";
    case "portfolio_initial_state_required":
      return "Add at least one holding or enter starting cash.";
    case "portfolio_holdings_limit_exceeded":
      return "A portfolio can contain up to 100 initial holdings.";
    case "portfolio_duplicate_ticker":
      return "Each ticker can appear only once.";
    case "holding_ticker_invalid":
      return "Every holding needs a valid ticker.";
    case "holding_shares_invalid":
      return "Every holding needs a positive share quantity.";
    case "holding_price_invalid":
      return "Every holding needs a positive entry price.";
    default:
      return "The portfolio could not be created. Review the initial holdings and try again.";
  }
}

function creationResult(
  data: CreationResultRow[] | null,
  error: { message: string } | null,
): PortfolioCreationResult {
  if (error) return { success: false, error: customerCreationError(error.message) };
  const row = data?.[0];
  if (!row) {
    return {
      success: false,
      error: "The portfolio creation returned no committed result.",
    };
  }
  return {
    success: true,
    data: {
      portfolioId: row.portfolio_id,
      holdingsCount: Number(row.holdings_count),
      holdingsBasis: Number(row.holdings_basis),
      cashBalance: Number(row.cash_balance),
      cashDepositedTotal: Number(row.cash_deposited_total),
    },
  };
}

export async function createManualPortfolioAtomically(
  supabase: SupabaseClient<Database>,
  input: {
    name: string;
    objective: "growth" | "income" | "balanced" | "capital_preservation" | "watchlist";
    riskTolerance: "conservative" | "moderate" | "aggressive";
    timeHorizon: "short" | "medium" | "long";
    startingCash: number;
    holdings: Array<{
      ticker: string;
      shares: number;
      entry_price: number;
      purchase_date: string | null;
      notes: string | null;
      score_at_entry: number | null;
      rank_at_entry: number | null;
      allocation_pct: number | null;
    }>;
  },
) {
  const { data, error } = await supabase.rpc("create_manual_portfolio", {
    p_name: input.name,
    p_objective: input.objective,
    p_risk_tolerance: input.riskTolerance,
    p_time_horizon: input.timeHorizon,
    p_starting_cash: input.startingCash,
    p_holdings: input.holdings,
  });
  return creationResult(data, error);
}

export async function createAiPortfolioDraftAtomically(
  supabase: SupabaseClient<Database>,
  input: {
    name: string;
    riskTolerance: "conservative" | "moderate" | "aggressive";
    timeHorizon: "short" | "medium" | "long";
    holdings: Array<{
      ticker: string;
      shares: number;
      entry_price: number;
      score_at_entry: number | null;
      rank_at_entry: number | null;
      allocation_pct: number | null;
    }>;
  },
) {
  const { data, error } = await supabase.rpc("create_ai_portfolio_draft", {
    p_name: input.name,
    p_risk_tolerance: input.riskTolerance,
    p_time_horizon: input.timeHorizon,
    p_holdings: input.holdings,
  });
  return creationResult(data, error);
}

export async function deleteOwnedPortfolioAtomically(
  supabase: SupabaseClient<Database>,
  portfolioId: string,
): Promise<PortfolioDeletionResult> {
  const { data, error } = await supabase.rpc("delete_owned_portfolio", {
    p_portfolio_id: portfolioId,
  });
  if (error) {
    return {
      success: false,
      error:
        error.message === "not_authenticated"
          ? "not_authenticated"
          : error.message === "portfolio_id_required" || error.message === "portfolio_not_found"
            ? "Portfolio not found."
            : "The portfolio could not be deleted.",
    };
  }
  const row = data?.[0];
  if (!row) return { success: false, error: "The portfolio could not be deleted." };
  return { success: true, data: { portfolioId: row.portfolio_id } };
}
