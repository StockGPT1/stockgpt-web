import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { minimizeAskAppContext, safeAiProviderFailure } from "../lib/ai/portfolio-context-policy";
import { SANDBOX_FIXTURE_LABEL } from "../lib/instruments/broker-position-identity";
import { assessConnectedPortfolioFacts, type ConnectedPortfolioFacts } from "../lib/connected-portfolio-intelligence-map";
import { buildAllInvestmentsFromSources } from "../lib/all-investments";
import { buildAskAllInvestmentsContext, buildAskConnectedPortfolioContext } from "../lib/ask-stockgpt-portfolio-context";

const asOf = "2026-10-21T12:00:00Z";
const owner = "11111111-1111-4111-8111-111111111111";
const canonicalId = "22222222-2222-4222-8222-222222222222";
const privateValue = "PRIVATE_FIXTURE_SENTINEL";
const facts: ConnectedPortfolioFacts = {
  portfolio: { id: "private-portfolio", broker_account_id: "private-account", risk_tolerance: "moderate", objective: "growth", time_horizon: "long_term" },
  account: { id: "private-account", connection_id: "private-connection", name: privateValue, status: "active", base_currency: "USD", last_successful_sync_at: asOf },
  connection: { id: "private-connection", status: "active", last_successful_sync_at: asOf },
  positions: [0, 1].map((index) => ({
    id: `private-position-${index}`, user_id: owner, account_id: "private-account", position_key: `private-position-${index}`,
    external_position_id: privateValue, external_instrument_id: privateValue, instrument_id: canonicalId,
    symbol: "AAA", description: privateValue, asset_type: "equity", quantity: 2, price: 100, price_currency: "USD",
    market_value: 200, market_value_currency: "USD", as_of: asOf, created_at: asOf, updated_at: asOf,
  })),
  cashBalances: [{ id: "private-cash", user_id: owner, account_id: "private-account", currency: "USD", amount: 50, as_of: asOf, created_at: asOf, updated_at: asOf }],
  rankings: [{ instrument_id: canonicalId, ticker: "AAA", score: 8000, rank: 10, last_ranking_update: asOf }],
  diagnostics: [], rankedUniverseSize: 500,
  fxQuote: { rates: { USD: 1, GBP: 0.8, EUR: 0.9, CHF: 0.85 }, sources: { USD: "usd_identity", GBP: "fetched_current", EUR: "display_fallback", CHF: "display_fallback" } },
};
const connected = assessConnectedPortfolioFacts(facts, asOf);
const context = buildAskConnectedPortfolioContext({ connected, meta: { id: facts.portfolio.id, name: privateValue, riskTolerance: "moderate", objective: "growth", timeHorizon: "long_term", createdAt: asOf } });

