import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAllInvestmentsFromSources } from "../lib/all-investments";
import { calculatePortfolioPerformance, classifyBrokerActivityFlow, convertHistoricalValue } from "../lib/portfolio-history";
import type { HoldingIntelligenceInput } from "../lib/portfolio-intelligence";
import { ALL_INVESTMENTS_CONTEXT_ID, resolvePortfolioContext } from "../lib/portfolio-context";

const points = [{ at: "2026-01-01T12:00:00Z", value: 100 }, { at: "2026-02-01T12:00:00Z", value: 110 }];
const noFlow = calculatePortfolioPerformance({ points, flows: [] });
assert.equal(noFlow.status, "available");
assert.equal(noFlow.method, "time_weighted");
assert.equal(Math.round(noFlow.returnPct ?? 0), 10);
const totalLoss = calculatePortfolioPerformance({ points: [points[0], { at: points[1].at, value: 0 }], flows: [] });
assert.equal(totalLoss.status, "available");
assert.equal(totalLoss.method, "time_weighted");
assert.equal(totalLoss.quality, "exact");
assert.equal(totalLoss.returnPct, -100);

const boundedFlow = calculatePortfolioPerformance({
  points: [points[0], { at: "2026-02-01T12:00:00Z", value: 132 }],
  flows: [{
    at: "2026-01-15T12:00:00Z",
    amount: 20,
    direction: "inflow",
    timingPrecision: "exact",
    exactBoundary: { beforeValue: 100, afterValue: 120 },
  }],
});
assert.equal(boundedFlow.method, "time_weighted");
assert.equal(boundedFlow.quality, "exact");
assert.equal(Math.round(boundedFlow.returnPct ?? 0), 10);

const merelyNearby = calculatePortfolioPerformance({
  points: [points[0], { at: "2026-01-10T00:00:00Z", value: 100 }, points[1]],
  flows: [{ at: "2026-01-10T12:00:00Z", amount: 5, direction: "inflow", timingPrecision: "exact" }],
});
assert.equal(merelyNearby.method, "modified_dietz");
assert.equal(merelyNearby.quality, "estimated");

const estimated = calculatePortfolioPerformance({
  points: [points[0], { at: "2026-01-10T12:00:00Z", value: 100 }, points[1]],
  flows: [{ at: "2026-01-10T00:00:00Z", amount: 5, direction: "inflow", timingPrecision: "date_only" }],
});
assert.equal(estimated.method, "modified_dietz");
assert.equal(estimated.quality, "estimated");

const estimatedWithdrawal = calculatePortfolioPerformance({
  points: [points[0], { at: "2026-01-10T12:00:00Z", value: 100 }, points[1]],
  flows: [{ at: "2026-01-10T12:00:00Z", amount: 5, direction: "outflow", timingPrecision: "exact" }],
});
assert.equal(estimatedWithdrawal.method, "modified_dietz");
assert.equal(estimatedWithdrawal.quality, "estimated");
const internalOnly = calculatePortfolioPerformance({
  points,
  flows: [{ at: "2026-01-10T12:00:00Z", amount: 50, direction: "internal", timingPrecision: "exact" }],
});
assert.equal(internalOnly.method, "time_weighted");
assert.equal(Math.round(internalOnly.returnPct ?? 0), 10);

