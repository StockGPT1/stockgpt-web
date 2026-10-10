import assert from "node:assert/strict";
import type { Database } from "../lib/database.types";
import { assessConnectedPortfolioFacts, type ConnectedPortfolioFacts } from "../lib/connected-portfolio-intelligence-map";
import { deriveBrokerConnectionPresentation } from "../lib/brokerage/connection-presentation-state";
import { buildAllInvestmentsFromSources } from "../lib/all-investments";
import { buildAskConnectedPortfolioContext, buildAskAllInvestmentsContext, ASK_STOCKGPT_SYSTEM_PROMPT } from "../lib/ask-stockgpt-portfolio-context";
import { loadBrokerPositionAliasesSafely } from "../lib/instruments/broker-position-identity";

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

const failedLastGood = assessConnectedPortfolioFacts(facts(), asOf);
const retryableFailure = deriveBrokerConnectionPresentation({ lifecycleStatus: "active", latestSyncJobStatus: "retryable_failure", lastSuccessfulSyncAt: asOf });
assert.equal(retryableFailure.state, "stale_error");
assert.equal(failedLastGood.totalValueUsd, 250, "Sync failure presentation must not erase last-good positions or cash");
assert.equal(failedLastGood.positions[0].currentValueUsd, 200, "Sync failure presentation must preserve last-good position value");
assert.equal(failedLastGood.cashValueUsd, 50, "Sync failure presentation must preserve last-good cash");

const pending = assessConnectedPortfolioFacts(facts({ account: { id: "account-1", name: "Broker account", status: "active", base_currency: "USD", last_successful_sync_at: null, connection_id: "connection-1" }, cashBalances: [] }), asOf);
assert.equal(pending.cashValueUsd, null);
assert.equal(pending.totalValueUsd, null);
assert.equal(pending.intelligence.statusLabel, "Analysis limited");

