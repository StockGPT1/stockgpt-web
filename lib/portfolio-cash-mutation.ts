import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type PortfolioCashOperation = "deposit" | "withdrawal";

export type PortfolioCashMutation = {
  portfolioId: string;
  transactionId: string;
  operation: PortfolioCashOperation;
  amount: number;
  cashBalance: number;
  cashDepositedTotal: number;
  occurredAt: string;
  createdAt: string;
};

export type PortfolioCashMutationResult =
  | { success: true; data: PortfolioCashMutation }
  | { success: false; error: string };

function customerCashError(message: string) {
  switch (message) {
    case "not_authenticated":
      return "not_authenticated";
    case "portfolio_id_required":
    case "portfolio_not_found":
      return "Portfolio not found.";
    case "cash_amount_invalid":
      return "Enter a positive cash amount.";
    case "cash_operation_invalid":
      return "That cash action is not supported.";
    case "insufficient_cash":
      return "This portfolio does not have enough available cash for that withdrawal.";
    case "portfolio_currency_unsupported":
      return "Cash changes are temporarily limited to USD portfolios while legacy currency balances are reconciled.";
    case "portfolio_cash_state_invalid":
      return "This portfolio's cash balance requires review before another cash change.";
    default:
      return "The cash change could not be saved. Refresh the portfolio before trying again.";
  }
}

export async function mutatePortfolioCash(
  supabase: SupabaseClient<Database>,
  input: {
    portfolioId: string;
    operation: PortfolioCashOperation;
    amount: number;
  },
): Promise<PortfolioCashMutationResult> {
  const { data, error } = await supabase.rpc("mutate_portfolio_cash", {
    p_portfolio_id: input.portfolioId,
    p_operation: input.operation,
    p_amount: input.amount,
  });

  if (error) {
    return { success: false, error: customerCashError(error.message) };
  }

  const row = data?.[0];
  if (!row) {
    return {
      success: false,
      error: "The cash change returned no committed result. Refresh the portfolio before trying again.",
    };
  }

  return {
    success: true,
    data: {
      portfolioId: row.portfolio_id,
      transactionId: row.transaction_id,
      operation: row.operation as PortfolioCashOperation,
      amount: Number(row.amount),
      cashBalance: Number(row.cash_balance),
      cashDepositedTotal: Number(row.cash_deposited_total),
      occurredAt: row.occurred_at,
      createdAt: row.created_at,
    },
  };
}
