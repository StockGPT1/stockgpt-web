import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculatePortfolioPerformance, classifyBrokerActivityFlow, convertHistoricalValue } from "../lib/portfolio-history";
import { ALL_INVESTMENTS_CONTEXT_ID, resolvePortfolioContext } from "../lib/portfolio-context";

const points = [{ at: "2026-01-01T12:00:00Z", value: 100 }, { at: "2026-02-01T12:00:00Z", value: 110 }];
const noFlow = calculatePortfolioPerformance({ points, flows: [] });
assert.equal(noFlow.status, "available");
assert.equal(noFlow.method, "time_weighted");
assert.equal(Math.round(noFlow.returnPct ?? 0), 10);

const boundedFlow = calculatePortfolioPerformance({
  points: [points[0], { at: "2026-01-15T12:00:00Z", value: 125 }, points[1]],
  flows: [{ at: "2026-01-15T12:00:00Z", amount: 20, direction: "inflow" }],
});
assert.equal(boundedFlow.method, "time_weighted");
assert.equal(boundedFlow.quality, "exact");

const estimated = calculatePortfolioPerformance({
  points,
  flows: [{ at: "2026-01-10T12:00:00Z", amount: 5, direction: "inflow" }],
});
assert.equal(estimated.method, "modified_dietz");
assert.equal(estimated.quality, "estimated");

const significant = calculatePortfolioPerformance({
  points,
  flows: [{ at: "2026-01-10T12:00:00Z", amount: 15, direction: "inflow" }],
});
assert.equal(significant.status, "unavailable");
assert(significant.limitations.includes("significant_flow_without_boundary_valuation"));
assert.equal(calculatePortfolioPerformance({ points, flows: [{ at: null, amount: 2, direction: "inflow" }] }).status, "unavailable");
assert.equal(calculatePortfolioPerformance({ points, flows: [{ at: "2026-01-10T12:00:00Z", amount: 2, direction: "unknown" }] }).status, "unavailable");
assert.equal(classifyBrokerActivityFlow("deposit"), "inflow");
assert.equal(classifyBrokerActivityFlow("withdrawal"), "outflow");
assert.equal(classifyBrokerActivityFlow("buy"), "internal");
assert.equal(classifyBrokerActivityFlow("mystery"), "unknown");

const rates = [{ baseCurrency: "GBP", quoteCurrency: "USD", effectiveDate: "2026-01-01", rate: 1.25 }];
assert.equal(convertHistoricalValue(80, "GBP", "USD", "2026-01-01T12:00:00Z", rates), 100);
assert.equal(convertHistoricalValue(80, "GBP", "USD", "2026-01-02T12:00:00Z", rates), null, "Current or nearest FX must not fill a missing historical date");

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
for (const source of ["app/portfolio/modern/page.tsx", "lib/dashboard-portfolio.ts", "app/api/ask-stockgpt/route.ts"]) {
  assert(readFileSync(source, "utf8").includes("resolveOwnedPortfolioContext"), `${source} bypasses the shared context resolver`);
}
console.log("Wave 4 history, performance, historical-FX and Portfolio-context checks passed.");
