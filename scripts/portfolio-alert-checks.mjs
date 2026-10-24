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
let notificationViewer = { supabase: null, user: null };
const afterCallbacks = [];
const savedSummaries = [];
const chartCalls = [];
function loadLibrary(name) {
  if (modules.has(name)) return modules.get(name);
  if (name === "@/utils/supabase/server" || name === "@/utils/supabase/admin") return {};
  if (name === "next/server") return { after: callback => afterCallbacks.push(callback) };
  if (name === "@/lib/server-viewer") return { getServerViewer: async () => notificationViewer };
  if (name === "@/lib/yahoo") return { getStockChart: async ticker => { chartCalls.push(ticker); throw new Error("No live chart calls in checks"); } };
  if (name === "@/lib/notification-summary") return { saveUnreadNotificationSummary: async (userId, unreadCount) => savedSummaries.push({ userId, unreadCount }) };
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
const { buildActionAlert, buildEventAlerts, buildTriggers, enrichHoldingsWithClient, enrichHoldingGroups } = loadLibrary("@/lib/portfolio-alerts");
const { buildStoredTradeLevelNotifications, getUserNotifications } = loadLibrary("@/lib/notifications");
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

function inboxClient({ stocks = [], portfolios = [], holdings = [], dismissals = [], news = [], dismissalError = null } = {}) {
  const calls = [];
  const market = Array.from({ length: 500 }, (_, index) => ({ sector: "Industrials", rank: index + 1, score: 10000 - index * 10 }));
  const tables = { stock_rankings: stocks, stock_factor_diagnostics: [], user_portfolios: portfolios, portfolio_holdings: holdings, notification_dismissals: dismissals, news_articles: news };
  return { calls, from(table) {
    const call = { table, columns: null, filters: [], limit: null };
    const query = {
      select(columns) { call.columns = columns; return query; },
      eq(key, value) { call.filters.push(["eq", key, value]); return query; },
      is(key, value) { call.filters.push(["is", key, value]); return query; },
      in(key, values) { call.filters.push(["in", key, values]); return query; },
      overlaps(key, values) { call.filters.push(["overlaps", key, values]); return query; },
      gte() { return query; }, order() { return query; },
      limit(limit) { call.limit = limit; return query; },
      then(resolve) {
        calls.push(call);
        let data = call.columns === "sector, rank, score" ? market : tables[table] ?? [];
        for (const [operator, key, value] of call.filters) {
          data = data.filter(row => operator === "in" ? value.includes(row[key]) : operator === "overlaps" ? row[key].some(ticker => value.includes(ticker)) : row[key] === value);
        }
        if (call.limit !== null) data = data.slice(0, call.limit);
        return Promise.resolve({ data, error: table === "notification_dismissals" ? dismissalError : null }).then(resolve);
      },
    };
    return query;
  } };
}

test("two portfolios share actual enrichment reads and chart work without mixing risk or sizing", async t => {
  const previousTechnicalSetting = process.env.PORTFOLIO_TECHNICAL_CHARTS;
  process.env.PORTFOLIO_TECHNICAL_CHARTS = "true";
  t.after(() => {
    if (previousTechnicalSetting === undefined) delete process.env.PORTFOLIO_TECHNICAL_CHARTS;
    else process.env.PORTFOLIO_TECHNICAL_CHARTS = previousTechnicalSetting;
  });
  const tickers = ["A", "B", "C", "D"];
  const supabase = inboxClient({ stocks: tickers.map(ticker => stock(ticker)) });
  const beforeCharts = chartCalls.length;
  const [conservative, aggressive] = await enrichHoldingGroups(supabase, [
    { holdings: tickers.map(storedHolding), riskTolerance: "conservative" },
    { holdings: tickers.map(ticker => ({ ...storedHolding(ticker), shares: 5 })), riskTolerance: "aggressive" },
  ]);
  assert.equal(supabase.calls.length, 4, "eight per-portfolio reads become four shared reads for identical holdings");
  assert.equal(supabase.calls.filter(call => call.columns === "sector, rank, score").length, 1);
  assert.equal(supabase.calls.filter(call => call.table === "stock_factor_diagnostics").length, 1);
  assert.equal(chartCalls.length - beforeCharts, 4, "one calculation per ticker, rather than one per holding in each portfolio");
  for (const holding of conservative) {
    assert.equal(holding.currentAllocationPct, 25);
    assert.equal(holding.shares, 10);
    assert.equal(holding.actionAlerts[0].type, "trim_action");
  }
  for (const holding of aggressive) {
    assert.equal(holding.currentAllocationPct, 25);
    assert.equal(holding.shares, 5);
    assert.deepEqual(holding.actionAlerts, []);
  }
});

test("shared enrichment preserves each distinct portfolio's capped news window", async () => {
  const articles = [
    ...Array.from({ length: 300 }, (_, index) => ({ title: `A story ${index}`, impact: "positive", affected_tickers: ["A"], published_at: hoursAgo(1) })),
    ...Array.from({ length: 5 }, (_, index) => ({ title: `B warning ${index}`, impact: "negative", affected_tickers: ["B"], published_at: hoursAgo(1) })),
  ];
  const supabase = inboxClient({ stocks: [stock("A"), stock("B")], news: articles });
  const [, second] = await enrichHoldingGroups(supabase, [{ holdings: [storedHolding("A")] }, { holdings: [storedHolding("B")] }]);
  const newsReads = supabase.calls.filter(call => call.table === "news_articles");
  assert.equal(newsReads.length, 2);
  assert.ok(newsReads.every(call => call.limit === 300));
  assert.equal(second[0].eventAlerts.find(alert => alert.type === "news_event").severity, "warning", "B's news cannot be crowded out by A's 300 stories");
});

test("notification inbox keeps owner filtering, legacy dismissals and fresh stored-level rules", async () => {
  const tickers = ["A", "B", "C", "D", "E"];
  const supabase = inboxClient({
    stocks: tickers.map(ticker => stock(ticker, { price: 120, last_price_update: hoursAgo(["D", "E"].includes(ticker) ? 96 : 1) })),
    portfolios: [{ id: "mine", name: "My portfolio", risk_tolerance: "moderate", user_id: "owner", archived_at: null }, { id: "other", user_id: "someone-else", archived_at: null }],
    holdings: [...tickers.map(ticker => ({ ...storedHolding(ticker), portfolio_id: "mine", risk_level_at_entry: ["B", "E"].includes(ticker) ? 130 : null, target_level_at_entry: ["A", "D"].includes(ticker) ? 110 : null })), { ...storedHolding("PRIVATE"), portfolio_id: "other", risk_level_at_entry: 999 }],
    dismissals: [{ user_id: "owner", alert_key: "A:take_profit_hit:110.00" }, { user_id: "someone-else", alert_key: "mine:B:entry_risk_level_hit:130.00" }],
  });
  notificationViewer = { supabase, user: { id: "owner" } };
  afterCallbacks.length = savedSummaries.length = 0;
  const result = await getUserNotifications({ includeDismissed: true });
  assert.equal(result.status, "ok");
  assert.deepEqual(result.unread.map(alert => alert.ticker), ["B"]);
  assert.deepEqual(result.read.map(alert => alert.ticker), ["A"]);
  assert.equal(result.unread[0].severity, "critical");
  assert.ok([...result.unread, ...result.read].every(alert => alert.portfolioId === "mine" && alert.type === "price_event"));
  assert.deepEqual(supabase.calls.find(call => call.table === "portfolio_holdings").filters, [["in", "portfolio_id", ["mine"]]]);
  assert.equal(savedSummaries.length, 0, "Redis and DB summary persistence must not block the inbox response");
  assert.equal(afterCallbacks.length, 1);
  await afterCallbacks[0]();
  assert.deepEqual(savedSummaries, [{ userId: "owner", unreadCount: 1 }]);
});

test("empty and unauthenticated inboxes avoid enrichment and defer any summary write", async () => {
  const supabase = inboxClient();
  notificationViewer = { supabase, user: { id: "owner" } };
  afterCallbacks.length = savedSummaries.length = 0;
  assert.equal((await getUserNotifications()).status, "ok");
  assert.deepEqual(supabase.calls.map(call => call.table), ["user_portfolios"]);
  assert.equal(savedSummaries.length, 0);
  await afterCallbacks[0]();
  assert.deepEqual(savedSummaries, [{ userId: "owner", unreadCount: 0 }]);
  notificationViewer = { supabase, user: null };
  afterCallbacks.length = 0;
  assert.equal((await getUserNotifications()).status, "unauthenticated");
  assert.equal(afterCallbacks.length, 0);
  assert.equal(supabase.calls.length, 1);
});

test("market data sharing ends with each enrichment request", async () => {
  const current = stock("A", { price: 120 });
  const supabase = inboxClient({ stocks: [current] });
  const groups = [{ holdings: [storedHolding("A")] }];
  const [first] = await enrichHoldingGroups(supabase, groups);
  current.price = 90;
  const [second] = await enrichHoldingGroups(supabase, groups);
  assert.equal(first[0].currentPrice, 120);
  assert.equal(second[0].currentPrice, 90);
  assert.equal(supabase.calls.filter(call => call.table === "stock_factor_diagnostics").length, 2);
});

test("a failed dismissal lookup cannot resurrect read alerts", async t => {
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });
  notificationViewer = {
    supabase: inboxClient({
      portfolios: [{ id: "mine", user_id: "owner", archived_at: null }],
      holdings: [{ ...storedHolding("A"), portfolio_id: "mine" }],
      dismissalError: { message: "Unavailable" },
    }),
    user: { id: "owner" },
  };
  afterCallbacks.length = 0;
  assert.equal((await getUserNotifications()).status, "error");
  assert.equal(afterCallbacks.length, 0);
});

