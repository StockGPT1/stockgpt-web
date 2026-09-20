import assert from "node:assert/strict";
import type { Database } from "../lib/database.types";
import { assessConnectedPortfolioFacts, type ConnectedPortfolioFacts } from "../lib/connected-portfolio-intelligence-map";

const asOf = "2026-01-15T12:00:00Z";
const userId = "11111111-1111-4111-8111-111111111111";
const quote = {
  rates: { USD: 1, GBP: 0.8, EUR: 0.9, CHF: 0.85 },
  sources: { USD: "usd_identity", GBP: "fetched_current", EUR: "display_fallback", CHF: "display_fallback" },
} as const;
type Position = Database["public"]["Tables"]["broker_positions"]["Row"];
type Cash = Database["public"]["Tables"]["broker_cash_balances"]["Row"];

function position(overrides: Partial<Position> = {}): Position {
  return { id: "position-1", user_id: userId, account_id: "account-1", position_key: "position-1", external_position_id: "external-1", external_instrument_id: "provider-1", instrument_id: "instrument-1", symbol: "AAA", description: "AAA Corp", asset_type: "equity", quantity: 2, price: 100, price_currency: "USD", market_value: 200, market_value_currency: "USD", as_of: asOf, created_at: asOf, updated_at: asOf, ...overrides };
}
function cash(overrides: Partial<Cash> = {}): Cash {
  return { id: "cash-1", user_id: userId, account_id: "account-1", currency: "USD", amount: 50, as_of: asOf, created_at: asOf, updated_at: asOf, ...overrides };
}
function facts(overrides: Partial<ConnectedPortfolioFacts> = {}): ConnectedPortfolioFacts {
  return {
    portfolio: { id: "portfolio-1", broker_account_id: "account-1", risk_tolerance: "moderate", objective: "growth", time_horizon: "long_term" },
    account: { id: "account-1", name: "Broker account", status: "active", base_currency: "USD", last_successful_sync_at: asOf, connection_id: "connection-1" },
    connection: { id: "connection-1", status: "active", last_successful_sync_at: asOf },
    positions: [position()], cashBalances: [cash()],
    rankings: [{ instrument_id: "instrument-1", ticker: "AAA", score: 8000, rank: 10, last_ranking_update: asOf }],
    diagnostics: [{ ticker: "AAA", current_score: 8000, previous_score: 8000, updated_at: asOf }],
    rankedUniverseSize: 500, fxQuote: quote,
    ...overrides,
  };
}

const complete = assessConnectedPortfolioFacts(facts(), asOf);
assert.equal(complete.totalValueUsd, 250);
assert.equal(complete.cashValueUsd, 50);
assert.equal(complete.input.holdings[0].provenance, "broker");
assert.equal(complete.input.holdings[0].costBasis, null);
assert.equal(complete.input.holdings[0].coverage, "ranked");
assert.equal(complete.adapterLimitations.includes("canonical_event_severity_source_unmapped"), true);
assert(["on_track", "monitor", "review", "urgent_review"].includes(complete.assessment.portfolio.status));

const unmapped = assessConnectedPortfolioFacts(facts({ positions: [position({ instrument_id: null, symbol: "ZZZ" })], rankings: [], diagnostics: [] }), asOf);
assert.equal(unmapped.positions[0].ticker, "ZZZ");
assert.equal(unmapped.input.holdings[0].coverage, "unsupported");
assert.equal(unmapped.input.holdings[0].ranking, null);

const unknownPrice = assessConnectedPortfolioFacts(facts({ positions: [position({ price: null, price_currency: null, market_value: null, market_value_currency: null })] }), asOf);
assert.equal(unknownPrice.totalValueUsd, null);
assert.equal(unknownPrice.positions[0].currentValueUsd, null);
assert.equal(unknownPrice.input.holdings[0].currentValue, null);
assert.equal(unknownPrice.intelligence.statusLabel, "Analysis limited");

const unresolvedCash = assessConnectedPortfolioFacts(facts({ cashBalances: [cash({ currency: "JPY", amount: 1000 })] }), asOf);
assert.equal(unresolvedCash.cashValueUsd, null);
assert.equal(unresolvedCash.totalValueUsd, null);
assert.equal(unresolvedCash.input.holdings[0].currentValue, null, "Unknown cash must suppress concentration arithmetic");
assert(unresolvedCash.adapterLimitations.includes("connected_analysis_cash_unresolved"));

const multiCurrency = assessConnectedPortfolioFacts(facts({ cashBalances: [cash(), cash({ id: "cash-2", currency: "GBP", amount: 80 })] }), asOf);
assert.equal(multiCurrency.cashValueUsd, 150);
assert.equal(multiCurrency.totalValueUsd, 350);

const disconnected = assessConnectedPortfolioFacts(facts({ connection: { id: "connection-1", status: "disconnected", last_successful_sync_at: asOf } }), asOf);
assert.equal(disconnected.totalValueUsd, complete.totalValueUsd, "Disconnected state discarded last-good normalized facts");

const pending = assessConnectedPortfolioFacts(facts({ account: { id: "account-1", name: "Broker account", status: "active", base_currency: "USD", last_successful_sync_at: null, connection_id: "connection-1" }, cashBalances: [] }), asOf);
assert.equal(pending.cashValueUsd, null);
assert.equal(pending.totalValueUsd, null);
assert.equal(pending.intelligence.statusLabel, "Analysis limited");

assert.equal(complete.input.holdings[0].events?.length, 0);
assert.equal(complete.input.holdings[0].unrealisedPnlPct, null);
console.log("Connected Portfolio valuation, coverage, unknown-cash, multi-currency and canonical intelligence checks passed.");
