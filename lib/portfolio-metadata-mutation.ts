import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type MutationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function metadataError(message: string) {
  switch (message) {
    case "not_authenticated":
      return "not_authenticated";
    case "portfolio_id_required":
    case "portfolio_not_found":
      return "Portfolio not found.";
    case "portfolio_name_invalid":
      return "Portfolio name cannot be empty or longer than 80 characters.";
    case "portfolio_objective_invalid":
      return "Choose a valid portfolio objective.";
    case "portfolio_risk_tolerance_invalid":
      return "Choose a valid risk tolerance.";
    case "portfolio_time_horizon_invalid":
      return "Choose a valid time horizon.";
    case "holding_ticker_invalid":
      return "Enter a valid ticker.";
    case "holding_not_found":
      return "Holding not found.";
    default:
      return "The portfolio details could not be updated.";
  }
}

export async function renameOwnedPortfolio(
  supabase: SupabaseClient<Database>,
  input: { portfolioId: string; name: string },
): Promise<MutationResult<{ portfolioId: string; name: string }>> {
  const { data, error } = await supabase.rpc("rename_owned_portfolio", {
    p_portfolio_id: input.portfolioId,
    p_name: input.name,
  });
  if (error) return { success: false, error: metadataError(error.message) };
  const row = data?.[0];
  if (!row) return { success: false, error: "The portfolio details could not be updated." };
  return {
    success: true,
    data: { portfolioId: row.portfolio_id, name: row.portfolio_name },
  };
}

export async function updateOwnedPortfolioPreferences(
  supabase: SupabaseClient<Database>,
  input: {
    portfolioId: string;
    objective: "growth" | "income" | "balanced" | "capital_preservation" | "watchlist";
    riskTolerance: "conservative" | "moderate" | "aggressive";
    timeHorizon: "short" | "medium" | "long";
  },
): Promise<MutationResult<{ portfolioId: string }>> {
  const { data, error } = await supabase.rpc("update_owned_portfolio_preferences", {
    p_portfolio_id: input.portfolioId,
    p_objective: input.objective,
    p_risk_tolerance: input.riskTolerance,
    p_time_horizon: input.timeHorizon,
  });
  if (error) return { success: false, error: metadataError(error.message) };
  const row = data?.[0];
  if (!row) return { success: false, error: "The portfolio details could not be updated." };
  return { success: true, data: { portfolioId: row.portfolio_id } };
}

export async function markPortfolioHoldingReviewed(
  supabase: SupabaseClient<Database>,
  input: { portfolioId: string; ticker: string },
): Promise<MutationResult<{ portfolioId: string; ticker: string; reviewedAt: string }>> {
  const { data, error } = await supabase.rpc("mark_portfolio_holding_reviewed", {
    p_portfolio_id: input.portfolioId,
    p_ticker: input.ticker,
  });
  if (error) return { success: false, error: metadataError(error.message) };
  const row = data?.[0];
  if (!row) return { success: false, error: "The holding review could not be recorded." };
  return {
    success: true,
    data: {
      portfolioId: row.portfolio_id,
      ticker: row.ticker,
      reviewedAt: row.reviewed_at,
    },
  };
}
