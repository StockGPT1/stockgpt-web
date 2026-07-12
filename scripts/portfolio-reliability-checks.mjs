import assert from "node:assert/strict";
import fs from "node:fs";

const { resolveTradeOrder, roundTradeMoney, roundTradeShares } =
  await import("../lib/trade-calculator.ts");
const { derivePortfolioHoldingAction } =
  await import("../lib/portfolio-action-engine.ts");

const minRealPoints = {
  "1D": 6,
  "1M": 4,
  "6M": 8,
  "1Y": 8,
  MAX: 4,
};

function readSource(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function realPoints(points = []) {
  return points.filter((point) => !point.synthetic);
}

function filterDisplayable(chartData) {
  return Object.fromEntries(
    Object.entries(chartData)
      .map(([range, points]) => [range, realPoints(points)])
      .filter(
        ([range, points]) => points.length >= (minRealPoints[range] ?? 4),
      ),
  );
}

function chartDisplayState(points) {
  const real = realPoints(points);
  if (real.length < minRealPoints["1D"]) return "unusable";
  const values = real.map((point) => Number(point.close));
  const allSame = values.every((value) => value === values[0]);
  return allSame ? "displayable-flat" : "displayable-moving";
}

function assertResolvedTrade(input, expected) {
  const actual = resolveTradeOrder(input);
  assert.equal(actual.error, null);
  assert.equal(actual.value, expected.value);
  assert.equal(actual.price, expected.price);
  assert.equal(actual.shares, expected.shares);
}

function weightedAverage({
  existingShares,
  existingPrice,
  incomingShares,
  incomingPrice,
  incomingCost,
}) {
  const shares = roundTradeShares(existingShares + incomingShares);
  const cost =
    existingShares * existingPrice +
    (incomingCost ?? incomingShares * incomingPrice);
  return {
    shares,
    entryPrice: Math.round((cost / shares) * 10_000) / 10_000,
  };
}

function simulateTrim(holding, orderInput) {
  const order = resolveTradeOrder(orderInput);
  if (order.error) return { success: false, error: order.error };
  assert.notEqual(order.value, null);
  assert.notEqual(order.price, null);
  assert.notEqual(order.shares, null);
  if (order.shares > holding.shares + 0.000001) {
    return { success: false, error: "Cannot sell more shares than are held." };
  }

  const realisedPnl = roundTradeMoney(
    order.shares * (order.price - holding.entryPrice),
  );
  const remainingShares = roundTradeShares(
    Math.max(0, holding.shares - order.shares),
  );
  return {
    success: true,
    proceeds: order.value,
    realisedPnl,
    remainingShares,
    remainingEntryPrice: remainingShares > 0 ? holding.entryPrice : null,
  };
}

const now = Date.now();
const realSix = Array.from({ length: 6 }, (_, index) => ({
  date: new Date(now - (5 - index) * 60_000).toISOString(),
  close: 100 + index,
}));
const realFlatSix = realSix.map((point) => ({ ...point, close: 123.45 }));

assert.deepEqual(
  filterDisplayable({
    "1D": [{ ...realSix[0], synthetic: true }, realSix.at(-1)],
  }),
  {},
);
assert.equal(filterDisplayable({ "1D": realSix })["1D"].length, 6);
assert.equal(filterDisplayable({ "1D": realFlatSix })["1D"].length, 6);
assert.equal(chartDisplayState(realFlatSix), "displayable-flat");
assert.deepEqual(filterDisplayable({ "1M": realSix.slice(0, 3) }), {});
assert.equal(filterDisplayable({ "1M": realSix.slice(0, 4) })["1M"].length, 4);

assert.deepEqual(
  weightedAverage({
    existingShares: 10,
    existingPrice: 100,
    incomingShares: 5,
    incomingPrice: 130,
  }),
  { shares: 15, entryPrice: 110 },
);

assert.deepEqual(
  weightedAverage({
    existingShares: 1.25,
    existingPrice: 88,
    incomingShares: 0.75,
    incomingPrice: 120,
    incomingCost: 90,
  }),
  { shares: 2, entryPrice: 100 },
);

assertResolvedTrade(
  { value: "900", price: "90", shares: "" },
  { value: 900, price: 90, shares: 10 },
);
assertResolvedTrade(
  { value: "200", price: "", shares: "1.25" },
  { value: 200, price: 160, shares: 1.25 },
);
assertResolvedTrade(
  { value: "", price: "45", shares: "4" },
  { value: 180, price: 45, shares: 4 },
);
assertResolvedTrade(
  { value: "100.01", price: "33.336666", shares: "3" },
  { value: 100.01, price: 33.336666, shares: 3 },
);
assert.match(
  resolveTradeOrder({ value: "100", price: "45", shares: "4" }).error ?? "",
  /do not match/,
);
assert.match(
  resolveTradeOrder({ value: "100", price: "0", shares: "" }).error ?? "",
  /Enter any two/,
);

assert.deepEqual(
  simulateTrim({ shares: 10, entryPrice: 100 }, { value: "450", price: "150" }),
  {
    success: true,
    proceeds: 450,
    realisedPnl: 150,
    remainingShares: 7,
    remainingEntryPrice: 100,
  },
);
assert.deepEqual(
  simulateTrim({ shares: 10, entryPrice: 100 }, { shares: "10", price: "90" }),
  {
    success: true,
    proceeds: 900,
    realisedPnl: -100,
    remainingShares: 0,
    remainingEntryPrice: null,
  },
);
assert.equal(
  simulateTrim({ shares: 1, entryPrice: 100 }, { shares: "2", price: "90" })
    .success,
  false,
);
assert.equal(
  simulateTrim(
    { shares: 10, entryPrice: 100 },
    { value: "100", price: "45", shares: "4" },
  ).success,
  false,
);

function baseHolding(overrides = {}) {
  return {
    ticker: "MU",
    company: "Micron",
    sector: "Technology",
    score: 7100,
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
  derivePortfolioHoldingAction(
    baseHolding({ score: 5800, rank: 240, daysSinceReview: 45 }),
    {
      riskTolerance: "moderate",
      cashBalance: 250,
      nowMs: now,
    },
  ).action,
  "review",
);
assert.equal(
  derivePortfolioHoldingAction(
    baseHolding({
      score: 8100,
      rank: 25,
      currentAllocationPct: 5,
      targetAllocationPct: 14,
      actionAlerts: [
        { action: "buy_more", severity: "info", dataUpdatedAt: freshIso },
      ],
    }),
    { riskTolerance: "moderate", cashBalance: 1500, cashDrag: 7, nowMs: now },
  ).action,
  "buy_more",
);
assert.equal(
  derivePortfolioHoldingAction(
    baseHolding({
      score: 5500,
      rank: 200,
      currentAllocationPct: 38,
      targetAllocationPct: 18,
    }),
    {
      riskTolerance: "moderate",
      cashBalance: 500,
      sectorExposurePct: 38,
      nowMs: now,
    },
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
      actionAlerts: [
        { action: "sell", severity: "critical", dataUpdatedAt: freshIso },
      ],
    }),
    { riskTolerance: "moderate", cashBalance: 500, nowMs: now },
  ).action,
  "exit",
);
const staleTrim = derivePortfolioHoldingAction(
  baseHolding({
    score: 5400,
    rank: 260,
    currentAllocationPct: 38,
    targetAllocationPct: 16,
    actionAlerts: [
      { action: "trim", severity: "warning", dataUpdatedAt: staleIso },
    ],
  }),
  { riskTolerance: "moderate", cashBalance: 500, nowMs: now },
);
assert.equal(staleTrim.freshness, "stale");
assert.notEqual(staleTrim.confidence, "high");

