import { assessPortfolioIntelligence } from "@/lib/portfolio-intelligence";
import type {
  HoldingIntelligenceInput,
  HoldingProvenance,
  PortfolioIntelligenceInput,
} from "@/lib/portfolio-intelligence";
import type {
  CurrentDiagnosticFact,
  CurrentHoldingFact,
  CurrentPortfolioIntelligenceAdapterResult,
  CurrentPortfolioIntelligenceFacts,
  CurrentRankingFact,
} from "./types";

export const CURRENT_EVENT_LIMITATION =
  "canonical_event_severity_source_unmapped";

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function finiteNonNegative(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && number >= 0 ? number : null;
}

function finitePositive(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && number > 0 ? number : null;
}

function validTimestamp(value: string | null | undefined): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

function tickerKey(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

export function mapCurrentHoldingProvenance(
  source: string | null | undefined,
): HoldingProvenance {
  const normalized = String(source ?? "").trim().toLowerCase();
  if (normalized === "manual" || normalized === "manual_builder") {
    return "manual";
  }
  if (normalized === "trading212" || normalized === "import") return "csv";
  if (normalized === "broker" || normalized.startsWith("broker:")) {
    return "broker";
  }
  return "unknown";
}

function mapByTicker<T extends { ticker: string | null }>(rows: T[]) {
  const mapped = new Map<string, T>();
  for (const row of rows) {
    const ticker = tickerKey(row.ticker);
    if (ticker && !mapped.has(ticker)) mapped.set(ticker, row);
  }
  return mapped;
}

function normaliseUniverseSize(value: number | null): number | null {
  const count = finitePositive(value);
  return count !== null && Number.isInteger(count) && count >= 2 ? count : null;
}

function holdingLimit(
  limitations: Set<string>,
  instrumentKey: string,
  limitation: string,
) {
  limitations.add(`${instrumentKey}:${limitation}`);
}

function mapHolding({
  holding,
  ranking,
  diagnostic,
  universeSize,
  monetaryFactsCoherent,
  limitations,
}: {
  holding: CurrentHoldingFact;
  ranking: CurrentRankingFact | null;
  diagnostic: CurrentDiagnosticFact | null;
  universeSize: number | null;
  monetaryFactsCoherent: boolean;
  limitations: Set<string>;
}): HoldingIntelligenceInput {
  const ticker = tickerKey(holding.ticker);
  const instrumentKey = ticker || `holding:${holding.id}`;
  const shares = finiteNonNegative(holding.shares);
  const currentPrice = finitePositive(ranking?.price);
  const entryPrice = finiteNonNegative(holding.entry_price);
  const currentValue =
    monetaryFactsCoherent && shares !== null && currentPrice !== null
      ? shares * currentPrice
      : null;
  const costBasis =
    monetaryFactsCoherent && shares !== null && entryPrice !== null
      ? shares * entryPrice
      : null;
  const unrealisedPnlPct =
    monetaryFactsCoherent &&
    entryPrice !== null &&
    entryPrice > 0 &&
    currentPrice !== null
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : null;
  const priceAsOf = validTimestamp(ranking?.last_price_update);
  const rankingAsOf = validTimestamp(ranking?.last_ranking_update);
  const diagnosticAsOf = validTimestamp(diagnostic?.updated_at);

  if (shares === null) holdingLimit(limitations, instrumentKey, "shares_invalid");
  if (currentPrice === null) {
    holdingLimit(limitations, instrumentKey, "current_price_missing_or_invalid");
  } else if (priceAsOf === null) {
    holdingLimit(limitations, instrumentKey, "market_price_timestamp_missing");
  }
  if (entryPrice === null) {
    holdingLimit(limitations, instrumentKey, "entry_price_missing_or_invalid");
  }
  if (ranking && rankingAsOf === null) {
    holdingLimit(limitations, instrumentKey, "ranking_timestamp_missing");
  }
  if (diagnostic && diagnosticAsOf === null) {
    holdingLimit(limitations, instrumentKey, "diagnostics_timestamp_missing");
  }

  return {
    instrumentKey,
    ticker: ticker || null,
    coverage: ranking ? "ranked" : "unsupported",
    provenance: mapCurrentHoldingProvenance(holding.source),
    currentValue,
    costBasis,
    shares,
    unrealisedPnlPct,
    legacyReferenceAllocationPct: finiteNonNegative(holding.allocation_pct),
    market: {
      currentPrice,
      savedRiskLevel: monetaryFactsCoherent
        ? finitePositive(holding.risk_level_at_entry)
        : null,
      priceAsOf,
    },
    ranking: ranking
      ? {
          currentScore: finiteNumber(ranking.score),
          scoreAtEntry: finiteNumber(holding.score_at_entry),
          currentRank: finiteNumber(ranking.rank),
          rankAtEntry: finiteNumber(holding.rank_at_entry),
          universeSize,
          asOf: rankingAsOf,
        }
      : null,
    diagnostics: diagnostic
      ? {
          currentScore: finiteNumber(diagnostic.current_score),
          previousScore: finiteNumber(diagnostic.previous_score),
          asOf: diagnosticAsOf,
        }
      : null,
    events: [],
  };
}

export function buildCurrentPortfolioIntelligenceInput(
  facts: CurrentPortfolioIntelligenceFacts,
  asOf: string,
): { input: PortfolioIntelligenceInput; adapterLimitations: string[] } {
  const limitations = new Set<string>([CURRENT_EVENT_LIMITATION]);
  const universeSize = normaliseUniverseSize(facts.rankingUniverseSize);
  if (universeSize === null && facts.holdings.length > 0) {
    limitations.add("ranking_universe_unavailable");
  }
  const portfolioCurrency = facts.portfolio.currency.trim().toUpperCase();
  const monetaryFactsCoherent = portfolioCurrency === "USD";
  if (!monetaryFactsCoherent) {
    limitations.add(
      `portfolio_currency_basis_unresolved:${portfolioCurrency || "unknown"}`,
    );
  }

  const rankingByTicker = mapByTicker(facts.rankings);
  const diagnosticsByTicker = mapByTicker(facts.diagnostics);
  const holdings = [...facts.holdings]
    .sort(
      (left, right) =>
        tickerKey(left.ticker).localeCompare(tickerKey(right.ticker)) ||
        left.id.localeCompare(right.id),
    )
    .map((holding) => {
      const ticker = tickerKey(holding.ticker);
      return mapHolding({
        holding,
        ranking: rankingByTicker.get(ticker) ?? null,
        diagnostic: diagnosticsByTicker.get(ticker) ?? null,
        universeSize,
        monetaryFactsCoherent,
        limitations,
      });
    });

  const cashValue = monetaryFactsCoherent
    ? finiteNonNegative(facts.portfolio.cash_balance)
    : null;
  if (monetaryFactsCoherent && cashValue === null) {
    limitations.add("cash_value_invalid");
  }

  return {
    input: {
      asOf,
      portfolio: {
        id: facts.portfolio.id,
        riskTolerance: facts.portfolio.risk_tolerance,
        objective: facts.portfolio.objective,
        timeHorizon: facts.portfolio.time_horizon,
        cashValue: cashValue ?? 0,
      },
      holdings,
    },
    adapterLimitations: [...limitations].sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

export function assessCurrentPortfolioIntelligenceFacts(
  facts: CurrentPortfolioIntelligenceFacts,
  asOf: string,
): CurrentPortfolioIntelligenceAdapterResult {
  const mapped = buildCurrentPortfolioIntelligenceInput(facts, asOf);
  return {
    status: "ready",
    input: mapped.input,
    assessment: assessPortfolioIntelligence(mapped.input),
    adapterLimitations: mapped.adapterLimitations,
  };
}
