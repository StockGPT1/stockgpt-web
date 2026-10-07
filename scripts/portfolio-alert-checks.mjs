import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modules = new Map();
function loadLibrary(name) {
  if (modules.has(name)) return modules.get(name);
  if (name === "@/utils/supabase/server" || name === "@/utils/supabase/admin") return {};
  if (name === "@/lib/yahoo") return { getStockChart: async () => { throw new Error("No live chart calls in checks"); } };
  if (name === "@/lib/notification-summary") return {};
  const module = { exports: {} };
  modules.set(name, module.exports);
  let source = fs.readFileSync(path.join(root, `${name.replace(/^@\//, "")}.ts`), "utf8");
  // Exercise the real private builders without widening the production API.
  if (name === "@/lib/portfolio-alerts") source += "\nexport { buildActionAlert, buildEventAlerts, buildTriggers, enrichHoldingsWithClient };";
  if (name === "@/lib/notifications") source += "\nexport { buildStoredTradeLevelNotifications };";
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", code)(loadLibrary, module, module.exports);
  return module.exports;
}
const { buildActionAlert, buildEventAlerts, buildTriggers, enrichHoldingsWithClient } = loadLibrary("@/lib/portfolio-alerts");
const { buildStoredTradeLevelNotifications } = loadLibrary("@/lib/notifications");
const { hasUsableAlertQuote } = loadLibrary("@/lib/portfolio-alert-data");
const { buildPortfolioOverviewSnapshot } = loadLibrary("@/lib/portfolio-overview");
const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

function context(overrides = {}) {
  return {
    ticker: "TEST", company: "Test", sector: "Industrials", score: 8000, scoreAtEntry: 8000,
    rank: 20, rankAtEntry: 20, rankPercentile: 90, scorePercentile: 80, totalStocks: 500,
    currentPrice: 120, entryPrice: 100, pnlPercent: 20, currentAllocationPct: 10,
    targetAllocationPct: 10, daysHeld: 300, daysSinceReview: 150, isRecentlyAdded: false,
    sectorMomentum: "Mixed", sectorBullishPct: 30, recentNegativeNewsCount: 0,
    recentPositiveNewsCount: 0, latestNegativeHeadline: null, latestPositiveHeadline: null,
    riskTolerance: "moderate", factorDiagnostics: null, quoteConfirmed: true,
    allocationComplete: true, modelConfirmed: true,
    technical: { stopLoss: 90, takeProfit: 140, support: 95, resistance: 140, source: "technical" },
    ...overrides,
  };
}
function warning(title, severity = "warning") { return { severity, title }; }

test("healthy profitable holdings never need review just because a calendar date passed", () => {
  assert.equal(buildActionAlert(context({ daysSinceReview: 3000 }), []), null);
  assert.equal(buildTriggers(context({ daysSinceReview: 3000 })).some((trigger) => trigger.type === "review"), false);
  assert.deepEqual(buildTriggers(context()).map((trigger) => trigger.type), ["stop_loss", "take_profit", "score_floor"]);
});

test("review requires concrete warning events, retains their evidence and expires with them", () => {
  const events = [warning("Rank fell materially"), warning("Negative earnings news", "critical")];
  const alert = buildActionAlert(context(), events);
  assert.equal(alert.type, "review_action");
  assert.ok(alert.evidence.includes(events[0].title));
  assert.ok(alert.evidence.includes(events[1].title));
  assert.equal(buildActionAlert(context(), events.slice(0, 1)), null);
  assert.equal(buildActionAlert(context(), [warning("Score improved", "success"), warning("Routine note", "info")]), null);
});

test("a genuine oversized winner still produces a concrete trim signal", () => {
  const alert = buildActionAlert(context({ currentAllocationPct: 42, targetAllocationPct: 20, pnlPercent: 80 }), []);
  assert.equal(alert.type, "trim_action");
  assert.match(alert.title, /too large/);
});

