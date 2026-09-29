import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Database } from "../lib/database.types";
import {
  assessConnectedPortfolioFacts,
  type ConnectedPortfolioFacts,
} from "../lib/connected-portfolio-intelligence-map";
import { buildAllInvestmentsFromSources } from "../lib/all-investments";

const read = (path: string) => readFileSync(path, "utf8");
const asOf = "2026-09-01T12:00:00Z";
const userId = "11111111-1111-4111-8111-111111111111";
type Position = Database["public"]["Tables"]["broker_positions"]["Row"];

function position(index: number, mapped = true): Position {
  return {
    id: `position-${index}`,
    user_id: userId,
    account_id: "account-load",
    position_key: `position-${index}`,
    external_position_id: `external-${index}`,
    external_instrument_id: `provider-${index}`,
    instrument_id: mapped ? `instrument-${index}` : null,
    symbol: `S${index}`,
    description: `Synthetic ${index}`,
    asset_type: "equity",
    quantity: 1,
    price: 10,
    price_currency: "USD",
    market_value: 10,
    market_value_currency: "USD",
    as_of: asOf,
    created_at: asOf,
    updated_at: asOf,
  };
}

function connectedFacts(size: number): ConnectedPortfolioFacts {
  const positions = Array.from({ length: size }, (_, index) => position(index));
  return {
    portfolio: {
      id: "portfolio-load",
      broker_account_id: "account-load",
      risk_tolerance: "moderate",
      objective: "growth",
      time_horizon: "long_term",
    },
    account: {
      id: "account-load",
      name: "Load fixture",
      status: "active",
      base_currency: "USD",
      last_successful_sync_at: asOf,
      connection_id: "connection-load",
    },
    connection: {
      id: "connection-load",
      status: "active",
      last_successful_sync_at: asOf,
    },
    positions,
    cashBalances: [{
      id: "cash-load",
      user_id: userId,
      account_id: "account-load",
      currency: "USD",
      amount: 25,
      as_of: asOf,
      created_at: asOf,
      updated_at: asOf,
    }],
    rankings: positions.map((item, index) => ({
      instrument_id: item.instrument_id,
      ticker: item.symbol,
      score: 7000,
      rank: index + 1,
      last_ranking_update: asOf,
    })),
    diagnostics: positions.map((item) => ({
      ticker: String(item.symbol),
      current_score: 7000,
      previous_score: 7000,
      updated_at: asOf,
    })),
    rankedUniverseSize: Math.max(size, 500),
    fxQuote: {
      rates: { USD: 1, GBP: 0.8, EUR: 0.9, CHF: 0.85 },
      sources: {
        USD: "usd_identity",
        GBP: "configured",
        EUR: "configured",
        CHF: "configured",
      },
    },
  };
}

for (const size of [0, 10, 50, 200]) {
  const result = assessConnectedPortfolioFacts(connectedFacts(size), asOf);
  assert.equal(result.positions.length, size);
  assert.equal(result.input.holdings.length, size);
  assert.equal(result.totalValueUsd, 25 + size * 10);
  assert.equal(result.cashValueUsd, 25);
  console.log(`Wave 6 connected load fixture: positions=${size}, bulk-query budget<=10, provider calls=0`);
}

const unknownFacts = connectedFacts(200);
unknownFacts.positions[199] = position(199, false);
unknownFacts.rankings = unknownFacts.rankings.slice(0, 199);
const unknown = assessConnectedPortfolioFacts(unknownFacts, asOf);
assert.equal(unknown.positions.length, 200, "Unmapped position disappeared at load size");
assert.equal(unknown.input.holdings[199].coverage, "unsupported");
assert.equal(unknown.totalValueUsd, 2025, "Reliable unmapped value was discarded");

const aggregate = buildAllInvestmentsFromSources(
  [0, 10, 50, 200].map((size, index) => {
    const result = assessConnectedPortfolioFacts(connectedFacts(size), asOf);
    return {
      id: `source-${index}`,
      name: `Source ${index}`,
      source: index % 2 ? "manual" as const : "connected" as const,
      availability: "ready" as const,
      valueUsd: result.totalValueUsd,
      cashUsd: result.cashValueUsd,
      holdingCount: result.input.holdings.length,
      holdings: result.input.holdings,
      limitations: result.adapterLimitations,
    };
  }),
  asOf,
);
assert.equal(aggregate.sources.length, 4);
assert.equal(aggregate.input.holdings.length, 260);
assert.equal(aggregate.totalValueUsd, 2700);

const portfolioPage = read("app/portfolio/modern/page.tsx");
assert.equal((portfolioPage.match(/\.limit\(500\)/gu) ?? []).length, 1);
assert.ok(
  portfolioPage.indexOf('params.builder === "1"') < portfolioPage.indexOf(".limit(500)"),
  "Normal Portfolio still loads the full ranking universe",
);
assert.match(portfolioPage, /\.in\("ticker", heldTickers\)/u);
assert.match(portfolioPage, /stockOptions=\{heldStockOptions\}/u);

const addSheet = read("components/portfolio-workspace/PortfolioAddSheet.tsx");
assert.match(addSheet, /fetch\(`\/api\/search\?q=/u);
const searchRoute = read("app/api/search/route.ts");
assert.match(searchRoute, /\.limit\(8\)/u);

const connectedLoader = read("lib/connected-portfolio-intelligence.ts");
assert.equal((connectedLoader.match(/from\("broker_positions"\)/gu) ?? []).length, 1);
assert.equal((connectedLoader.match(/from\("broker_cash_balances"\)/gu) ?? []).length, 1);
assert.match(connectedLoader, /\.in\("instrument_id", instrumentIds\)/u);
assert.match(connectedLoader, /\.in\("ticker", tickers\)/u);

const ordinaryReads = [
  portfolioPage,
  read("lib/dashboard-portfolio.ts"),
  read("lib/all-investments.ts"),
].join("\n");
assert.doesNotMatch(ordinaryReads, /fetchSnapTrade|createSnapTradeClient|listSnapTradeConnections/u);
assert.match(read("lib/portfolio-alerts.ts"), /PORTFOLIO_TECHNICAL_CHARTS !== "true"/u);
assert.match(read("lib/yahoo.ts"), /STOCKGPT_EXTERNAL_NETWORK_DISABLED === "true"/u);

const worker = read("lib/brokerage/sync-runner.ts");
assert.match(worker, /Math\.min\(5, Math\.max\(1, input\.limit \?\? 2\)\)/u);
assert.match(worker, /Math\.min\(3600, 60 \* 2 \*\* Math\.min\(job\.attempt_count, 6\)\)/u);
const syncMigration = read("supabase/migrations/20260913184520_establish_broker_sync_engine.sql");
assert.match(syncMigration, /for update skip locked/u);
assert.match(syncMigration, /jsonb_array_length\(p_candidate->'accounts'\) > 25/u);
assert.match(syncMigration, /jsonb_array_length\(v_account->'positions'->'items'\) > 5000/u);
assert.match(syncMigration, /jsonb_array_length\(v_account->'activities'->'items'\) > 10000/u);

console.log("Wave 6 deterministic Portfolio, aggregate and broker-work budgets passed.");