function notificationsPage({ subscribed, inbox }) {
  let inboxCalls = 0;
  const code = ts.transpileModule(fs.readFileSync(path.join(root, "app/(workspace)/notifications/page.tsx"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  const modules = {
    "@/lib/server-viewer": { getServerViewer: async () => ({ user: { id: "owner" } }), getViewerProfile: async () => ({ subscription_status: subscribed ? "active" : null }) },
    "@/lib/subscription": { hasActiveSubscription: status => status === "active" },
    "@/lib/notifications": { getUserNotifications: () => { inboxCalls++; return inbox; } },
    "next/navigation": { redirect: target => { throw new Error(`Redirect ${target}`); } },
  };
  new Function("require", "module", "exports", code)(name => {
    if (modules[name]) return modules[name];
    if (name.startsWith("@/components/")) return new Proxy({}, { get: () => () => null });
    if (name === "next/link") return { __esModule: true, default: () => null };
    return require(name);
  }, module, module.exports);
  return { Page: module.exports.default, inboxCalls: () => inboxCalls };
}

test("alerts page returns its page shell without waiting for pending inbox enrichment", async () => {
  const { Page, inboxCalls } = notificationsPage({ subscribed: true, inbox: new Promise(() => {}) });
  let rendered = false;
  const pending = Page().then(page => { rendered = true; return page; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(rendered, true, "a slow alert query must not suspend the entire route");
  assert.equal(inboxCalls(), 1);
  const page = await pending;
  assert.equal(page.props.activePath, "/notifications");
});

test("locked alerts page does not start personalised alert reads", async () => {
  const { Page, inboxCalls } = notificationsPage({ subscribed: false, inbox: Promise.resolve({ unread: [], read: [] }) });
  await Page();
  assert.equal(inboxCalls(), 0);
});

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