test("profit alone or absent/stale model rank cannot trigger winner trimming", () => {
  assert.equal(buildActionAlert(context({ pnlPercent: 50 }), []), null);
  assert.equal(buildActionAlert(context({ pnlPercent: 50, rank: null, rankPercentile: 50 }), []), null);
  assert.equal(buildActionAlert(context({ pnlPercent: 50, rankPercentile: 50, modelConfirmed: false }), []), null);
  assert.equal(buildActionAlert(context({ pnlPercent: 50, rankPercentile: 50, quoteConfirmed: false }), []), null);
  const concrete = buildActionAlert(context({ pnlPercent: 50, rankPercentile: 50 }), []);
  assert.equal(concrete.type, "trim_action");
  assert.match(concrete.title, /protect gains/);
});

test("missing valuation data cannot manufacture an oversized-position trim", () => {
  assert.equal(buildActionAlert(context({ currentAllocationPct: 100, targetAllocationPct: 20, allocationComplete: false }), []), null);
});

function fakeClient(rows) {
  const market = Array.from({ length: 500 }, (_, index) => ({ sector: "Industrials", rank: index + 1, score: 10000 - index * 10 }));
  return { from(table) {
    let columns;
    const query = {
      select(value) { columns = value; return query; },
      in() { return query; }, gte() { return query; }, overlaps() { return query; }, limit() { return query; },
      then(resolve) { return Promise.resolve({ data: table === "stock_rankings" ? columns === "sector, rank, score" ? market : rows : [], error: null }).then(resolve); },
    };
    return query;
  } };
}
function storedHolding(ticker) {
  return { ticker, entry_price: 100, score_at_entry: 8000, rank_at_entry: 20, shares: 10,
    allocation_pct: null, added_at: hoursAgo(24 * 300), last_reviewed_at: hoursAgo(24 * 150) };
}
function stock(ticker, overrides = {}) {
  return { ticker, company: ticker, sector: "Industrials", rank: 20, score: 8000, price: 150,
    updated_at: hoursAgo(1), last_price_update: hoursAgo(1), last_ranking_update: hoursAgo(1), ...overrides };
}

test("the actual enrichment pipeline does not inflate allocation alerts when another quote is missing", async () => {
  const [priced] = await enrichHoldingsWithClient(fakeClient([stock("A"), stock("B", { price: null })]), [storedHolding("A"), storedHolding("B")]);
  assert.equal(priced.currentAllocationPct, 100);
  assert.equal(priced.actionAlerts.length, 0);
});

test("the actual enrichment pipeline retains profitable concentration alerts with complete prices", async () => {
  const [priced] = await enrichHoldingsWithClient(fakeClient([stock("A"), stock("B")]), [storedHolding("A"), storedHolding("B")]);
  assert.equal(priced.actionAlerts[0].type, "trim_action");
  assert.match(priced.actionAlerts[0].title, /too large/);
});

test("the actual enrichment pipeline does not treat a missing rank as a neutral weak rank", async () => {
  const tickers = ["A", "B", "C", "D", "E"];
  const rows = tickers.map((ticker) => stock(ticker, ticker === "A" ? { rank: null, score: 6000 } : {}));
  const holdings = tickers.map((ticker) => ({ ...storedHolding(ticker), score_at_entry: ticker === "A" ? 6000 : 8000 }));
  const [priced] = await enrichHoldingsWithClient(fakeClient(rows), holdings);
  assert.equal(priced.rank, null);
  assert.equal(priced.pnlPercent, 50);
  assert.equal(priced.actionAlerts.length, 0);
});

test("the actual enrichment pipeline does not mistake a missing score for a score collapse", async () => {
  const tickers = ["A", "B", "C", "D", "E"];
  const rows = tickers.map((ticker) => stock(ticker, { price: 120, rank: 300, score: ticker === "A" ? null : 8000 }));
  const holdings = tickers.map((ticker) => ({ ...storedHolding(ticker), rank_at_entry: 300 }));
  const [priced] = await enrichHoldingsWithClient(fakeClient(rows), holdings);
  assert.equal(priced.currentAllocationPct, 20);
  assert.equal(priced.score, 0);
  assert.equal(priced.actionAlerts.length, 0);
  assert.equal(priced.eventAlerts.some((alert) => alert.type === "score_event"), false);
});