function appContext(focused: unknown) {
  return {
    user_id: owner, consumer_key: privateValue, raw_payload: { secret: privateValue }, data_as_of: asOf,
    page_context: { context_type: "holding", active_filters: { private_field: privateValue }, holdings: [context.holdings[0]], owns_stock: true },
    portfolio_context: { available: true, focused_portfolio: focused, other_portfolios: [{ id: "private-other", name: privateValue }], mentioned_holdings: [context.holdings[0]] },
    rankings_context: { top_rankings: [{ ticker: "AAA", rank: 10, score: 8000, price: 100, raw_payload: privateValue }] },
    news_context: { latest_news: [{ title: "Public fixture headline", published_at: asOf, affected_tickers: ["AAA"], private_payload: privateValue }] },
  };
}
const enriched = { ...context, provider_user_id: privateValue, userSecret: privateValue,
  holdings: context.holdings.map((holding) => ({ ...holding, account_id: privateValue, credentials: privateValue, raw_payload: privateValue })),
  coverage: { ...context.coverage, adapter_limitations: [`all_investments_source_unavailable:${owner}`] },
};
const input = appContext(enriched);
const before = JSON.stringify(input);
const result = minimizeAskAppContext(input);
const serialized = JSON.stringify(result);
assert.equal(JSON.stringify(input), before, "AI minimization mutated source financial facts");
for (const forbidden of [privateValue, owner, canonicalId, "private-portfolio", "private-position", "private-account", "private-connection", "private-other", "userSecret", "raw_payload", "consumer_key", "account_id", "instrument_id"]) {
  assert(!serialized.includes(forbidden), `AI context disclosed excluded identity/field ${forbidden}`);
}
// DTO tests use JSON round-tripping only to inspect the explicit output shape.
const output = JSON.parse(serialized);
const portfolio = output.portfolio_context.focused_portfolio;
assert.equal(portfolio.factual_summary.total_value, 450);
assert.equal(portfolio.factual_summary.cash_balance, 50);
assert.equal(portfolio.factual_summary.total_cost_basis, null);
assert.equal(portfolio.factual_summary.aggregate_performance_available, false);
assert.equal(portfolio.holdings.length, 2);
assert.notEqual(portfolio.holdings[0].instrument_key, portfolio.holdings[1].instrument_key, "Shared canonical identity collapsed positions");
assert.equal(portfolio.holdings[0].instrument_key, output.page_context.holdings[0].instrument_key);
assert.equal(portfolio.holdings[0].instrument_key, output.portfolio_context.mentioned_holdings[0].instrument_key);
assert.equal(portfolio.holdings.reduce((sum: number, item: { current_value: number }) => sum + item.current_value, 0), 400);
assert.equal(portfolio.holdings[0].investment_research_available, true);
assert.equal(portfolio.canonical_assessment.status, context.canonical_assessment.status);
assert.equal(output.portfolio_context.other_portfolios_count, 1);
assert.deepEqual(portfolio.coverage.adapter_limitations, ["all_investments_source_unavailable"]);
assert.deepEqual(minimizeAskAppContext(input), result, "Minimization must be deterministic per request");

for (const [identity, coverage, research] of [
  ["unresolved", "unsupported", false], ["persisted", "tracked_only", false],
  ["persisted", "ranked", true], ["sandbox_fixture", "ranked", false],
] as const) {
  const item = { ...context.holdings[0], identity_provenance: identity, coverage,
    test_data_label: identity === "sandbox_fixture" ? "unexpected-test-label" : null,
    investment_research_available: research };
  const clean = JSON.parse(JSON.stringify(minimizeAskAppContext(appContext({ ...context, holdings: [item] }))));
  const holding = clean.portfolio_context.focused_portfolio.holdings[0];
  assert.equal(holding.investment_research_available, research);
  if (identity === "sandbox_fixture") {
    assert.equal(holding.test_data_label, SANDBOX_FIXTURE_LABEL);
    assert.equal(holding.current_rank, null); assert.equal(holding.current_score, null);
    assert.equal(holding.canonical_assessment.status, null); assert.deepEqual(holding.canonical_assessment.reasons, []);
  }
  assert.equal(holding.current_value, 200, "Identity limitations changed broker monetary facts");
}
const unknown = assessConnectedPortfolioFacts({ ...facts,
  positions: facts.positions.map((holding) => ({ ...holding, price: null, price_currency: null, market_value: null, market_value_currency: null })),
  cashBalances: [{ ...facts.cashBalances[0], currency: "JPY" }],
}, asOf);
for (const change of [{ provenance: undefined }, { provenance: "unknown" }, { instrument_id: null }]) {
  const clean = JSON.parse(JSON.stringify(minimizeAskAppContext(appContext({ ...context, holdings: [{ ...context.holdings[0], ...change }] }))));
  assert.equal(clean.portfolio_context.focused_portfolio.holdings[0].investment_research_available, false);
}
const unknownContext = buildAskConnectedPortfolioContext({ connected: unknown, meta: { id: facts.portfolio.id, name: privateValue, riskTolerance: null, objective: null, timeHorizon: null, createdAt: asOf } });
const minimizedUnknown = JSON.parse(JSON.stringify(minimizeAskAppContext(appContext(unknownContext))));
assert.equal(minimizedUnknown.portfolio_context.focused_portfolio.factual_summary.total_value, null);
assert.equal(minimizedUnknown.portfolio_context.focused_portfolio.factual_summary.cash_balance, null);

