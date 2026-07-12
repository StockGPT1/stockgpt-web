import assert from "node:assert/strict";
import fs from "node:fs";

const { resolveTradeOrder, roundTradeMoney, roundTradeShares } =
  await import("../lib/trade-calculator.ts");
const { derivePortfolioHoldingAction } =
  await import("../lib/portfolio-action-engine.ts");

const readSource = (relativePath) =>
  fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

function allocation(value, total) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function weightedAverage(existingShares, existingPrice, incomingShares, incomingPrice) {
  const shares = roundTradeShares(existingShares + incomingShares);
  const cost = existingShares * existingPrice + incomingShares * incomingPrice;
  return { shares, entryPrice: Math.round((cost / shares) * 10_000) / 10_000 };
}

function trimResult(holding, input) {
  const order = resolveTradeOrder(input);
  if (order.error || order.value == null || order.price == null || order.shares == null) {
    return { success: false };
  }
  if (order.shares > holding.shares + 0.000001) return { success: false };
  const remainingShares = roundTradeShares(Math.max(0, holding.shares - order.shares));
  return {
    success: true,
    proceeds: order.value,
    realisedPnl: roundTradeMoney(order.shares * (order.price - holding.entryPrice)),
    remainingShares,
    remainingEntryPrice: remainingShares > 0 ? holding.entryPrice : null,
  };
}

function holding(overrides = {}) {
  return {
    ticker: "MU",
    company: "Micron",
    sector: "Technology",
    score: 7100,
    maxScore: 10_000,
    rank: 90,
    currentPrice: 100,
    entryPrice: 100,
    shares: 10,
    currentValue: 1000,
    totalPnLDollars: 0,
    currentAllocationPct: 10,
    targetAllocationPct: 12,
    scoreAtEntry: 7000,
    rankAtEntry: 95,
    pnlPercent: 0,
    daysSinceReview: 5,
    actionAlerts: [],
    eventAlerts: [],
    ...overrides,
  };
}

// Any two matching order fields resolve the third; inconsistent orders are rejected.
for (const [input, expected] of [
  [{ value: "900", price: "90", shares: "" }, [900, 90, 10]],
  [{ value: "200", price: "", shares: "1.25" }, [200, 160, 1.25]],
  [{ value: "", price: "45", shares: "4" }, [180, 45, 4]],
  [{ value: "100.01", price: "33.336666", shares: "3" }, [100.01, 33.336666, 3]],
]) {
  const result = resolveTradeOrder(input);
  assert.equal(result.error, null);
  assert.deepEqual([result.value, result.price, result.shares], expected);
}
assert.match(resolveTradeOrder({ value: "100", price: "45", shares: "4" }).error ?? "", /do not match/i);
assert.match(resolveTradeOrder({ value: "", price: "", shares: "" }).error ?? "", /Enter any two/i);

// Fractional-share basis and trim outcomes remain numerically stable.
assert.deepEqual(weightedAverage(10, 100, 5, 130), { shares: 15, entryPrice: 110 });
assert.deepEqual(weightedAverage(1.25, 88, 0.75, 120), { shares: 2, entryPrice: 100 });
assert.deepEqual(trimResult({ shares: 10, entryPrice: 100 }, { value: "450", price: "150" }), {
  success: true,
  proceeds: 450,
  realisedPnl: 150,
  remainingShares: 7,
  remainingEntryPrice: 100,
});
assert.deepEqual(trimResult({ shares: 10, entryPrice: 100 }, { shares: "10", price: "90" }), {
  success: true,
  proceeds: 900,
  realisedPnl: -100,
  remainingShares: 0,
  remainingEntryPrice: null,
});
assert.equal(trimResult({ shares: 1, entryPrice: 100 }, { shares: "2", price: "90" }).success, false);

