import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const jsx = require("react/jsx-runtime");
function load(file, imports = {}) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
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
const health = load("lib/portfolio-chart-health.ts");
const currency = load("lib/currency.ts");
const Workspace = () => null;
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function find(tree, type) {
  if (Array.isArray(tree)) return tree.map((child) => find(child, type)).find(Boolean);
  if (!tree || typeof tree !== "object") return undefined;
  return tree.type === type ? tree : find(tree.props?.children, type);
}
function pageHarness({ authenticated = true } = {}) {
  const chart = deferred(), ideas = deferred(), calls = [];
  const holding = { ticker: "AAPL", shares: 10, currentPrice: 100, entryPrice: 90, currentValue: 1000, costBasis: 900, totalPnLDollars: 100, pnlDollars: 10 };
  const summary = { totalValue: 1000, holdingsValue: 1000, totalPnl: 100, unrealisedPnl: 100, realisedPnl: 0, holdingsCount: 1 };
  const rows = {
    user_portfolios: [{ id: "owned", name: "My portfolio", created_at: "2026-10-01", currency: "USD", cash_balance: 0 }],
    profiles: { preferred_currency: "GBP", subscription_status: "active" },
    stock_rankings: [],
    portfolio_holdings: [{ ticker: "AAPL", shares: 10, entry_price: 90 }],
    portfolio_transactions: [],
  };
  const supabase = {
    from(table) {
      calls.push(table);
      const query = { then(resolve) { return Promise.resolve({ data: rows[table] }).then(resolve); } };
      for (const method of ["select", "eq", "is", "order", "limit", "maybeSingle"]) query[method] = () => query;
      return query;
    },
  };
  const page = load("app/(workspace)/portfolio/modern/page.tsx", {
    "next/navigation": { redirect: (path) => { throw new Error(`redirect:${path}`); } },
    "@/components/AppShell": { AppShell: () => null },
    "@/components/PortfolioBuilder": { PortfolioBuilder: () => null },
    "@/components/PortfolioModernWorkspace": { PortfolioModernWorkspace: Workspace },
    "@/lib/server-viewer": { getServerViewer: async () => ({ supabase, user: authenticated ? { id: "owner" } : null }) },
    "@/lib/portfolio-alerts": { enrichHoldings: async () => [holding] },
    "@/lib/portfolio-health": { buildPortfolioHealthSummary: () => summary },
    "@/lib/portfolio-page-chart": { buildPortfolioPageChartResult: (options) => { calls.push(["chart", options]); return chart.promise; } },
    "@/lib/portfolio-chart-health": health,
    "@/lib/dashboard-portfolio": { buildPortfolioOpportunities: () => { calls.push("ideas"); return ideas.promise; } },
    "@/lib/subscription": { hasActiveSubscription: () => true },
    "@/lib/fx-rates": { getUsdFxRates: async () => ({ USD: 1, GBP: 0.8, EUR: 0.9, CHF: 0.8 }) },
    "@/lib/currency": currency,
  }).default;
  return { page, chart, ideas, calls, holding };
}

test("portfolio core returns before chart and research, with owner-checked real values and consistent FX", async () => {
  const harness = pageHarness();
  let result;
  const rendering = harness.page({ searchParams: Promise.resolve({ section: "holdings" }) }).then((tree) => { result = tree; });
  await new Promise(setImmediate);
  assert.ok(result, "Slow chart or research work must not block the core page");
  await rendering;
  const props = find(result, Workspace).props;
  assert.equal(props.summary.totalValue, 800);
  assert.equal(props.holdings[0].currentPrice, 80);
  assert.equal(props.initialSection, "holdings");
  assert.equal(harness.calls.find((call) => Array.isArray(call) && call[0] === "chart")[1].ownerId, "owner");
  assert.ok(harness.calls.includes("ideas"), "Chart and research must already be running concurrently");
  let chartReady = false, ideasReady = false;
  props.chartPromise.then(() => { chartReady = true; });
  props.opportunitiesPromise.then(() => { ideasReady = true; });
  harness.chart.resolve({ chartData: { "1M": [{ date: "2026-10-01", close: 100, basis: 90, pnl: 10 }] }, meta: { source: "snapshots", health: health.emptyPortfolioChartHealth() } });
  await new Promise(setImmediate);
  assert.equal(chartReady, true, "Ready chart history must not wait for research");
  assert.equal(ideasReady, false);
  const chartDetails = await props.chartPromise;
  assert.equal(chartDetails.chartData["1M"][0].close, 80);
  assert.equal(chartDetails.chartData["1M"][0].pnl, 8);
  harness.ideas.resolve([{ ticker: "MSFT", reason: "Existing model evidence" }]);
  const ideaDetails = await props.opportunitiesPromise;
  assert.equal(ideaDetails.opportunities[0].ticker, "MSFT");
});