const aggregate = buildAllInvestmentsFromSources([
  { id: "private-source-one", name: privateValue, source: "connected", availability: "ready", valueUsd: 450, cashUsd: 50, holdingCount: 2, holdings: connected.input.holdings, holdingIdentities: connected.holdingIdentities, limitations: [] },
  { id: "private-source-two", name: privateValue, source: "manual", availability: "unavailable", valueUsd: null, cashUsd: null, holdingCount: null, holdings: [], limitations: [] },
], asOf);
const aggregateBefore = JSON.stringify(aggregate);
const aggregateOut = JSON.parse(JSON.stringify(minimizeAskAppContext(appContext(buildAskAllInvestmentsContext(aggregate)))));
assert.equal(JSON.stringify(aggregate), aggregateBefore);
const all = aggregateOut.portfolio_context.focused_portfolio;
assert.equal(all.meta.name, "All Investments");
assert.equal(all.source_portfolios.length, 2);
assert.notEqual(all.source_portfolios[0].reference, all.source_portfolios[1].reference);
assert.equal(all.factual_summary.total_value, null); assert.equal(all.factual_summary.cash_balance, null);
assert(!JSON.stringify(aggregateOut).includes("private-source"));
assert(all.limitations.includes("all_investments_source_unavailable"));

const invalid = { ...context, factual_summary: { ...context.factual_summary, total_value: NaN, cash_balance: 0 } };
const invalidOut = JSON.parse(JSON.stringify(minimizeAskAppContext(appContext(invalid))));
assert.equal(invalidOut.portfolio_context.focused_portfolio.factual_summary.total_value, null);
assert.equal(invalidOut.portfolio_context.focused_portfolio.factual_summary.cash_balance, 0);
const excessive = { ...context, holdings: Array.from({ length: 5001 }, () => context.holdings[0]) };
assert.throws(() => minimizeAskAppContext(appContext(excessive)), /^Error: ai_context_budget_exceeded$/);
const large = { ...context, holdings: Array.from({ length: 5000 }, () => ({ ...context.holdings[0], company: "x".repeat(240), sector: "y".repeat(240) })) };
assert.throws(() => minimizeAskAppContext(appContext(large)), /^Error: ai_context_budget_exceeded$/);
const load200 = { ...context, holdings: Array.from({ length: 200 }, (_, index) => ({ ...context.holdings[0], instrument_key: `position-${index}` })) };
assert.equal(JSON.parse(JSON.stringify(minimizeAskAppContext(appContext(load200)))).portfolio_context.focused_portfolio.holdings.length, 200);
assert.deepEqual(safeAiProviderFailure(429), { message: "ai_provider_unavailable", status: 429 });
for (const hostile of [privateValue, { message: privateValue }, Infinity, 0, 600, 401.5]) assert.deepEqual(safeAiProviderFailure(hostile), { message: "ai_provider_unavailable" });

const route = readFileSync("app/api/ask-stockgpt/route.ts", "utf8");
assert(route.includes("minimizeAskAppContext(await buildAppContext("));
assert(route.indexOf("minimizeAskAppContext(await buildAppContext(") < route.indexOf("const messages: OpenRouterMessage[]"));
assert(route.includes('focusedPortfolio.management_source === "connected" ? null : buildAskStockGPTPortfolioContext('), "Missing connected facts must not fall back to manual cash/accounting");
assert(!route.includes("parseOpenRouterFailureText"));
assert(!route.includes("throw new Error(chunk.error.message)"));
assert(!route.includes("result.failures);"));
assert(!route.includes('message: data?.error?.message'));
assert(!readFileSync("lib/ai/portfolio-context-policy.ts", "utf8").includes("process.env"));
console.log("AI privacy allowlist, request-local identities, source/coverage isolation, unknown preservation, bounded payloads and sanitized failures passed (synthetic only).");