assert.equal(complete.input.holdings[0].events?.length, 0);
assert.equal(complete.input.holdings[0].unrealisedPnlPct, null);
const fixtureFacts = facts({ identities: { "position-1": { instrumentId: "instrument-1", provenance: "sandbox_fixture" } } });
const fixtureResult = assessConnectedPortfolioFacts(fixtureFacts, asOf);
assert.equal(fixtureResult.totalValueUsd, complete.totalValueUsd);
assert.equal(fixtureResult.cashValueUsd, complete.cashValueUsd);
for (const key of ["quantity", "currentPriceUsd", "currentValueUsd", "sourceCurrency", "asOf"] as const) {
  assert.equal(fixtureResult.positions[0][key], complete.positions[0][key], `Fixture identity must not alter ${key}`);
}
assert.equal(fixtureResult.input.holdings[0].ranking, null, "Synthetic rankings must not enter customer assessment");
assert.equal(fixtureResult.input.holdings[0].diagnostics, null);
assert.equal(fixtureResult.input.holdings[0].coverage, "tracked_only");
assert.equal(fixtureResult.intelligence.status, null);
assert(fixtureResult.intelligence.summary.includes("synthetic test data"));
assert(fixtureResult.positions[0].testDataLabel?.includes("not a market assessment"));
const duplicates = assessConnectedPortfolioFacts(facts({ positions: [position(), position({ id: "position-2", instrument_id: null, asset_type: "crypto" })] }), asOf);
assert.equal(duplicates.positions.length, 2);
assert.equal(duplicates.totalValueUsd, 450, "Unsupported/duplicate ticker positions must retain independent valuations");
assert.notEqual(duplicates.input.holdings[0].instrumentKey, duplicates.input.holdings[1].instrumentKey);
const before = JSON.stringify(fixtureFacts);
assessConnectedPortfolioFacts(fixtureFacts, asOf);
assert.equal(JSON.stringify(fixtureFacts), before);
const aggregate = buildAllInvestmentsFromSources([complete, fixtureResult].map((result, index) => ({
  id: `synthetic-source-${index}`, name: "Synthetic test source", source: "connected" as const,
  availability: "ready" as const, valueUsd: result.totalValueUsd, cashUsd: result.cashValueUsd,
  holdingCount: result.positions.length, holdings: result.input.holdings, limitations: result.adapterLimitations,
  holdingIdentities: result.holdingIdentities,
})), asOf);
assert.equal(aggregate.totalValueUsd, 500);
assert.equal(aggregate.cashValueUsd, 100);
assert.equal(aggregate.input.holdings.length, 2);
assert.equal(aggregate.intelligence.status, null);
assert(aggregate.intelligence.summary.includes("synthetic test data"));
const askFixture = buildAskConnectedPortfolioContext({ connected: fixtureResult, meta: { id: "portfolio-1", name: "Synthetic fixture", riskTolerance: "moderate", objective: "growth", timeHorizon: "long_term", createdAt: asOf } });
const assertFixtureContext = (holding: Pick<typeof askFixture.holdings[number], "identity_provenance" | "test_data_label" | "investment_research_available" | "current_rank" | "current_score" | "diagnostics_as_of" | "canonical_assessment">) => {
  assert.equal(holding.identity_provenance, "sandbox_fixture");
  assert(holding.test_data_label?.includes("not a market assessment"));
  assert.equal(holding.investment_research_available, false);
  assert.equal(holding.current_rank, null);
  assert.equal(holding.current_score, null);
  assert.equal(holding.diagnostics_as_of, null);
  assert.equal(holding.canonical_assessment.status, null);
  assert.deepEqual(holding.canonical_assessment.reasons, []);
};
assertFixtureContext(askFixture.holdings[0]);
const askAggregate = buildAskAllInvestmentsContext(aggregate);
assertFixtureContext(askAggregate.holdings[1]);
assert.equal(askAggregate.factual_summary.total_value, 500);
assert.equal(askAggregate.factual_summary.cash_balance, 100);
assert(ASK_STOCKGPT_SYSTEM_PROMPT.includes("synthetic test data, not verified investment research"));
const defensiveAggregate = buildAllInvestmentsFromSources([{
  id: "synthetic-fixture-source", name: "Synthetic fixture", source: "connected", availability: "ready",
  valueUsd: fixtureResult.totalValueUsd, cashUsd: fixtureResult.cashValueUsd, holdingCount: 1,
  holdings: complete.input.holdings, holdingIdentities: fixtureResult.holdingIdentities, limitations: [],
}], asOf);
assert.equal(defensiveAggregate.input.holdings[0].ranking, null);
assert.equal(defensiveAggregate.input.holdings[0].diagnostics, null);
assert.equal(defensiveAggregate.totalValueUsd, 250);
assert.equal(defensiveAggregate.cashValueUsd, 50);
assert.equal(defensiveAggregate.intelligence.status, null);
assertFixtureContext(buildAskAllInvestmentsContext(defensiveAggregate).holdings[0]);
const meta = { id: "portfolio-1", name: "Synthetic test", riskTolerance: "moderate", objective: "growth", timeHorizon: "long_term", createdAt: asOf };
const tracked = assessConnectedPortfolioFacts(facts({ rankings: [], diagnostics: [] }), asOf);
for (const [result, expected] of [[complete, true], [unmapped, false], [tracked, false], [fixtureResult, false]] as const) {
  // Portfolio-level readiness alone must never establish research coverage.
  const ready = { ...result, intelligence: { ...result.intelligence, availability: "ready" as const } };
  assert.equal(buildAskConnectedPortfolioContext({ connected: ready, meta }).holdings[0].investment_research_available, expected);
  const source = buildAllInvestmentsFromSources([{ id: "s", name: "Test", source: "connected", availability: "ready", valueUsd: result.totalValueUsd, cashUsd: result.cashValueUsd, holdingCount: 1, holdings: result.input.holdings, holdingIdentities: result.holdingIdentities, limitations: [] }], asOf);
  source.intelligence.availability = "ready";
  assert.equal(buildAskAllInvestmentsContext(source).holdings[0].investment_research_available, expected);
}
const sharedCanonical = assessConnectedPortfolioFacts(facts({
  positions: [position(), position({ id: "position-2", position_key: "position-2", market_value: 300 })],
  identities: { "position-1": { instrumentId: "instrument-1", provenance: "provider_alias" }, "position-2": { instrumentId: "instrument-1", provenance: "persisted" } },
}), asOf);
assert.equal(sharedCanonical.totalValueUsd, 550);
assert.equal(sharedCanonical.cashValueUsd, 50);
assert.equal(sharedCanonical.input.holdings.length, 2);
assert.equal(new Set(sharedCanonical.input.holdings.map((holding) => holding.instrumentKey)).size, 2);
assert.equal(Object.keys(sharedCanonical.holdingIdentities).length, 2);
assert.equal(sharedCanonical.holdingIdentities["broker-position:position-1"].identityProvenance, "provider_alias");
assert.equal(sharedCanonical.holdingIdentities["broker-position:position-2"].identityProvenance, "persisted");
for (const holding of sharedCanonical.input.holdings) {
  assert.equal(sharedCanonical.holdingIdentities[holding.instrumentKey].instrumentId, "instrument-1");
  assert.equal(sharedCanonical.intelligence.holdingAssessments[holding.instrumentKey].instrumentKey, holding.instrumentKey);
}
const sharedAggregate = buildAllInvestmentsFromSources([{ id: "s", name: "Test", source: "connected", availability: "ready", valueUsd: 550, cashUsd: 50, holdingCount: 2, holdings: sharedCanonical.input.holdings, holdingIdentities: sharedCanonical.holdingIdentities, limitations: [] }], asOf);
assert.equal(sharedAggregate.totalValueUsd, 550);
assert.equal(sharedAggregate.input.holdings.length, 2);
assert.equal(Object.keys(sharedAggregate.holdingIdentities).length, 2);
assert.deepEqual(buildAskConnectedPortfolioContext({ connected: sharedCanonical, meta }).holdings.map((holding) => holding.identity_provenance), ["provider_alias", "persisted"]);
assert.deepEqual(buildAskAllInvestmentsContext(sharedAggregate).holdings.map((holding) => holding.instrument_id), ["instrument-1", "instrument-1"]);
const sharedFixture = assessConnectedPortfolioFacts(facts({
  positions: [position(), position({ id: "position-2", position_key: "position-2", market_value: 300 })],
  identities: { "position-1": { instrumentId: "instrument-1", provenance: "provider_alias" }, "position-2": { instrumentId: "instrument-1", provenance: "sandbox_fixture" } },
}), asOf);
assert.equal(sharedFixture.totalValueUsd, 550);
assert.equal(sharedFixture.holdingIdentities["broker-position:position-1"].identityProvenance, "provider_alias");
assertFixtureContext(buildAskConnectedPortfolioContext({ connected: sharedFixture, meta }).holdings[1]);
assert.equal(sharedFixture.input.holdings[0].ranking?.currentRank, 10);
assert.equal(sharedFixture.input.holdings[1].ranking, null);
for (const ranking of [
  { instrument_id: "instrument-1", ticker: "AAA", score: null, rank: 10, last_ranking_update: asOf },
  { instrument_id: "instrument-1", ticker: "AAA", score: 8000, rank: 0, last_ranking_update: asOf },
  { instrument_id: "instrument-1", ticker: "AAA", score: 8000, rank: 10, last_ranking_update: null },
]) {
  const insufficient = assessConnectedPortfolioFacts(facts({ rankings: [ranking] }), asOf);
  insufficient.intelligence.availability = "ready";
  assert.equal(buildAskConnectedPortfolioContext({ connected: insufficient, meta }).holdings[0].investment_research_available, false);
}
async function verifyIdentityFailureIsolation() {
  const aliases = await loadBrokerPositionAliasesSafely("example", ["provider-1"], async () => { throw new Error("synthetic infrastructure failure"); });
  assert.equal(aliases.available, false);
  const preserved = assessConnectedPortfolioFacts(facts({ identities: { "position-1": { instrumentId: null, provenance: "unresolved" } }, identityEvidenceUnavailable: true, rankings: [], diagnostics: [] }), asOf);
  assert.equal(preserved.positions.length, 1);
  assert.equal(preserved.positions[0].currentValueUsd, 200);
  assert.equal(preserved.cashValueUsd, 50);
  assert.equal(preserved.totalValueUsd, 250);
  assert.equal(preserved.input.holdings[0].ranking, null);
  assert.equal(preserved.intelligence.availability, "limited");
  assert(preserved.adapterLimitations.includes("connected_analysis_identity_unavailable"));
  assert.equal(buildAskConnectedPortfolioContext({ connected: preserved, meta }).holdings[0].investment_research_available, false);
}
void verifyIdentityFailureIsolation();
console.log("Connected Portfolio valuation, coverage, unknown-cash, multi-currency and canonical intelligence checks passed.");