const significant = calculatePortfolioPerformance({
  points: [
    { at: "2026-01-01T12:00:00Z", value: 1000 },
    { at: "2026-01-10T12:00:00Z", value: 100 },
    { at: "2026-02-01T12:00:00Z", value: 110 },
  ],
  flows: [{ at: "2026-01-10T00:00:00Z", amount: 50, direction: "inflow", timingPrecision: "date_only" }],
});
assert.equal(significant.status, "unavailable");
assert(significant.limitations.includes("significant_flow_without_boundary_valuation"));
assert.equal(calculatePortfolioPerformance({ points, flows: [{ at: null, amount: 2, direction: "inflow", timingPrecision: "unknown" }] }).status, "unavailable");
assert.equal(calculatePortfolioPerformance({ points, flows: [{ at: "2026-01-10T12:00:00Z", amount: 2, direction: "unknown", timingPrecision: "exact" }] }).status, "unavailable");
for (const type of ["deposit", "cash deposit", "contribution"]) assert.equal(classifyBrokerActivityFlow(type), "inflow");
for (const type of ["withdrawal", "cash withdrawal"]) assert.equal(classifyBrokerActivityFlow(type), "outflow");
for (const type of [
  "buy",
  "sell",
  "fee",
  "tax",
  "distribution",
  "dividend",
  "substitute dividend",
  "interest",
  "rebate",
  "return of capital",
  "rei",
  "stock dividend",
  "split",
  "reverse split",
]) assert.equal(classifyBrokerActivityFlow(type), "internal", `${type} must remain an internal investment event`);
for (const type of ["transfer", "transfer_in", "transfer_out", "external transfer in", "external transfer out", "adjustment", "mystery"]) {
  assert.equal(classifyBrokerActivityFlow(type), "unknown", `${type} lacks sufficient external-flow evidence`);
}

const distributionPerformance = calculatePortfolioPerformance({
  points,
  flows: [{
    at: "2026-01-10T00:00:00Z",
    amount: 50,
    direction: classifyBrokerActivityFlow("distribution"),
    timingPrecision: "date_only",
  }],
});
assert.equal(distributionPerformance.method, "time_weighted");
assert.equal(Math.round(distributionPerformance.returnPct ?? 0), 10, "Distribution income must not be neutralized as an external withdrawal");

const rates = [{ baseCurrency: "GBP", quoteCurrency: "USD", effectiveDate: "2026-01-01", rate: 1.25 }];
assert.equal(convertHistoricalValue(80, "GBP", "USD", "2026-01-01T12:00:00Z", rates), 100);
assert.equal(convertHistoricalValue(80, "GBP", "USD", "2026-01-02T12:00:00Z", rates), null, "Current or nearest FX must not fill a missing historical date");

const holding = (instrumentKey: string, provenance: "manual" | "broker"): HoldingIntelligenceInput => ({
  instrumentKey,
  ticker: "AAA",
  coverage: "ranked",
  provenance,
  currentValue: 100,
  shares: 1,
  market: { currentPrice: 100, priceAsOf: "2026-02-01T12:00:00Z" },
  ranking: { currentScore: 80, scoreAtEntry: null, currentRank: 10, rankAtEntry: null, universeSize: 100, asOf: "2026-02-01T12:00:00Z" },
});
const knownAndUnavailable = buildAllInvestmentsFromSources([
  { id: "manual-1", name: "Manual", source: "manual", availability: "ready", valueUsd: 100, cashUsd: 0, holdingCount: 1, holdings: [holding("AAA", "manual")], limitations: [] },
  { id: "connected-1", name: "Connected", source: "connected", availability: "unavailable", valueUsd: null, cashUsd: null, holdingCount: null, holdings: [], limitations: [] },
], "2026-02-01T12:00:00Z");
assert.equal(knownAndUnavailable.sources.length, 2, "Unavailable included source was dropped");
assert.equal(knownAndUnavailable.totalValueUsd, null);
assert.equal(knownAndUnavailable.cashValueUsd, null);
assert(knownAndUnavailable.adapterLimitations.includes("all_investments_source_unavailable:connected-1"));

const unknownCash = buildAllInvestmentsFromSources([
  { id: "manual-1", name: "Manual", source: "manual", availability: "ready", valueUsd: 100, cashUsd: 0, holdingCount: 1, holdings: [holding("AAA", "manual")], limitations: [] },
  { id: "connected-1", name: "Connected", source: "connected", availability: "ready", valueUsd: 50, cashUsd: null, holdingCount: 0, holdings: [], limitations: ["connected_cash_incomplete"] },
], "2026-02-01T12:00:00Z");
assert.equal(unknownCash.totalValueUsd, 150);
assert.equal(unknownCash.cashValueUsd, null, "Unknown included-source cash was treated as zero");
assert(unknownCash.adapterLimitations.includes("all_investments_cash_incomplete"));

