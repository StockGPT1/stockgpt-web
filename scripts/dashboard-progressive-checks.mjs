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

function harness({ authenticated = true, nativeApp = true, holdEnrichment = false, holdPortfolioRead = false, portfolioError = null } = {}) {
  const chart = deferred(), market = deferred(), news = deferred(), ideas = deferred(), enrichment = deferred(), portfolioRead = deferred();
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
            : table === "user_portfolios" && holdPortfolioRead ? portfolioRead.promise.then(data => ({ data })) : Promise.resolve({ data: rows[table], error: table === "user_portfolios" ? portfolioError : null });
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
    "@/lib/portfolio-alerts": { enrichHoldings: async () => holdEnrichment ? enrichment.promise : [holding] },
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
  return { page, renderContent, portfolioLibrary, supabase, calls, summary, rankings, chart, market, news, ideas, enrichment, portfolioRead, rows, holding };
}

test("native rankings render while the portfolio read is held; stored value precedes held enrichment", async () => {
  const app = harness({ holdPortfolioRead: true, holdEnrichment: true });
  let rendered;
  const rendering = app.renderContent().then(tree => { rendered = tree; });
  await nextTurn();
  assert.ok(rendered, "Even a held portfolio account query must not gate ready rankings and the home page");
  await rendering;
  const props = find(rendered, node => node.type === MobileDashboard).props;
  assert.equal(props.summary, null);
  assert.strictEqual(props.rankings, app.rankings);
  assert.equal(props.firstName, "Joe");
  assert.equal(props.portfolioId, null);
  const portfolioState = observe(props.deferredPortfolio);
  assert.equal(portfolioState.ready, false);
  assert.ok(app.calls.find(call => call.table === "user_portfolios").filters.some(filter => filter[0] === "eq" && filter[1] === "user_id" && filter[2] === "owner"));
  assert.ok(!app.calls.some(call => call.snapshots), "Desktop rank-snapshot work must not run on native home");
  app.portfolioRead.resolve(app.rows.user_portfolios);
  const loaded = await props.deferredPortfolio;
  assert.equal(loaded.status, "ready");
  const basic = loaded.portfolio;
  assert.equal(basic.valuation.totalValue, 1100);
  assert.equal(basic.valuation.totalPnl, 100);
  assert.equal(basic.summary, null, "Health must not be invented from incomplete research");
  assert.equal(basic.valuationState, "exact");
  const healthState = observe(basic.deferredEnrichment);
  await nextTurn();
  assert.equal(healthState.ready, false);
  app.enrichment.resolve([app.holding]);
  const complete = await basic.deferredEnrichment;
  assert.strictEqual(complete.summary, app.summary);
  assert.ok(app.calls.some(call => call.chartOwner === "owner"));
  const states = [complete.deferredChart, complete.deferredOpportunities, props.deferredMarket, props.deferredNews].map(observe);
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
  const resolvedChart = await complete.deferredChart;
  assert.strictEqual(resolvedChart.chartData, chartResult.chartData);
  assert.equal(states[1].ready, false, "A slow research query must not hold back the ready portfolio chart");
  app.ideas.resolve(ideaRows());
  const resolvedIdeas = await complete.deferredOpportunities;
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
  const basic = (await props.deferredPortfolio).portfolio;
  const complete = await basic.deferredEnrichment;
  app.market.reject(new Error("market unavailable"));
  app.news.reject(new Error("news unavailable"));
  app.chart.reject(new Error("history unavailable"));
  app.ideas.reject(new Error("research unavailable"));
  const [market, news, chart, ideas] = await Promise.all([props.deferredMarket, props.deferredNews, complete.deferredChart, complete.deferredOpportunities]);
  assert.strictEqual(complete.summary, app.summary);
  assert.strictEqual(props.rankings, app.rankings);
  assert.deepEqual(market, { chart: {}, value: null, changePct: null });
  assert.equal(news.status, "error");
  assert.equal(chart.failed, true);
  assert.deepEqual(ideas, []);
});

test("a failed portfolio account read does not masquerade as an empty portfolio or suppress rankings", async t => {
  t.mock.method(console, "error", () => {});
  const app = harness({ portfolioError: { message: "database unavailable" } });
  const rendered = await app.renderContent();
  const props = find(rendered, node => node.type === MobileDashboard).props;
  assert.strictEqual(props.rankings, app.rankings);
  assert.deepEqual(await props.deferredPortfolio, { status: "error" });
  app.market.resolve({}); app.news.resolve(null);
});