function classifyOpportunityRule({
  held = false,
  heldWeak = false,
  exposure = 0,
  score = 7600,
  rank = 60,
  heldScore = 6500,
  targetAllocation = 12,
  currentAllocation = 6,
  cashDrag = 4,
  sectorCap = 26,
  fresh = true,
}) {
  if (!fresh || score < 6500) return null;
  if (held) {
    if (heldWeak) return "Review existing holding";
    if (
      currentAllocation < targetAllocation - 1 &&
      cashDrag >= 2 &&
      exposure <= sectorCap * 0.9
    ) {
      return "Add-more candidate";
    }
    return null;
  }
  if (heldWeak && score >= heldScore + 900 && exposure <= sectorCap * 1.15)
    return "Alternative to review";
  if (exposure <= 3 && score >= 7200) return "Diversification fit";
  if (score >= 8000 && rank <= 50 && exposure <= sectorCap * 0.6)
    return "High-conviction fit";
  if (exposure > sectorCap * 0.75) return null;
  return "Watchlist idea";
}

assert.notEqual(
  classifyOpportunityRule({ held: true, heldWeak: false }),
  "Diversification fit",
);
assert.equal(
  classifyOpportunityRule({ held: true, heldWeak: false }),
  "Add-more candidate",
);
assert.equal(
  classifyOpportunityRule({ held: true, heldWeak: true }),
  "Review existing holding",
);
assert.equal(
  classifyOpportunityRule({ held: false, exposure: 42, score: 7800 }),
  null,
);
assert.equal(
  classifyOpportunityRule({ held: false, exposure: 1, score: 7600 }),
  "Diversification fit",
);
assert.equal(
  classifyOpportunityRule({
    held: false,
    heldWeak: true,
    heldScore: 6100,
    score: 7300,
    exposure: 18,
  }),
  "Alternative to review",
);
assert.equal(
  classifyOpportunityRule({ held: false, exposure: 12, score: 8200, rank: 30 }),
  "High-conviction fit",
);
assert.equal(
  classifyOpportunityRule({ fresh: false, score: 8200, rank: 20 }),
  null,
);
assert.notEqual(
  classifyOpportunityRule({ held: false, exposure: 1, score: 7600 }),
  classifyOpportunityRule({ held: false, exposure: 42, score: 7600 }),
);

