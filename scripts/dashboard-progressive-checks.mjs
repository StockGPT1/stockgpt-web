import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const jsx = require("react/jsx-runtime");
function load(file, imports) {
  const compiled = ts.transpileModule(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    if (name === "react/jsx-runtime") return jsx;
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error(`Unexpected dependency ${name}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function find(tree, predicate) {
  if (Array.isArray(tree)) return tree.map((child) => find(child, predicate)).find(Boolean);
  if (!tree || typeof tree !== "object") return undefined;
  return predicate(tree) ? tree : find(tree.props?.children, predicate);
}
function observe(promise) {
  const state = { ready: false };
  promise.then(() => { state.ready = true; });
  return state;
}
const nextTurn = () => new Promise(setImmediate);
const MobileDashboard = () => null;
const chartResult = {
  chartData: { "1M": [{ date: "2026-10-01", close: 1000 }, { date: "2026-10-02", close: 1100 }] },
  meta: { source: "snapshots", health: { displayState: "ready", latestSnapshotAt: "2026-10-02" } },
};
const marketResult = { "1D": [{ date: "2026-10-01", close: 100 }, { date: "2026-10-02", close: 102 }] };
const article = {
  id: "news-1", title: "Company publishes results", url: "https://example.com/results", summary: "Revenue increased.",
  source: "Publisher", published_at: "2026-10-22T08:00:00Z", affectedStocks: [{ ticker: "AAPL" }],
};
const ideaRows = () => [{ ticker: "MSFT", company: "Microsoft", sector: "Technology", rank: 5, score: 9000, price: 400, updated_at: new Date().toISOString() }];

function harness({ authenticated = true, nativeApp = true } = {}) {
  const chart = deferred(), market = deferred(), news = deferred(), ideas = deferred();
  const calls = [];
  const summary = { totalValue: 1100, totalPnl: 100, holdingsValue: 1000, holdingsCount: 1, cashDrag: 9.1 };
  const rankings = [{ id: "stock-1", ticker: "AAPL", company: "Apple", score: 12000, rank: 1, price: 100 }];
  const holding = { ticker: "AAPL", shares: 10, currentPrice: 100, currentValue: 1000, currentAllocationPct: 90.9, sector: "Energy", score: 12000, rankPercentile: 90 };
  const rows = {
    user_portfolios: [{ id: "owned", name: "My portfolio", cash_balance: 100, investment_amount: 1000, risk_tolerance: "moderate", created_at: "2026-10-01" }],
    portfolio_holdings: [{ portfolio_id: "owned", ticker: "AAPL", shares: 10, entry_price: 90 }],
    portfolio_transactions: [],
  };
  const supabase = {
    from(table) {
      const call = { table, filters: [], columns: "" };
      calls.push(call);
      const query = {
        select(columns) { call.columns = columns; return query; },
        then(resolve, reject) {
          const response = table === "stock_rankings"
            ? call.columns.includes("last_price_update") ? ideas.promise.then(data => ({ data })) : Promise.resolve({ data: rankings, count: 1 })
            : Promise.resolve({ data: rows[table] });
          return response.then(resolve, reject);
        },
      };
      for (const method of ["eq", "in", "is", "order", "limit", "gte"]) {
        query[method] = (...args) => { call.filters.push([method, ...args]); return query; };
      }
      return query;
    },
  };
  const portfolioLibrary = load("lib/dashboard-portfolio.ts", {
    "@/lib/portfolio-health": { buildPortfolioHealthSummary: () => summary },
    "@/lib/portfolio-alerts": { enrichHoldings: async () => [holding] },
    "@/lib/portfolio-page-chart": { buildPortfolioPageChartResult: options => { calls.push({ chartOwner: options.ownerId }); return chart.promise; } },
    "@/lib/portfolio-action-engine": { derivePortfolioHoldingAction: () => ({ action: "hold" }) },
    "@/lib/yahoo": { getOneDayMoveMap: async () => new Map([["MSFT", { changePct: 2.5 }]]) },
  });
  const page = load("app/(workspace)/dashboard/page.tsx", {
    react: require("react"),
    "next/headers": { headers: async () => ({ get: () => nativeApp ? "StockGPTApp" : "Browser" }) },
    "next/navigation": { redirect: path => { throw new Error(`redirect:${path}`); } },
    "@/components/AppShell": { AppShell: () => null },
    "@/components/DesktopDashboardExperience": { DesktopDashboardExperience: () => null },
    "@/components/MobileDashboardExperience": { MobileDashboardExperience: MobileDashboard },
    "@/components/MobileMarketMovers": { MobileMarketMoversPortal: () => null },
    "@/components/InlinePagePending": { InlinePagePending: () => null },
    "@/components/NativePageRegistration": { NativePageRegistration: () => null },
    "@/lib/server-viewer": {
      getServerViewer: async () => ({ supabase, user: authenticated ? { id: "owner", user_metadata: { full_name: "Joe Fisher" } } : null }),
      getViewerProfile: async () => { calls.push({ profile: true }); return { subscription_status: "active" }; },
    },
    "@/lib/subscription": { hasActiveSubscription: status => status === "active" },
    "@/lib/yahoo": {
      getSP500Chart: () => { calls.push({ market: true }); return market.promise; },
      getLatestPriceFromChart: data => data["1D"]?.at(-1)?.close ?? null,
    },
    "@/lib/rank-history": { getRankSnapshotMapAround24hAgo: async () => { calls.push({ snapshots: true }); return new Map(); } },
    "@/lib/dashboard-portfolio": portfolioLibrary,
    "@/lib/world-news-feed": { getCachedWorldNewsFeed: () => { calls.push({ news: true }); return news.promise; } },
  }).default;
  async function renderContent() {
    const shell = await page({ searchParams: Promise.resolve({ portfolio: "owned" }) });
    const content = find(shell, node => typeof node.type === "function" && node.type.name === "DashboardContent");
    assert.ok(content, "The real page must expose its server content inside the shared frame");
    return content.type(content.props);
  }
  return { page, renderContent, portfolioLibrary, supabase, calls, summary, rankings, chart, market, news, ideas };
}

test("native dashboard renders real summary and rankings before optional data and resolves sections independently", async () => {
  const app = harness();
  let rendered;
  const rendering = app.renderContent().then(tree => { rendered = tree; });
  await nextTurn();
  assert.ok(rendered, "Chart, news, market and research promises must not gate useful home content");
  await rendering;
  const props = find(rendered, node => node.type === MobileDashboard).props;
  assert.strictEqual(props.summary, app.summary);
  assert.strictEqual(props.rankings, app.rankings);
  assert.equal(props.firstName, "Joe");
  assert.equal(props.portfolioId, "owned");
  assert.equal(props.valuationState, "exact");
  assert.ok(app.calls.find(call => call.table === "user_portfolios").filters.some(filter => filter[0] === "eq" && filter[1] === "user_id" && filter[2] === "owner"));
  assert.ok(app.calls.some(call => call.chartOwner === "owner"));
  assert.ok(!app.calls.some(call => call.snapshots), "Desktop rank-snapshot work must not run on native home");
  const states = [props.deferredChart, props.deferredOpportunities, props.deferredMarket, props.deferredNews].map(observe);
  assert.ok(states.every(state => !state.ready));
  app.news.resolve({ articles: [article] });
  const resolvedNews = await props.deferredNews;
  assert.equal(resolvedNews.status, "ok");
  assert.equal(resolvedNews.articles[0].summary, "Revenue increased.");
  await nextTurn();
  assert.deepEqual(states.map(state => state.ready), [false, false, false, true]);
  app.market.resolve(marketResult);
  const resolvedMarket = await props.deferredMarket;
  assert.equal(resolvedMarket.value, 102);
  assert.equal(resolvedMarket.changePct, 2);
  assert.deepEqual(states.map(state => state.ready), [false, false, true, true]);
  app.chart.resolve(chartResult);
  const resolvedChart = await props.deferredChart;
  assert.strictEqual(resolvedChart.chartData, chartResult.chartData);
  assert.equal(states[1].ready, false, "A slow research query must not hold back the ready portfolio chart");
  app.ideas.resolve(ideaRows());
  const resolvedIdeas = await props.deferredOpportunities;
  assert.equal(resolvedIdeas[0].ticker, "MSFT");
  assert.equal(resolvedIdeas[0].recentMovePct, 2.5);
});

test("anonymous dashboard requests redirect before private reads or optional network work", async () => {
  const app = harness({ authenticated: false });
  await assert.rejects(app.page({ searchParams: Promise.resolve({}) }), /redirect:\/login\?next=\/dashboard/);
  assert.deepEqual(app.calls, []);
});

test("failed optional sections remain contained while the core dashboard remains usable", async t => {
  t.mock.method(console, "error", () => {});
  const app = harness();
  const rendered = await app.renderContent();
  const props = find(rendered, node => node.type === MobileDashboard).props;
  app.market.reject(new Error("market unavailable"));
  app.news.reject(new Error("news unavailable"));
  app.chart.reject(new Error("history unavailable"));
  app.ideas.reject(new Error("research unavailable"));
  const [market, news, chart, ideas] = await Promise.all([props.deferredMarket, props.deferredNews, props.deferredChart, props.deferredOpportunities]);
  assert.strictEqual(props.summary, app.summary);
  assert.strictEqual(props.rankings, app.rankings);
  assert.deepEqual(market, { chart: {}, value: null, changePct: null });
  assert.equal(news.status, "error");
  assert.equal(chart.failed, true);
  assert.deepEqual(ideas, []);
});

test("the default portfolio library contract still waits for full chart and research results", async () => {
  const app = harness();
  let result;
  const pending = app.portfolioLibrary.getDashboardMainPortfolio(app.supabase, "owner", "owned").then(value => { result = value; });
  await nextTurn();
  assert.equal(result, undefined);
  app.chart.resolve(chartResult);
  await nextTurn();
  assert.equal(result, undefined, "Default callers still require their research result");
  app.ideas.resolve(ideaRows());
  await pending;
  assert.strictEqual(result.summary, app.summary);
  assert.strictEqual(result.chartData, chartResult.chartData);
  assert.equal(result.opportunities[0].ticker, "MSFT");
  assert.equal(result.deferredChart, undefined);
  assert.equal(result.deferredOpportunities, undefined);
});