test("stored valuation keeps missing quotes, share counts and entry prices unknown instead of fabricating returns", async () => {
  for (const missing of ["price", "shares", "entry"]) {
    const app = harness({ holdEnrichment: true });
    if (missing === "price") app.rankings[0].price = null;
    if (missing === "shares") app.rows.portfolio_holdings[0].shares = null;
    if (missing === "entry") app.rows.portfolio_holdings[0].entry_price = null;
    const basic = await app.portfolioLibrary.getDashboardMainPortfolio(app.supabase, "owner", "owned", { deferEnrichment: true, deferDetails: true });
    assert.equal(basic.valuation.totalPnl, null);
    assert.equal(basic.valuation.totalPnlPct, null);
    if (missing !== "entry") {
      assert.equal(basic.valuationState, "unavailable");
      assert.deepEqual(basic.missingPriceTickers, ["AAPL"]);
    } else {
      assert.equal(basic.valuation.totalValue, 1100);
      assert.equal(basic.valuationState, "exact");
    }
  }
});

test("failed health enrichment preserves the independently confirmed stored valuation", async t => {
  t.mock.method(console, "error", () => {});
  const app = harness({ holdEnrichment: true });
  const basic = await app.portfolioLibrary.getDashboardMainPortfolio(app.supabase, "owner", "owned", { deferEnrichment: true, deferDetails: true });
  app.enrichment.reject(new Error("diagnostics unavailable"));
  assert.equal((await basic.deferredEnrichment).failed, true);
  assert.equal(basic.valuation.totalValue, 1100);
  assert.equal(basic.summary, null);
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

function renderedText(tree) {
  if (Array.isArray(tree)) return tree.map(renderedText).join(" ");
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  return tree && typeof tree === "object" ? renderedText(tree.props?.children) : "";
}

test("the real mobile home shows ready rankings while portfolio is pending, then real value without invented health", async () => {
  const app = harness({ holdEnrichment: true });
  const props = find(await app.renderContent(), node => node.type === MobileDashboard).props;
  const states = new Map();
  const react = {
    useCallback: callback => callback,
    useEffect() {},
    useMemo: factory => factory(),
    useRef: initial => ({ current: initial }),
    useState: initial => [initial, () => {}],
    useSyncExternalStore: (_subscribe, _snapshot, serverSnapshot) => serverSnapshot(),
  };
  const MobileHome = load("components/MobileDashboardExperience.tsx", {
    react,
    "next/link": { __esModule: true, default: () => null },
    "@/components/DashboardPortfolioSelector": { DashboardPortfolioSelector: () => null },
    "@/components/FreshnessLabel": { FreshnessLabel: () => null },
    "@/components/StockChart": { StockChart: () => null },
    "@/components/StockLogo": { StockLogo: () => null },
    "@/components/NativePageRegistration": { NativePageRegistration: () => null },
    "@/components/DashboardDataStream": { useDashboardData: source => states.get(source) ?? { value: undefined, pending: Boolean(source), bridge: null } },
  }).MobileDashboardExperience;
  let text = renderedText(MobileHome(props));
  assert.ok(text.includes("Top ranked today") && text.includes("AAPL"));
  assert.ok(text.includes("Connecting your portfolio"));
  assert.ok(!text.includes("Build your first portfolio") && !text.includes("Build a portfolio first"));

  const core = await props.deferredPortfolio;
  states.set(props.deferredPortfolio, { value: core, pending: false, bridge: null });
  text = renderedText(MobileHome(props));
  assert.ok(text.includes("1,100"), "Confirmed stored valuation should be visible before the held research");
  assert.ok(text.includes("Health updating"));
  assert.ok(!text.includes("Health 0/100") && !text.includes("Build your first portfolio"));

  states.set(core.portfolio.deferredEnrichment, { value: { failed: true }, pending: false, bridge: null });
  text = renderedText(MobileHome(props));
  assert.ok(text.includes("1,100") && text.includes("Health unavailable"));
  assert.ok(!text.includes("Build your first portfolio"));
});