const chartHealthSource = readSource("lib/portfolio-chart-health.ts");
assert.match(chartHealthSource, /realPointCount/);
assert.doesNotMatch(
  chartHealthSource,
  /meaningfulPointCount\s*>\s*0\s*&&\s*flat/,
);

const actionEngineSource = readSource("lib/portfolio-action-engine.ts");
assert.match(actionEngineSource, /buy_more/);
assert.match(actionEngineSource, /suggestedTrimRange/);
assert.match(actionEngineSource, /dataUpdatedAt/);
assert.match(actionEngineSource, /freshness/);

const dashboardPortfolioSource = readSource("lib/dashboard-portfolio.ts");
assert.match(
  dashboardPortfolioSource,
  /export async function buildPortfolioOpportunities/,
);
assert.match(dashboardPortfolioSource, /getOneDayMoveMap/);
assert.match(dashboardPortfolioSource, /Review existing holding/);
assert.match(dashboardPortfolioSource, /targetAllocationPct/);

const commandCentreSource = readSource(
  "components/PortfolioCommandCentreRevolut.tsx",
);
assert.match(commandCentreSource, /PortfolioOpportunitiesWidget/);
assert.match(
  commandCentreSource,
  /grid-cols-\[minmax\(190px,1\.35fr\).*minmax\(112px,auto\)\]/s,
);
assert.doesNotMatch(commandCentreSource, /hover:bg-white/);
assert.match(commandCentreSource, /Enter any two fields/);
assert.match(commandCentreSource, /action\.plainEnglishReason/);

const dashboardSource = readSource("app/dashboard/page.tsx");
assert.match(dashboardSource, /SharedPortfolioOpportunitiesWidget/);
assert.doesNotMatch(dashboardSource, /function PortfolioOpportunitiesWidget/);
assert.match(dashboardSource, /portfolioOpportunities.*slice\(0, 2\)/s);
assert.match(
  dashboardSource,
  /<PortfolioDashboardWidget[\s\S]*<SharedPortfolioOpportunitiesWidget[\s\S]*<DashboardBriefing[\s\S]*<RankingsPanel/,
);

const sharedWidgetSource = readSource(
  "components/PortfolioOpportunitiesWidget.tsx",
);
assert.match(sharedWidgetSource, /variant\?: "dashboard" \| "portfolio"/);
assert.match(sharedWidgetSource, /grid-cols-\[34px_minmax\(0,1fr\)\]/);
assert.match(
  sharedWidgetSource,
  /grid h-full min-h-0 grid-rows-\[auto_minmax\(0,1fr\)\]/,
);
assert.match(sharedWidgetSource, /overflow-y-auto/);
assert.match(sharedWidgetSource, /overscroll-contain/);
assert.match(sharedWidgetSource, /tabIndex=\{constrained \? 0 : undefined\}/);
assert.doesNotMatch(sharedWidgetSource, /slice\(0/);
assert.doesNotMatch(sharedWidgetSource, /hover:bg-white/);

const demoStepsSource = readSource("lib/demo/demoSteps.ts");
assert.match(demoStepsSource, /Portfolio-fit opportunities/);
assert.match(demoStepsSource, /Manage holding actions/);
assert.match(demoStepsSource, /Add, import and preferences/);
assert.equal((demoStepsSource.match(/\{\n    view:/g) ?? []).length, 11);

const demoDashboardSource = readSource("components/demo/DemoDashboardView.tsx");
assert.match(demoDashboardSource, /PortfolioOpportunitiesWidget/);
assert.match(demoDashboardSource, /demoOpportunities/);
assert.match(demoDashboardSource, /variant="dashboard"/);

const demoManageSource = readSource(
  "components/demo/DemoPortfolioManageView.tsx",
);
assert.match(demoManageSource, /Manage holding decision panel/);
assert.match(demoManageSource, /Enter any two fields/);
assert.match(demoManageSource, /Add \/ Import/);
assert.match(demoManageSource, /Portfolio preferences/);

const demoInfoSource = readSource("components/demo/DemoInfoBox.tsx");
assert.match(
  demoInfoSource,
  /max-h-\[calc\(100dvh-88px-env\(safe-area-inset-bottom\)\)\]/,
);
assert.match(demoInfoSource, /overflow-y-auto/);
assert.match(demoInfoSource, /placement\?: "floating" \| "rail"/);

const demoTourSource = readSource("components/demo/DemoTourShell.tsx");
assert.match(demoTourSource, /xl:grid-cols-\[minmax\(0,1fr\)_372px\]/);
assert.match(demoTourSource, /placement="rail"/);

const savedPortfolioSource = readSource("components/SavedPortfolio.tsx");
assert.match(savedPortfolioSource, /formatFreshness/);
assert.match(savedPortfolioSource, /Source \$\{formatFreshness/);

console.log("portfolio reliability checks passed");
