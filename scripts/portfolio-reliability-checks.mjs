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

function weightedAverage({ existingShares, existingPrice, incomingShares, incomingPrice }) {
  const shares = roundTradeShares(existingShares + incomingShares);
  const totalCost = existingShares * existingPrice + incomingShares * incomingPrice;
  return {
    shares,
    entryPrice: Math.round((totalCost / shares) * 10_000) / 10_000,
  };
}

function simulateTrim(holding, input) {
  const order = resolveTradeOrder(input);
  if (order.error || order.value == null || order.price == null || order.shares == null) {
    return { success: false, error: order.error ?? "Invalid order" };
  }
  if (order.shares > holding.shares + 0.000001) {
    return { success: false, error: "Cannot sell more shares than are held." };
  }
  const remainingShares = roundTradeShares(Math.max(0, holding.shares - order.shares));
  return {
    success: true,
    proceeds: order.value,
    realisedPnl: roundTradeMoney(order.shares * (order.price - holding.entryPrice)),
    remainingShares,
    remainingEntryPrice: remainingShares > 0 ? holding.entryPrice : null,
  };
}

function baseHolding(overrides = {}) {
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

// Trade input resolution: any two consistent fields resolve the third.
for (const [input, expected] of [
  [{ value: "900", price: "90", shares: "" }, { value: 900, price: 90, shares: 10 }],
  [{ value: "200", price: "", shares: "1.25" }, { value: 200, price: 160, shares: 1.25 }],
  [{ value: "", price: "45", shares: "4" }, { value: 180, price: 45, shares: 4 }],
  [{ value: "100.01", price: "33.336666", shares: "3" }, { value: 100.01, price: 33.336666, shares: 3 }],
]) {
  const resolved = resolveTradeOrder(input);
  assert.equal(resolved.error, null);
  assert.equal(resolved.value, expected.value);
  assert.equal(resolved.price, expected.price);
  assert.equal(resolved.shares, expected.shares);
}
assert.match(resolveTradeOrder({ value: "100", price: "45", shares: "4" }).error ?? "", /do not match/i);
assert.match(resolveTradeOrder({ value: "100", price: "0", shares: "" }).error ?? "", /Enter any two/i);
assert.match(resolveTradeOrder({ value: "", price: "", shares: "" }).error ?? "", /Enter any two/i);

// Weighted-average entry prices retain fractional-share precision.
assert.deepEqual(
  weightedAverage({ existingShares: 10, existingPrice: 100, incomingShares: 5, incomingPrice: 130 }),
  { shares: 15, entryPrice: 110 },
);
assert.deepEqual(
  weightedAverage({ existingShares: 1.25, existingPrice: 88, incomingShares: 0.75, incomingPrice: 120 }),
  { shares: 2, entryPrice: 100 },
);

// Trim and close calculations cannot oversell and preserve basis until fully closed.
assert.deepEqual(
  simulateTrim({ shares: 10, entryPrice: 100 }, { value: "450", price: "150" }),
  { success: true, proceeds: 450, realisedPnl: 150, remainingShares: 7, remainingEntryPrice: 100 },
);
assert.deepEqual(
  simulateTrim({ shares: 10, entryPrice: 100 }, { shares: "10", price: "90" }),
  { success: true, proceeds: 900, realisedPnl: -100, remainingShares: 0, remainingEntryPrice: null },
);
assert.equal(simulateTrim({ shares: 1, entryPrice: 100 }, { shares: "2", price: "90" }).success, false);

// Allocation uses total portfolio value including cash and reconciles to 100%.
assert.equal(allocation(0, 1000), 0);
assert.equal(allocation(1000, 1000), 100);
assert.equal(allocation(100, 0), null);
assert.equal(allocation(Number.NaN, 1000), null);
const holdings = [1237, 889.24, 864.96, 829.49, 538.2];
const cash = 1275.11;
const total = holdings.reduce((sum, value) => sum + value, 0) + cash;
const allocationTotal =
  holdings.reduce((sum, value) => sum + (allocation(value, total) ?? 0), 0) +
  (allocation(cash, total) ?? 0);
assert.ok(Math.abs(allocationTotal - 100) < 0.000001);
assert.ok(Math.abs((allocation(1237, 5634) ?? 0) - 21.956) < 0.01);

// Decision engine states remain explicit and freshness-aware.
const now = Date.now();
const freshIso = new Date(now - 30 * 60_000).toISOString();
const staleIso = new Date(now - 5 * 24 * 60 * 60_000).toISOString();
assert.equal(
  derivePortfolioHoldingAction(baseHolding(), {
    riskTolerance: "moderate",
    cashBalance: 250,
    nowMs: now,
  }).action,
  "none",
);
assert.equal(
  derivePortfolioHoldingAction(baseHolding({ score: 5800, rank: 240, daysSinceReview: 45 }), {
    riskTolerance: "moderate",
    cashBalance: 250,
    nowMs: now,
  }).action,
  "review",
);
assert.equal(
  derivePortfolioHoldingAction(
    baseHolding({
      score: 8100,
      rank: 25,
      currentAllocationPct: 5,
      targetAllocationPct: 14,
      actionAlerts: [{ action: "buy_more", severity: "info", dataUpdatedAt: freshIso }],
    }),
    { riskTolerance: "moderate", cashBalance: 1500, cashDrag: 7, nowMs: now },
  ).action,
  "buy_more",
);
assert.equal(
  derivePortfolioHoldingAction(
    baseHolding({ score: 5500, rank: 200, currentAllocationPct: 38, targetAllocationPct: 18 }),
    { riskTolerance: "moderate", cashBalance: 500, sectorExposurePct: 38, nowMs: now },
  ).action,
  "trim",
);
assert.equal(
  derivePortfolioHoldingAction(
    baseHolding({
      score: 4800,
      rank: 320,
      currentAllocationPct: 42,
      targetAllocationPct: 16,
      pnlPercent: -35,
      actionAlerts: [{ action: "sell", severity: "critical", dataUpdatedAt: freshIso }],
    }),
    { riskTolerance: "moderate", cashBalance: 500, nowMs: now },
  ).action,
  "exit",
);
const staleDecision = derivePortfolioHoldingAction(
  baseHolding({
    score: 5400,
    rank: 260,
    currentAllocationPct: 38,
    targetAllocationPct: 16,
    actionAlerts: [{ action: "trim", severity: "warning", dataUpdatedAt: staleIso }],
  }),
  { riskTolerance: "moderate", cashBalance: 500, nowMs: now },
);
assert.equal(staleDecision.freshness, "stale");
assert.notEqual(staleDecision.confidence, "high");

// Source-level invariants protect chart honesty, ownership and atomic actions.
const chartHealth = readSource("lib/portfolio-chart-health.ts");
assert.match(chartHealth, /realPointCount/);
assert.doesNotMatch(chartHealth, /meaningfulPointCount\s*>\s*0\s*&&\s*flat/);

const pageChart = readSource("lib/portfolio-page-chart.ts");
assert.match(pageChart, /buildPortfolioPageChartResult/);
assert.match(pageChart, /allowCurrentSnapshot/);
assert.doesNotMatch(pageChart, /Math\.random/);

const actions = readSource("lib/actions/portfolio-management.ts");
assert.match(actions, /supabase\.auth\.getUser/);
assert.match(actions, /portfolioId/);
assert.match(actions, /Cannot sell more shares than are held/);
assert.match(actions, /invalidatePortfolioPageSnapshot/);
assert.match(actions, /revalidatePath\(["']\/portfolio["']\)/);

const opportunityEngine = readSource("lib/dashboard-portfolio.ts");
assert.match(opportunityEngine, /buildPortfolioOpportunities/);
assert.match(opportunityEngine, /Review existing holding/);
assert.match(opportunityEngine, /targetAllocationPct/);
assert.match(opportunityEngine, /getOneDayMoveMap/);

console.log("Portfolio reliability checks passed.");
