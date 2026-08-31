import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { PreparedTrading212Holding } from "@/lib/trading212-import";

type CsvMutationRow = {
  portfolio_id: string;
  holdings_count: number;
  holdings_basis: number;
  cash_balance: number;
  cash_deposited_total: number;
};

export type PortfolioCsvMutationResult =
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

function customerCsvMutationError(message: string) {
  switch (message) {
    case "not_authenticated":
      return "not_authenticated";
    case "portfolio_name_invalid":
      return "Enter a portfolio name up to 80 characters.";
    case "portfolio_not_found":
      return "Portfolio not found.";
    case "portfolio_currency_unsupported":
      return "Trading 212 replacement is available only for a Portfolio stored unambiguously in USD.";
    case "portfolio_holdings_invalid":
    case "portfolio_initial_state_required":
      return "The CSV must contain at least one supported open holding.";
    case "portfolio_holdings_limit_exceeded":
      return "A CSV import can contain up to 100 open holdings.";
    case "portfolio_duplicate_ticker":
      return "The prepared CSV contains an ambiguous duplicate ticker.";
    case "holding_ticker_invalid":
    case "holding_shares_invalid":
    case "holding_price_invalid":
    case "holding_purchase_date_invalid":
      return "The prepared CSV contains an invalid holding.";
    default:
      return "The Trading 212 holdings import could not be committed.";
  }
}

function result(
  data: CsvMutationRow[] | null,
  error: { message: string } | null,
): PortfolioCsvMutationResult {
  if (error) return { success: false, error: customerCsvMutationError(error.message) };
  const row = data?.[0];
  if (!row) {
    return { success: false, error: "The import returned no committed result." };
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

export async function createTrading212PortfolioAtomically(
  supabase: SupabaseClient<Database>,
  input: { name: string; holdings: PreparedTrading212Holding[] },
) {
  const { data, error } = await supabase.rpc("create_trading212_portfolio", {
    p_name: input.name,
    p_holdings: input.holdings,
  });
  return result(data, error);
}

export async function replacePortfolioHoldingsFromTrading212Atomically(
  supabase: SupabaseClient<Database>,
  input: { portfolioId: string; holdings: PreparedTrading212Holding[] },
) {
  const { data, error } = await supabase.rpc(
    "replace_portfolio_holdings_from_trading212",
    {
      p_portfolio_id: input.portfolioId,
      p_holdings: input.holdings,
    },
  );
  return result(data, error);
}