const allUnavailable = buildAllInvestmentsFromSources([
  { id: "manual-1", name: "Manual", source: "manual", availability: "unavailable", valueUsd: null, cashUsd: null, holdingCount: null, holdings: [], limitations: [] },
  { id: "connected-1", name: "Connected", source: "connected", availability: "unavailable", valueUsd: null, cashUsd: null, holdingCount: null, holdings: [], limitations: [] },
], "2026-02-01T12:00:00Z");
assert.equal(allUnavailable.totalValueUsd, null, "Completely unknown aggregate collapsed to zero");
assert.equal(allUnavailable.cashValueUsd, null, "Completely unknown cash collapsed to zero");

const knownZero = buildAllInvestmentsFromSources([
  { id: "manual-1", name: "Manual", source: "manual", availability: "ready", valueUsd: 0, cashUsd: 0, holdingCount: 0, holdings: [], limitations: [] },
  { id: "connected-1", name: "Connected", source: "connected", availability: "ready", valueUsd: 0, cashUsd: 0, holdingCount: 0, holdings: [], limitations: [] },
], "2026-02-01T12:00:00Z");
assert.equal(knownZero.totalValueUsd, 0);
assert.equal(knownZero.cashValueUsd, 0);

const separateSimilarHoldings = buildAllInvestmentsFromSources([
  { id: "manual-1", name: "Manual", source: "manual", availability: "ready", valueUsd: 100, cashUsd: 0, holdingCount: 1, holdings: [holding("AAA", "manual")], limitations: [] },
  { id: "connected-1", name: "Connected", source: "connected", availability: "ready", valueUsd: 100, cashUsd: 0, holdingCount: 1, holdings: [holding("AAA", "broker")], limitations: [] },
], "2026-02-01T12:00:00Z");
assert.deepEqual(separateSimilarHoldings.input.holdings.map((item) => item.instrumentKey), ["manual-1:AAA", "connected-1:AAA"]);

const portfolios = [
  { id: "b", name: "Second", source: "connected" as const, createdAt: "2026-02-01" },
  { id: "a", name: "First", source: "manual" as const, createdAt: "2026-01-01" },
];
assert.deepEqual(resolvePortfolioContext({ explicit: "b", portfolios }), { kind: "portfolio", portfolioId: "b" });
assert.deepEqual(resolvePortfolioContext({ explicit: ALL_INVESTMENTS_CONTEXT_ID, portfolios }), { kind: "all_investments", portfolioId: null });
assert.deepEqual(resolvePortfolioContext({ explicit: "cross-user", saved: { kind: "portfolio", portfolioId: "b" }, portfolios }), { kind: "portfolio", portfolioId: "b" });
assert.deepEqual(resolvePortfolioContext({ explicit: "missing", saved: { kind: "portfolio", portfolioId: "deleted" }, portfolios }), { kind: "portfolio", portfolioId: "a" });
assert.equal(resolvePortfolioContext({ explicit: null, portfolios: [] }), null);

const historyLoader = readFileSync("lib/connected-portfolio-history.ts", "utf8");
assert(!historyLoader.includes("getUsdFxQuote"), "Connected history imported current FX");
assert(historyLoader.includes("historical_fx_rates"), "Connected history does not require historical FX evidence");
const aggregate = readFileSync("lib/all-investments.ts", "utf8");
assert(!aggregate.includes(".insert("), "All Investments persisted a synthetic Portfolio");
assert(aggregate.includes("portfolio.id"), "Aggregate holding identity is not source scoped");
assert(!aggregate.includes("broker_accounts"), "All Investments directly included unprojected broker accounts");
assert(!/snaptrade|provider.*fetch/iu.test(aggregate), "All Investments introduced a provider call into aggregate rendering");
for (const source of ["app/portfolio/modern/page.tsx", "lib/dashboard-portfolio.ts", "app/api/ask-stockgpt/route.ts"]) {
  assert(readFileSync(source, "utf8").includes("resolveOwnedPortfolioContext"), `${source} bypasses the shared context resolver`);
}
console.log("Wave 4 history, performance, historical-FX and Portfolio-context checks passed.");
