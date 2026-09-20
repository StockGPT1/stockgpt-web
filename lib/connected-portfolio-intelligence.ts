import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getUsdFxQuote } from "@/lib/fx-rates";
import { assessConnectedPortfolioFacts } from "@/lib/connected-portfolio-intelligence-map";
export { assessConnectedPortfolioFacts } from "@/lib/connected-portfolio-intelligence-map";
export type { ConnectedPortfolioFacts } from "@/lib/connected-portfolio-intelligence-map";

export async function loadConnectedPortfolioIntelligence(
  supabase: SupabaseClient<Database>, portfolioId: string, asOf: string,
) {
  const portfolio = await supabase.from("user_portfolios")
    .select("id,risk_tolerance,objective,time_horizon,broker_account_id,management_source")
    .eq("id", portfolioId).eq("management_source", "connected").maybeSingle();
  if (portfolio.error || !portfolio.data?.broker_account_id) return null;
  const account = await supabase.from("broker_accounts")
    .select("id,name,status,base_currency,last_successful_sync_at,connection_id")
    .eq("id", portfolio.data.broker_account_id).maybeSingle();
  if (account.error || !account.data) return null;
  const [connection, positions, cash, universe] = await Promise.all([
    supabase.from("broker_connections").select("id,status,last_successful_sync_at").eq("id", account.data.connection_id).single(),
    supabase.from("broker_positions").select("*").eq("account_id", account.data.id).order("position_key"),
    supabase.from("broker_cash_balances").select("*").eq("account_id", account.data.id).order("currency"),
    supabase.from("stock_rankings").select("rank", { count: "exact", head: true }).not("rank", "is", null),
  ]);
  if (connection.error || positions.error || cash.error || universe.error || !connection.data) throw new Error("Connected Portfolio facts unavailable");
  const instrumentIds = [...new Set((positions.data ?? []).map((row) => row.instrument_id).filter((id): id is string => Boolean(id)))];
  const rankings = instrumentIds.length ? await supabase.from("stock_rankings")
    .select("instrument_id,ticker,score,rank,last_ranking_update").in("instrument_id", instrumentIds) : { data: [], error: null };
  if (rankings.error) throw new Error("Connected Portfolio rankings unavailable");
  const tickers = (rankings.data ?? []).map((row) => row.ticker).filter((ticker): ticker is string => Boolean(ticker));
  const diagnostics = tickers.length ? await supabase.from("stock_factor_diagnostics")
    .select("ticker,current_score,previous_score,updated_at").in("ticker", tickers) : { data: [], error: null };
  if (diagnostics.error) throw new Error("Connected Portfolio diagnostics unavailable");
  return assessConnectedPortfolioFacts({
    portfolio: portfolio.data, account: account.data, connection: connection.data,
    positions: positions.data ?? [], cashBalances: cash.data ?? [], rankings: rankings.data ?? [],
    diagnostics: diagnostics.data ?? [], rankedUniverseSize: universe.count ?? 0,
    fxQuote: await getUsdFxQuote(),
  }, asOf);
}
