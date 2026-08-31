import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  mapTrading212Positions,
  parseTrading212Csv,
  trading212TickerCandidates,
  type Trading212MappedHolding,
} from "@/lib/trading212-csv";

export type PreparedTrading212Holding = Trading212MappedHolding;

export type PreparedTrading212Import =
  | {
      accepted: true;
      holdings: PreparedTrading212Holding[];
      matchedTickers: string[];
      totalBasis: number;
      ignoredNonInvestmentRows: number;
      investmentRows: number;
    }
  | {
      accepted: false;
      issues: string[];
      unsupportedTickers: string[];
      ignoredNonInvestmentRows: number;
      investmentRows: number;
    };

type RankingRow = {
  ticker: string | null;
  score: number | null;
  rank: number | null;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function trading212RefusalMessage(
  result: Extract<PreparedTrading212Import, { accepted: false }>,
) {
  if (result.unsupportedTickers.length > 0) {
    return `Import refused because these open investment positions are not safely supported: ${result.unsupportedTickers.join(", ")}. No holdings were changed.`;
  }
  return `${result.issues.slice(0, 4).join(" ")} No holdings were changed.`;
}

export async function prepareTrading212Import(
  supabase: SupabaseClient<Database>,
  csvText: string,
): Promise<PreparedTrading212Import> {
  const parsed = parseTrading212Csv(csvText);
  if (!parsed.accepted) {
    return {
      accepted: false,
      issues: parsed.issues,
      unsupportedTickers: [],
      ignoredNonInvestmentRows: parsed.ignoredNonInvestmentRows,
      investmentRows: parsed.investmentRows,
    };
  }

  const queryTickers = Array.from(
    new Set(parsed.positions.flatMap((position) => trading212TickerCandidates(position.sourceTicker))),
  );
  const { data, error } = await supabase
    .from("stock_rankings")
    .select("ticker,score,rank")
    .in("ticker", queryTickers);
  if (error) throw new Error("Could not validate CSV instruments against StockGPT rankings.");

  const mapped = mapTrading212Positions(
    parsed.positions,
    ((data ?? []) as RankingRow[]).flatMap((row) =>
      row.ticker
        ? [{ ticker: row.ticker, score: row.score, rank: row.rank }]
        : [],
    ),
  );
  if (!mapped.accepted) {
    return {
      accepted: false,
      issues: mapped.issues,
      unsupportedTickers: mapped.unsupportedTickers,
      ignoredNonInvestmentRows: parsed.ignoredNonInvestmentRows,
      investmentRows: parsed.investmentRows,
    };
  }
  if (mapped.holdings.length === 0) {
    return {
      accepted: false,
      issues: ["The CSV does not contain an open supported investment holding."],
      unsupportedTickers: [],
      ignoredNonInvestmentRows: parsed.ignoredNonInvestmentRows,
      investmentRows: parsed.investmentRows,
    };
  }

  return {
    accepted: true,
    holdings: mapped.holdings,
    matchedTickers: mapped.holdings.map((holding) => holding.ticker),
    totalBasis: roundMoney(
      mapped.holdings.reduce(
        (sum, holding) => sum + holding.shares * holding.entry_price,
        0,
      ),
    ),
    ignoredNonInvestmentRows: parsed.ignoredNonInvestmentRows,
    investmentRows: parsed.investmentRows,
  };
}
