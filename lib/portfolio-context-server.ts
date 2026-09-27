import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  resolvePortfolioContext,
  type PortfolioContextOption,
  type PortfolioContextSelection,
} from "@/lib/portfolio-context";

export async function resolveOwnedPortfolioContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  explicit: string | null | undefined,
  portfolios: PortfolioContextOption[],
) {
  const { data, error } = await supabase
    .from("portfolio_context_preferences")
    .select("context_kind,portfolio_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Portfolio context preference could not be loaded");
  const saved: PortfolioContextSelection | null = data?.context_kind === "all_investments"
    ? { kind: "all_investments", portfolioId: null }
    : data?.context_kind === "portfolio" && data.portfolio_id
      ? { kind: "portfolio", portfolioId: data.portfolio_id }
      : null;
  return resolvePortfolioContext({ explicit, saved, portfolios });
}