test("score declines require real current values and cached diagnostics cannot confirm deterioration", () => {
  for (const score of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const ctx = context({ score, rankPercentile: 50, pnlPercent: 20 });
    assert.equal(buildActionAlert(ctx, buildEventAlerts(ctx)), null);
    assert.equal(buildEventAlerts(ctx).some((alert) => alert.type === "score_event"), false);
  }
  const cached = context({ score: 5000, rankPercentile: 50, modelConfirmed: false, diagnosticsConfirmed: false,
    factorDiagnostics: { previous_score: 8000, current_score: 4000, momentum_change: -0.2, quality_change: -0.2 } });
  assert.equal(buildActionAlert(cached, buildEventAlerts(cached)), null);
  assert.equal(buildEventAlerts(cached).some((alert) => alert.type === "score_event"), false);
  const freshDecline = context({ score: 6000, rankPercentile: 50 });
  assert.equal(buildActionAlert(freshDecline, buildEventAlerts(freshDecline)).type, "trim_action");
  const independentNews = { ...cached, recentNegativeNewsCount: 3, latestNegativeHeadline: "New guidance cut" };
  assert.equal(buildEventAlerts(independentNews).find((alert) => alert.type === "news_event").severity, "warning");
});

test("a fresh model cannot make a stale price current for allocation or trade-level signals", async () => {
  const [priced] = await enrichHoldingsWithClient(fakeClient([stock("A", { last_price_update: hoursAgo(96) })]), [storedHolding("A")]);
  assert.equal(priced.actionAlerts.length, 0);
  assert.equal(hasUsableAlertQuote(priced.currentPrice, priced.priceUpdatedAt), false);
});

test("end-of-day and weekend quotes remain eligible, unknown/old/invalid quotes do not", () => {
  assert.equal(hasUsableAlertQuote(100, hoursAgo(70)), true);
  for (const timestamp of [hoursAgo(96), null, "invalid"]) assert.equal(hasUsableAlertQuote(100, timestamp), false);
  for (const price of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(hasUsableAlertQuote(price, hoursAgo(1)), false);
});

test("saved risk and target breaches remain meaningful even when a holding is profitable", () => {
  const input = { portfolioId: "p", portfolioName: "Portfolio", ticker: "TEST", company: "Test",
    currentPrice: 120, priceUpdatedAt: hoursAgo(1), riskLevelAtEntry: 90, targetLevelAtEntry: 110 };
  const results = buildStoredTradeLevelNotifications(input);
  assert.equal(results.length, 1);
  assert.equal(results[0].severity, "success");
  const riskResults = buildStoredTradeLevelNotifications({ ...input, currentPrice: 85 });
  assert.equal(riskResults.length, 1);
  assert.equal(riskResults[0].severity, "critical");
  assert.deepEqual(buildStoredTradeLevelNotifications({ ...input, priceUpdatedAt: hoursAgo(96) }), []);
  assert.deepEqual(buildStoredTradeLevelNotifications({ ...input, riskLevelAtEntry: Number.NaN, targetLevelAtEntry: -1 }), []);
});

test("Overview removes neutral/date nudges and cannot flag concentration from a partial valuation", () => {
  const base = { ticker: "A", company: "A", sector: "Industrials", shares: 10, currentPrice: 100, currentValue: 1000,
    totalPnLDollars: 50, targetAllocationPct: 20, daysSinceReview: 100, actionAlerts: [], eventAlerts: [] };
  const result = buildPortfolioOverviewSnapshot({ holdings: [base, { ...base, ticker: "B", currentPrice: 0, currentValue: 0 }], cashBalance: 0, riskTolerance: "moderate" });
  assert.deepEqual(result.reviews.map((review) => review.title), ["Price unavailable"]);
  const neutral = buildPortfolioOverviewSnapshot({ holdings: [{ ...base, targetAllocationPct: null, eventAlerts: [{ action: "none", severity: "success", title: "Healthy score", priority: 10 }] }], cashBalance: 9000, riskTolerance: "moderate" });
  assert.deepEqual(neutral.reviews, []);
});