// Allocation is based on total portfolio value including cash and reconciles exactly.
assert.equal(allocation(0, 1000), 0);
assert.equal(allocation(1000, 1000), 100);
assert.equal(allocation(100, 0), null);
assert.equal(allocation(Number.NaN, 1000), null);
const values = [1237, 889.24, 864.96, 829.49, 538.2];
const cash = 1275.11;
const total = values.reduce((sum, value) => sum + value, 0) + cash;
const allocationTotal = values.reduce((sum, value) => sum + (allocation(value, total) ?? 0), 0) + (allocation(cash, total) ?? 0);
assert.ok(Math.abs(allocationTotal - 100) < 0.000001);
assert.ok(Math.abs((allocation(1237, 5634) ?? 0) - 21.956) < 0.01);

// Decision states remain explicit and stale inputs cannot produce high-confidence action.
const now = Date.now();
const fresh = new Date(now - 30 * 60_000).toISOString();
const stale = new Date(now - 5 * 24 * 60 * 60_000).toISOString();
assert.equal(derivePortfolioHoldingAction(holding(), { riskTolerance: "moderate", cashBalance: 250, nowMs: now }).action, "none");
assert.equal(derivePortfolioHoldingAction(holding({ score: 5800, rank: 240, daysSinceReview: 45 }), { riskTolerance: "moderate", cashBalance: 250, nowMs: now }).action, "review");
assert.equal(derivePortfolioHoldingAction(holding({ score: 8100, rank: 25, currentAllocationPct: 5, targetAllocationPct: 14, actionAlerts: [{ action: "buy_more", severity: "info", dataUpdatedAt: fresh }] }), { riskTolerance: "moderate", cashBalance: 1500, cashDrag: 7, nowMs: now }).action, "buy_more");
assert.equal(derivePortfolioHoldingAction(holding({ score: 5500, rank: 200, currentAllocationPct: 38, targetAllocationPct: 18 }), { riskTolerance: "moderate", cashBalance: 500, sectorExposurePct: 38, nowMs: now }).action, "trim");
assert.equal(derivePortfolioHoldingAction(holding({ score: 4800, rank: 320, currentAllocationPct: 42, targetAllocationPct: 16, pnlPercent: -35, actionAlerts: [{ action: "sell", severity: "critical", dataUpdatedAt: fresh }] }), { riskTolerance: "moderate", cashBalance: 500, nowMs: now }).action, "exit");
const staleDecision = derivePortfolioHoldingAction(holding({ score: 5400, rank: 260, currentAllocationPct: 38, targetAllocationPct: 16, actionAlerts: [{ action: "trim", severity: "warning", dataUpdatedAt: stale }] }), { riskTolerance: "moderate", cashBalance: 500, nowMs: now });
assert.equal(staleDecision.freshness, "stale");
assert.notEqual(staleDecision.confidence, "high");

// Source invariants protect chart honesty, ownership checks, cache invalidation and opportunities.
const chartHealth = readSource("lib/portfolio-chart-health.ts");
assert.match(chartHealth, /realPointCount/);
assert.doesNotMatch(chartHealth, /meaningfulPointCount\s*>\s*0\s*&&\s*flat/);
const pageChart = readSource("lib/portfolio-page-chart.ts");
assert.match(pageChart, /buildPortfolioPageChartResult/);
assert.match(pageChart, /allowCurrentSnapshot/);
assert.doesNotMatch(pageChart, /Math\.random/);
const actions = readSource("lib/actions/portfolio-management.ts");
assert.match(actions, /supabase\.auth\.getUser/);
assert.match(actions, /resolvedTradeOrError/);
assert.match(actions, /portfolio_transactions/);
assert.match(actions, /invalidatePortfolioPageSnapshot/);
assert.match(actions, /revalidatePath\(["']\/portfolio["']/);
const opportunities = readSource("lib/dashboard-portfolio.ts");
assert.match(opportunities, /buildPortfolioOpportunities/);
assert.match(opportunities, /Review existing holding/);
assert.match(opportunities, /targetAllocationPct/);
assert.match(opportunities, /getOneDayMoveMap/);

console.log("Portfolio reliability checks passed.");