test("portfolio research can arrive while slow chart history remains pending", async () => {
  const harness = pageHarness();
  const result = await harness.page({ searchParams: Promise.resolve({}) });
  const props = find(result, Workspace).props;
  let chartReady = false;
  props.chartPromise.then(() => { chartReady = true; });
  harness.ideas.resolve([{ ticker: "MSFT" }]);
  const ideas = await props.opportunitiesPromise;
  assert.equal(ideas.opportunities[0].ticker, "MSFT");
  assert.equal(chartReady, false);
  harness.chart.resolve({ chartData: {}, meta: props.chartMeta });
  await props.chartPromise;
});

test("deferred failures resolve to explicit detail errors without discarding portfolio value", async () => {
  const harness = pageHarness();
  const result = await harness.page({ searchParams: Promise.resolve({}) });
  const props = find(result, Workspace).props;
  harness.chart.reject(new Error("upstream chart unavailable"));
  harness.ideas.reject(new Error("upstream research unavailable"));
  const [chart, ideas] = await Promise.all([props.chartPromise, props.opportunitiesPromise]);
  assert.equal(props.summary.totalValue, 800);
  assert.equal(chart.chartMeta.health.displayState, "error_no_cache");
  assert.equal(ideas.opportunitiesError, true);
  assert.deepEqual(chart.chartData, {});
});

test("anonymous requests redirect before portfolio reads or deferred detail work starts", async () => {
  const harness = pageHarness({ authenticated: false });
  await assert.rejects(harness.page({ searchParams: Promise.resolve({}) }), /redirect:\/login/);
  assert.deepEqual(harness.calls, []);
});

test("a missing snapshot and unsuccessful reconstruction attempt the upstream timeline only once", async () => {
  let rebuilds = 0;
  const noop = async () => undefined;
  const { buildPortfolioPageChartResult } = load("lib/portfolio-page-chart.ts", {
    "@/lib/portfolio-chart-health": health,
    "@/lib/portfolio-chart-cache": { getLatestPortfolioChart: async () => null, saveLatestPortfolioChart: noop },
    "@/lib/portfolio-snapshots": {
      buildCurrentPortfolioSnapshotPoint: () => ({ date: new Date().toISOString(), close: 100 }),
      latestPortfolioInputChangeMs: () => 0,
      getPortfolioSnapshotChartDataWithHealth: async () => null,
      saveLatestPortfolioSnapshotFromChartData: noop,
      savePortfolioSnapshotsFromChartData: noop,
    },
    "@/lib/portfolio-value-timeline": { buildPortfolioValueTimeline: async () => { rebuilds++; return {}; } },
    "@/utils/supabase/admin": { createAdminClient: () => { throw new Error("Owner-scoped client must be reused"); } },
  });
  const result = await buildPortfolioPageChartResult({
    portfolio: { id: "owned", name: "My portfolio", created_at: "2026-10-01", cash_balance: 0 },
    enriched: [{ ticker: "AAPL", shares: 1, currentPrice: 100 }],
    transactions: [], summary: { holdingsCount: 1, totalValue: 100 },
    ownerId: "owner", supabaseClient: {}, allowCurrentSnapshot: false,
  });
  assert.equal(rebuilds, 1);
  assert.deepEqual(result.chartData, {});
  assert.equal(result.meta.health.displayable, false);
});
