"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { invalidatePortfolioPageSnapshot } from "@/lib/portfolio-speed-cache";

export type PortfolioCashActionResult = {
  success: boolean;
  error?: string;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function withdrawPortfolioCash({
  portfolioId,
  amount,
}: {
  portfolioId: string;
  amount: number;
}): Promise<PortfolioCashActionResult> {
  if (!portfolioId) return { success: false, error: "Choose a portfolio." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Enter a positive withdrawal amount." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "not_authenticated" };

  const { data: portfolio, error: portfolioError } = await supabase
    .from("user_portfolios")
    .select("id,cash_balance,cash_deposited_total,currency")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (portfolioError) return { success: false, error: portfolioError.message };
  if (!portfolio) return { success: false, error: "Portfolio not found." };

  const currentCash = Number(portfolio.cash_balance ?? 0);
  const currentDeposited = Number(portfolio.cash_deposited_total ?? 0);
  if (!Number.isFinite(currentCash) || currentCash < 0) {
    return {
      success: false,
      error: "Cash balance is unavailable. Refresh and try again.",
    };
  }
  if (amount > currentCash + 0.001) {
    return {
      success: false,
      error: `You can withdraw up to ${roundMoney(currentCash).toFixed(2)} from this portfolio.`,
    };
  }

  const nextCash = roundMoney(Math.max(0, currentCash - amount));
  const nextDeposited = roundMoney(Math.max(0, currentDeposited - amount));
  const { data: updatedPortfolio, error: updateError } = await supabase
    .from("user_portfolios")
    .update({
      cash_balance: nextCash,
      cash_deposited_total: nextDeposited,
    })
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .eq("cash_balance", portfolio.cash_balance ?? 0)
    .select("id")
    .maybeSingle();

  if (updateError) return { success: false, error: updateError.message };
  if (!updatedPortfolio) {
    return {
      success: false,
      error: "The cash balance changed while this withdrawal was being saved. Refresh and try again.",
    };
  }

  const { error: transactionError } = await supabase
    .from("portfolio_transactions")
    .insert({
      portfolio_id: portfolioId,
      user_id: user.id,
      ticker: null,
      type: "withdrawal",
      shares: null,
      price: null,
      amount: roundMoney(amount),
      realised_pnl: null,
      currency: portfolio.currency ?? "USD",
      notes: "Cash withdrawn manually.",
    });

  if (transactionError) {
    // Restore only when the balance still matches this action's write. This avoids
    // overwriting a newer legitimate cash change if another action completed first.
    const { data: restoredPortfolio, error: rollbackError } = await supabase
      .from("user_portfolios")
      .update({
        cash_balance: roundMoney(currentCash),
        cash_deposited_total: roundMoney(currentDeposited),
      })
      .eq("id", portfolioId)
      .eq("user_id", user.id)
      .eq("cash_balance", nextCash)
      .select("id")
      .maybeSingle();

    if (rollbackError || !restoredPortfolio) {
      return {
        success: false,
        error:
          "The withdrawal record could not be completed and the balance requires review. Refresh the portfolio before making another cash change.",
      };
    }
    return { success: false, error: transactionError.message };
  }

  await invalidatePortfolioPageSnapshot({ portfolioId, ownerId: user.id });
  revalidatePath("/portfolio");
  revalidatePath(`/portfolio?portfolio=${portfolioId}`);
  return { success: true };
}
