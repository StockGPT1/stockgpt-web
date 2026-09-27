"use server";

import { createClient } from "@/utils/supabase/server";
import { ALL_INVESTMENTS_CONTEXT_ID } from "@/lib/portfolio-context";

export async function saveDefaultPortfolioContext(value: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sign in required." };
  const all = value === ALL_INVESTMENTS_CONTEXT_ID;
  const { error } = await supabase.rpc("set_default_portfolio_context", all
    ? { p_context_kind: "all_investments" }
    : { p_context_kind: "portfolio", p_portfolio_id: value });
  return error ? { success: false, error: "Default Portfolio could not be saved." } : { success: true };
}

export async function clearDefaultPortfolioContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sign in required." };
  const { error } = await supabase.rpc("clear_default_portfolio_context");
  return error ? { success: false, error: "Default Portfolio could not be cleared." } : { success: true };
}
