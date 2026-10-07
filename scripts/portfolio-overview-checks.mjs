import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadedLibraries = new Map();
function loadLibrary(name) {
  if (loadedLibraries.has(name)) return loadedLibraries.get(name);
  const loaded = { exports: {} };
  loadedLibraries.set(name, loaded.exports);
  const file = path.join(root, `${name.replace(/^@\//, "")}.ts`);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", code)(loadLibrary, loaded, loaded.exports);
  return loaded.exports;
}
const { buildPortfolioOverviewSnapshot } = loadLibrary("@/lib/portfolio-overview");

function holding(ticker, value = 100, overrides = {}) {
  return {
    ticker, company: `${ticker} Company`, sector: "Technology", currentPrice: 20,
    entryPrice: 10, shares: value / 20, currentValue: value, costBasis: value / 2,
    totalPnLDollars: value / 2, pnlPercent: 100, pnlDollars: 10,
    currentAllocationPct: 0, targetAllocationPct: null, score: 7000, maxScore: 10000,
    rank: 25, actionAlerts: [], eventAlerts: [], daysSinceReview: 10,
    ...overrides,
  };
}
const snapshot = (holdings, cashBalance = 0, overrides = {}) => buildPortfolioOverviewSnapshot({ holdings, cashBalance, riskTolerance: "moderate", ...overrides });
function close(actual, expected) { assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} does not equal ${expected}`); }

test("allocation includes cash, groups remaining holdings, and preserves input currency units", () => {
  const holdings = [
    holding("A", 1237), holding("B", 889.24), holding("C", 864.96),
    holding("D", 829.49), holding("E", 538.2), holding("F", 250),
  ];
  const result = snapshot(holdings, 1275.11);
  close(result.holdingsValue, 4608.89);
  close(result.totalValue, 5884);
  assert.equal(result.cashValue, 1275.11);
  assert.equal(result.valuationComplete, true);
  assert.equal(result.allocationAvailable, true);
  assert.deepEqual(result.allocations.map((row) => row.key), ["holding-A", "holding-B", "holding-C", "holding-D", "other", "cash"]);
  close(result.allocations.find((row) => row.kind === "other").value, 788.2);
  close(result.allocations[0].percentage, 1237 / 5884 * 100);
  close(result.cashPercentage, 1275.11 / 5884 * 100);
  close(result.allocations.reduce((sum, row) => sum + row.value, 0), result.totalValue);
  close(result.allocations.reduce((sum, row) => sum + row.percentage, 0), 100);
  assert.equal(result.allocations.reduce((sum, row) => sum + Math.round(row.displayPercentage * 10), 0), 1000);
});

test("display percentages reconcile for thirds while actual proportions remain precise", () => {
  const result = snapshot([holding("A", 1), holding("B", 1)], 1);
  result.allocations.forEach((row) => close(row.percentage, 100 / 3));
  assert.equal(result.allocations.reduce((sum, row) => sum + Math.round(row.displayPercentage * 10), 0), 1000);
  assert.deepEqual(result.allocations.map((row) => row.displayPercentage).slice().sort(), [33.3, 33.3, 33.4]);
});

test("gain and loss contributors use unrealised money rather than per-share or percentage returns", () => {
  const largestGain = holding("GAIN", 2000, { totalPnLDollars: 500, pnlPercent: 1, pnlDollars: 1 });
  const largestLoss = holding("LOSS", 1000, { totalPnLDollars: -450, pnlPercent: -10, pnlDollars: -1 });
  const result = snapshot([
    holding("HOT", 100, { totalPnLDollars: 99, pnlPercent: 990, pnlDollars: 999 }),
    largestGain,
    holding("COLD", 50, { totalPnLDollars: -40, pnlPercent: -80, pnlDollars: -999 }),
    largestLoss,
    holding("MISSING", 0, { shares: 10, currentPrice: 0, totalPnLDollars: -99999, pnlPercent: -100 }),
    holding("NONFINITE", 100, { totalPnLDollars: Number.NaN }),
    holding("CLOSED", 0, { shares: 0, totalPnLDollars: 999999 }),
  ]);
  assert.strictEqual(result.gainContributor, largestGain);
  assert.strictEqual(result.lossContributor, largestLoss);
  assert.equal(result.missingPriceCount, 1);
  assert.equal(result.valuationComplete, false);
});

test("missing quotes mark a partial valuation and cannot become apparent loss leaders", () => {
  const result = snapshot([
    holding("GOOD", 100, { sector: "Industrials", totalPnLDollars: 5 }),
    holding("UNKNOWN", 0, { shares: 10, currentPrice: Number.NaN, sector: null, totalPnLDollars: -1000 }),
  ], 100);
  assert.equal(result.totalValue, 200);
  assert.equal(result.cashPercentage, 50);
  assert.equal(result.allocationAvailable, true);
  assert.equal(result.valuationComplete, false);
  assert.equal(result.missingPriceCount, 1);
  assert.equal(result.holdingsCount, 2);
  assert.equal(result.pricedHoldingsCount, 1);
  assert.equal(result.unknownSectorCount, 0);
  assert.equal(result.sectorCount, 1);
  assert.equal(result.lossContributor, null);
  assert.equal(result.reviews[0].key, "UNKNOWN");
  assert.equal(result.reviews[0].title, "Price unavailable");
});

test("priced holdings without a sector remain visible as Unknown exposure", () => {
  const result = snapshot([
    holding("KNOWN", 60, { sector: "Industrials" }),
    holding("UNKNOWN", 40, { sector: " " }),
  ], 100);
  assert.equal(result.valuationComplete, true);
  assert.equal(result.sectorCount, 2);
  assert.equal(result.unknownSectorCount, 1);
  assert.equal(result.reviews.find((review) => review.key === "UNKNOWN").title, "Sector unclassified");
  close(result.allocations.find((row) => row.label === "UNKNOWN").percentage, 20);
});

test("a retained valuation without a usable quote stays out of available allocation", () => {
  const result = snapshot([
    holding("GOOD", 100),
    holding("STALE", 900, { currentPrice: 0, totalPnLDollars: 800 }),
  ], 100);
  assert.equal(result.holdingsCount, 2);
  assert.equal(result.pricedHoldingsCount, 1);
  assert.equal(result.totalValue, 200);
  assert.equal(result.holdingsValue, 100);
  assert.equal(result.valuationComplete, false);
  assert.ok(!result.allocations.some((row) => row.label === "STALE"));
  assert.equal(result.gainContributor.ticker, "GOOD");
});

test("reviews retain observed alerts and select one primary reason in priority order", () => {
  const result = snapshot([
    holding("MISSING", 0, { shares: 10, currentPrice: 0, daysSinceReview: 100, actionAlerts: [{ title: "Existing alert", priority: 100 }] }),
    holding("ALERT", 10, { daysSinceReview: 100, actionAlerts: [{ title: "First observation", priority: 10 }, { title: "Higher priority observation", priority: 20 }] }),
    holding("TARGET", 50, { targetAllocationPct: 2, daysSinceReview: 100 }),
    holding("EVENT", 10, { daysSinceReview: 100, eventAlerts: [{ title: "Recorded event", priority: 10 }] }),
    holding("OVERDUE", 10, { daysSinceReview: 31 }),
    holding("SECTOR", 10, { sector: " ", daysSinceReview: 10 }),
  ], 500);
  assert.deepEqual(result.reviews.map((review) => review.key), ["MISSING", "ALERT", "TARGET", "EVENT", "OVERDUE", "SECTOR"]);
  assert.equal(result.reviews.find((review) => review.key === "ALERT").detail, "Higher priority observation");
  assert.equal(result.reviews.find((review) => review.key === "EVENT").detail, "Recorded event");
  assert.match(result.reviews.find((review) => review.key === "OVERDUE").detail, /31 days/);
  assert.equal(new Set(result.reviews.map((review) => review.key)).size, result.reviews.length);
});

test("sector concentration uses total value including cash and creates one sector review", () => {
  const result = snapshot([
    holding("TECH-A", 40), holding("TECH-B", 40),
    holding("OTHER", 20, { sector: "Industrials" }),
  ], 100);
  assert.equal(result.totalValue, 200);
  const reviews = result.reviews.filter((review) => review.title === "Sector concentration");
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].key, "TECH-A");
  assert.match(reviews[0].detail, /40\.0%/);
  assert.equal(result.reviews.filter((review) => review.title === "Position concentration").length, 0);
});

test("empty and cash-only portfolios provide finite, honest allocation states", () => {
  const empty = snapshot([]);
  assert.equal(empty.totalValue, 0);
  assert.equal(empty.cashPercentage, 0);
  assert.equal(empty.allocationAvailable, false);
  assert.equal(empty.valuationComplete, true);
  assert.deepEqual(empty.allocations, []);
  assert.deepEqual(empty.reviews, []);
  assert.equal(empty.gainContributor, null);
  assert.equal(empty.lossContributor, null);
  const cash = snapshot([], 250);
  assert.equal(cash.totalValue, 250);
  assert.equal(cash.holdingsValue, 0);
  assert.equal(cash.holdingsCount, 0);
  assert.equal(cash.sectorCount, 0);
  assert.equal(cash.allocations.length, 1);
  assert.equal(cash.allocations[0].kind, "cash");
  assert.equal(cash.allocations[0].percentage, 100);
  assert.equal(cash.allocations[0].displayPercentage, 100);
});

test("invalid monetary inputs cannot manufacture allocation or exposure reviews", () => {
  for (const cash of [Number.NaN, -20]) {
    const result = snapshot([holding("A", 80, { targetAllocationPct: 20 })], cash);
    assert.equal(result.allocationAvailable, false);
    assert.equal(result.valuationComplete, false);
    assert.deepEqual(result.allocations, []);
    assert.deepEqual(result.reviews, []);
    assert.equal(Number.isFinite(result.totalValue), true);
    assert.equal(Number.isFinite(result.cashPercentage), true);
  }
});

test("a missing valuation is reported and cannot become a contributor or exposure claim", () => {
  const result = snapshot([
    holding("GOOD", 100),
    holding("INVALID", 100, { currentValue: Number.NaN, totalPnLDollars: 99999 }),
  ], 100);
  assert.equal(result.missingValueCount, 1);
  assert.equal(result.missingPriceCount, 0);
  assert.equal(result.valuationComplete, false);
  assert.equal(result.allocationAvailable, false);
  assert.equal(result.totalValue, 200);
  assert.equal(result.gainContributor.ticker, "GOOD");
  assert.deepEqual(result.reviews.map((review) => review.title), ["Valuation unavailable"]);
});

test("position review thresholds follow the saved risk profile", () => {
  const holdings = [holding("A", 25), holding("B", 75, { sector: "Industrials" })];
  const moderate = snapshot(holdings);
  const aggressive = snapshot(holdings, 0, { riskTolerance: "aggressive" });
  assert.equal(moderate.reviews.find((review) => review.key === "A").title, "Position concentration");
  assert.ok(!aggressive.reviews.some((review) => review.key === "A"));
});

test("closed positions do not inflate current invested value, sector or holding counts", () => {
  const result = snapshot([
    holding("OPEN", 100, { sector: "Industrials" }),
    holding("CLOSED", 500, { shares: 0, sector: "Technology", totalPnLDollars: 1000 }),
  ], 100);
  assert.equal(result.holdingsValue, 100);
  assert.equal(result.totalValue, 200);
  assert.equal(result.holdingsCount, 1);
  assert.equal(result.sectorCount, 1);
  assert.ok(!result.allocations.some((row) => row.label === "CLOSED"));
  assert.equal(result.gainContributor.ticker, "OPEN");
});

test("computing the overview preserves input holdings and alert order", () => {
  const a = holding("A", 25, { actionAlerts: [{ title: "Low", priority: 1 }, { title: "High", priority: 10 }] });
  const b = holding("B", 75);
  const holdings = [a, b];
  const before = structuredClone(holdings);
  for (const item of holdings) { Object.freeze(item.actionAlerts); Object.freeze(item.eventAlerts); Object.freeze(item); }
  Object.freeze(holdings);
  snapshot(holdings, 50);
  assert.deepEqual(holdings, before);
});
