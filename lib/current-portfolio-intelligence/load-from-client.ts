import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { assessCurrentPortfolioIntelligenceFacts } from "./map-current-facts";
import type {
  CurrentPortfolioIntelligenceLoadResult,
  CurrentPortfolioIntelligenceFacts,
} from "./types";

type CurrentPortfolioClient = SupabaseClient<Database>;

function readFailure(operation: string, message: string) {
  return new Error(`[current-portfolio-intelligence] ${operation} failed: ${message}`);
}

export async function loadCurrentPortfolioIntelligenceFromClient({
  supabase,
  userId,
  portfolioId,
  asOf,
}: {
  supabase: CurrentPortfolioClient;
  userId: string;
  portfolioId?: string | null;
  asOf: string;
}): Promise<CurrentPortfolioIntelligenceLoadResult> {
  let portfolioQuery = supabase
    .from("user_portfolios")
    .select(
      "id,risk_tolerance,objective,time_horizon,cash_balance,currency",
    )
    .eq("user_id", userId)
    .is("archived_at", null);

  if (portfolioId) portfolioQuery = portfolioQuery.eq("id", portfolioId);

  const { data: portfolio, error: portfolioError } = await portfolioQuery
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (portfolioError) {
    throw readFailure("portfolio read", portfolioError.message);
  }
  if (!portfolio) {
    return {
      status: "not_found",
      input: null,
      assessment: null,
      adapterLimitations: ["owned_portfolio_not_found"],
    };
  }

  const { data: holdings, error: holdingsError } = await supabase
    .from("portfolio_holdings")
    .select(
      "id,portfolio_id,ticker,shares,entry_price,score_at_entry,rank_at_entry,allocation_pct,source,risk_level_at_entry,target_level_at_entry",
    )
    .eq("portfolio_id", portfolio.id)
    .order("ticker", { ascending: true })
    .order("id", { ascending: true });

  if (holdingsError) {
    throw readFailure("holdings read", holdingsError.message);
  }

  const tickers = [
    ...new Set(
      (holdings ?? [])
        .map((holding) => holding.ticker.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];

  let rankings: CurrentPortfolioIntelligenceFacts["rankings"] = [];
  let diagnostics: CurrentPortfolioIntelligenceFacts["diagnostics"] = [];
  let rankingUniverseSize: number | null = null;

  if (tickers.length > 0) {
    const [rankingResult, diagnosticsResult, universeResult] = await Promise.all([
      supabase
        .from("stock_rankings")
        .select(
          "ticker,score,rank,price,last_price_update,last_ranking_update",
        )
        .in("ticker", tickers)
        .order("ticker", { ascending: true }),
      supabase
        .from("stock_factor_diagnostics")
        .select("ticker,current_score,previous_score,updated_at")
        .in("ticker", tickers)
        .order("ticker", { ascending: true }),
      supabase
        .from("stock_rankings")
        .select("rank", { count: "exact", head: true })
        .not("rank", "is", null),
    ]);

    if (rankingResult.error) {
      throw readFailure("rankings read", rankingResult.error.message);
    }
    if (diagnosticsResult.error) {
      throw readFailure("diagnostics read", diagnosticsResult.error.message);
    }
    if (universeResult.error) {
      throw readFailure("ranking universe count", universeResult.error.message);
    }

    rankings = rankingResult.data ?? [];
    diagnostics = diagnosticsResult.data ?? [];
    rankingUniverseSize = universeResult.count;
  }

  return assessCurrentPortfolioIntelligenceFacts(
    {
      portfolio,
      holdings: holdings ?? [],
      rankings,
      diagnostics,
      rankingUniverseSize,
    },
    asOf,
  );
}
