import type { Database } from "@/lib/database.types";
import type { UsdFxQuote } from "@/lib/currency";
import { convertCurrencyToUsdForWrite, SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/currency";
import { assessPortfolioIntelligence, type HoldingIntelligenceInput, type PortfolioIntelligenceInput } from "@/lib/portfolio-intelligence";
import { buildPortfolioIntelligenceView } from "@/lib/portfolio-intelligence-presentation";

type PositionFact = Database["public"]["Tables"]["broker_positions"]["Row"];
type CashFact = Database["public"]["Tables"]["broker_cash_balances"]["Row"];
type RankingFact = Pick<Database["public"]["Tables"]["stock_rankings"]["Row"], "instrument_id" | "ticker" | "score" | "rank" | "last_ranking_update">;
type DiagnosticFact = Pick<Database["public"]["Tables"]["stock_factor_diagnostics"]["Row"], "ticker" | "current_score" | "previous_score" | "updated_at">;

export type ConnectedPortfolioFacts = {
  portfolio: Pick<Database["public"]["Tables"]["user_portfolios"]["Row"], "id" | "risk_tolerance" | "objective" | "time_horizon" | "broker_account_id">;
  account: Pick<Database["public"]["Tables"]["broker_accounts"]["Row"], "id" | "name" | "status" | "base_currency" | "last_successful_sync_at" | "connection_id">;
  connection: Pick<Database["public"]["Tables"]["broker_connections"]["Row"], "id" | "status" | "last_successful_sync_at">;
  positions: PositionFact[]; cashBalances: CashFact[]; rankings: RankingFact[]; diagnostics: DiagnosticFact[];
  rankedUniverseSize: number; fxQuote: UsdFxQuote;
};

const finite = (value: unknown) => { const number = Number(value); return Number.isFinite(number) ? number : null; };
function currency(value: string | null) { const normalized = String(value ?? "").toUpperCase(); return SUPPORTED_CURRENCIES.includes(normalized as SupportedCurrency) ? normalized as SupportedCurrency : null; }
function usd(value: number | null, code: string | null, quote: UsdFxQuote) { const supported = currency(code); return value == null || !supported ? null : convertCurrencyToUsdForWrite(value, supported, quote); }

export function assessConnectedPortfolioFacts(facts: ConnectedPortfolioFacts, asOf: string) {
  const limitations = ["canonical_event_severity_source_unmapped"];
  const rankingByInstrument = new Map(facts.rankings.filter((row) => row.instrument_id).map((row) => [row.instrument_id!, row]));
  const diagnosticByTicker = new Map(facts.diagnostics.map((row) => [row.ticker, row]));
  const mapped = facts.positions.map((position) => {
    const quantity = finite(position.quantity);
    const providerValue = usd(finite(position.market_value), position.market_value_currency, facts.fxQuote);
    const providerPrice = usd(finite(position.price), position.price_currency, facts.fxQuote);
    const derivedValue = quantity != null && providerPrice != null ? quantity * providerPrice : null;
    const currentValue = providerValue ?? derivedValue;
    const ranking = position.instrument_id ? rankingByInstrument.get(position.instrument_id) : undefined;
    const diagnostic = ranking?.ticker ? diagnosticByTicker.get(ranking.ticker) : undefined;
    return { position, quantity, providerPrice, currentValue: currentValue != null && currentValue >= 0 ? currentValue : null, ranking, diagnostic };
  });
  const cashKnown = facts.account.last_successful_sync_at != null;
  const cashValues = facts.cashBalances.map((row) => usd(finite(row.amount), row.currency, facts.fxQuote));
  const cashComplete = cashKnown && cashValues.every((value) => value != null);
  const valuationComplete = cashComplete && mapped.every((row) => row.currentValue != null);
  if (!cashKnown) limitations.push("connected_analysis_sync_pending");
  if (!cashComplete) limitations.push("connected_analysis_cash_unresolved");
  if (!valuationComplete) limitations.push("connected_analysis_valuation_incomplete");
  const holdings: HoldingIntelligenceInput[] = mapped.map(({ position, quantity, providerPrice, currentValue, ranking, diagnostic }) => ({
    instrumentKey: position.instrument_id ?? `broker-position:${position.id}`, ticker: ranking?.ticker ?? position.symbol,
    coverage: ranking ? "ranked" : "unsupported", provenance: "broker", currentValue: valuationComplete ? currentValue : null,
    costBasis: null, shares: quantity, unrealisedPnlPct: null,
    market: { currentPrice: providerPrice, savedRiskLevel: null, priceAsOf: position.as_of },
    ranking: ranking ? { currentScore: finite(ranking.score), scoreAtEntry: null, currentRank: finite(ranking.rank), rankAtEntry: null, universeSize: facts.rankedUniverseSize, asOf: ranking.last_ranking_update } : null,
    diagnostics: diagnostic ? { currentScore: finite(diagnostic.current_score), previousScore: finite(diagnostic.previous_score), asOf: diagnostic.updated_at } : null,
    events: [],
  }));
  const input: PortfolioIntelligenceInput = { asOf, portfolio: { id: facts.portfolio.id, riskTolerance: facts.portfolio.risk_tolerance, objective: facts.portfolio.objective, timeHorizon: facts.portfolio.time_horizon, cashValue: cashComplete ? cashValues.reduce((sum, value) => sum + (value ?? 0), 0) : 0 }, holdings };
  const assessment = assessPortfolioIntelligence(input);
  return {
    input, assessment, intelligence: buildPortfolioIntelligenceView({ result: assessment, adapterLimitations: limitations }), adapterLimitations: limitations,
    connectionStatus: facts.connection.status,
    positions: mapped.map(({ position, quantity, providerPrice, currentValue, ranking }) => ({ id: position.id, instrumentId: position.instrument_id, ticker: ranking?.ticker ?? position.symbol, description: position.description, quantity, currentPriceUsd: providerPrice, currentValueUsd: currentValue, sourceCurrency: position.market_value_currency ?? position.price_currency, asOf: position.as_of })),
    cashValueUsd: cashComplete ? cashValues.reduce((sum, value) => sum + (value ?? 0), 0) : null,
    totalValueUsd: valuationComplete ? mapped.reduce((sum, row) => sum + (row.currentValue ?? 0), 0) + cashValues.reduce((sum, value) => sum + (value ?? 0), 0) : null,
  };
}
