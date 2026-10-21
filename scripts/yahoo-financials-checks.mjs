import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const compiled = ts.transpileModule(fs.readFileSync(new URL("../lib/yahoo-financials.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const reportingModule = { exports: {} };
new Function("module", "exports", ts.transpileModule(fs.readFileSync(new URL("../lib/fundamental-provenance.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(reportingModule, reportingModule.exports);
const { fundamentalReportingLabel } = reportingModule.exports;
const keys = ["MarketCap", "EPS", "PE", "PS", "PB", "EVToEBITDA", "ROE", "ROIC", "GrossMargin", "OperatingMargin", "NetMargin", "RevenueGrowth", "EPSGrowth", "FCFMargin", "FCFGrowth", "FCFYield", "DebtToEquity", "DividendYield", "Beta"];
const snapshot = (overrides = {}) => ({
  ticker: "AAPL", collected_at: new Date().toISOString(), source: "yahoo+statements",
  values: Object.fromEntries(keys.map((key) => [key, key === "MarketCap" ? 100_000 : 0.2])),
  metadata: { fields: { ROIC: { status: "derived", source: "annual statements", basis: "TTM", periods: ["2026-06-30"] } } },
  ...overrides,
});
const quoteResponse = (rows) => ({ ok: true, status: 200, json: async () => ({ quoteResponse: { result: rows } }) });
function harness({ fetch = async () => ({ ok: false, status: 401 }), closes = [100, 110], chartFails = false } = {}) {
  const calls = [], chartCalls = [], warnings = [];
  const container = { exports: {} };
  new Function("require", "module", "exports", "fetch", "console", compiled)(
    (name) => {
      assert.equal(name, "@/lib/yahoo");
      return { getStockChart: async (ticker, ranges) => {
        chartCalls.push({ ticker, ranges });
        if (chartFails) throw new Error("chart unavailable");
        return { "1Y": closes.map((close, index) => ({ date: new Date(2026, 0, index + 1).toISOString(), close })) };
      } };
    }, container, container.exports,
    (url, options) => { calls.push({ url, options }); return fetch(url, options); },
    { warn: (...args) => warnings.push(args) },
  );
  return { ...container.exports, calls, chartCalls, warnings };
}

test("fresh measured statements supply every financial field without a broken quote request", async () => {
  const yahoo = harness();
  const stored = snapshot({ values: { ...snapshot().values, DividendYield: 0, EPS: 0, FCFYield: -0.03, ForwardPE: 15 } });
  const metrics = (await yahoo.getFinancialMetricMap([" aapl "], [stored])).get("AAPL");
  assert.equal(yahoo.calls.length, 0);
  assert.equal(yahoo.chartCalls.length, 1);
  assert.equal(metrics.metricsSource, "snapshot+chart");
  assert.equal(metrics.fundamentalsStatus, "available");
  assert.equal(metrics.fundamentalsSource, "yahoo+statements");
  assert.equal(metrics.fundamentalsAsOf, stored.collected_at);
  assert.equal(metrics.fundamentalMetadata.fields.ROIC.basis, "TTM");
  assert.equal(metrics.fundamentals.FCFYield, -0.03);
  assert.equal(metrics.epsTrailingTwelveMonths, 0);
  assert.equal(metrics.dividendYieldPct, 0);
  assert.equal(metrics.forwardPE, 15);
  assert.equal(metrics.regularMarketPrice, 110);
  assert.equal(metrics.quoteStatus, "not_requested");
});

test("unavailable and imputed fields do not become measured facts or complete coverage", async () => {
  const yahoo = harness();
  const stored = snapshot({ metadata: { fields: {
    ROIC: { status: "imputed", reason: "sector median" },
    FCFYield: { status: "not_applicable" },
    PE: { status: "missing_input" },
  } } });
  const metrics = (await yahoo.getFinancialMetricMap(["AAPL"], [stored])).get("AAPL");
  assert.equal(metrics.fundamentals.ROIC, null);
  assert.equal(metrics.fundamentals.FCFYield, null);
  assert.equal(metrics.trailingPE, null);
  assert.equal(metrics.fundamentalsStatus, "partial");
});

test("expired, invalid-date and future snapshots fall back without showing stale values as current", async () => {
  for (const collected_at of [new Date(Date.now() - 8 * 86400000).toISOString(), "invalid", new Date(Date.now() + 86400000).toISOString()]) {
    const yahoo = harness();
    const metrics = (await yahoo.getFinancialMetricMap(["AAPL"], [snapshot({ collected_at })])).get("AAPL");
    assert.equal(yahoo.calls.length, 1);
    assert.equal(metrics.marketCap, null);
    assert.equal(metrics.fundamentalsAsOf, null);
    assert.equal(metrics.fundamentalsStatus, "unavailable");
    assert.equal(metrics.quoteStatus, "unauthorized");
    assert.equal(metrics.regularMarketPrice, 110);
  }
});

test("quote authorization and rate-limit errors are explicit and never cached as valid data", async () => {
  for (const [status, expected] of [[401, "unauthorized"], [403, "unauthorized"], [429, "rate_limited"], [503, "unavailable"]]) {
    const yahoo = harness({ fetch: async () => ({ ok: false, status }) });
    const metrics = (await yahoo.getFinancialMetricMap(["AAPL"])).get("AAPL");
    assert.equal(metrics.quoteStatus, expected);
    assert.equal(metrics.metricsSource, "chart");
    assert.equal(metrics.fundamentalsStatus, "unavailable");
    assert.equal(metrics.marketCap, null);
    assert.equal(yahoo.calls[0].options.cache, "no-store");
    assert.equal(yahoo.warnings.length, 1);
  }
});

test("Yahoo class-share symbols round-trip under the originally requested ticker", async () => {
  const yahoo = harness({ fetch: async () => quoteResponse([{ symbol: "BRK-B", marketCap: 1234, trailingPE: 20 }]) });
  const map = await yahoo.getFinancialMetricMap(["BRK.B"]);
  assert.equal(new URL(yahoo.calls[0].url).searchParams.get("symbols"), "BRK-B");
  assert.equal(map.get("BRK.B").marketCap, 1234);
  assert.equal(map.get("BRK.B").ticker, "BRK.B");
  assert.equal(map.size, 1);
  const stored = harness();
  assert.equal((await stored.getFinancialMetricMap(["BRK.B"], [snapshot({ ticker: "BRK-B" })])).get("BRK.B").metricsSource, "snapshot+chart");
});

test("low, zero and fractional Yahoo dividend fields preserve their actual units", async () => {
  for (const [row, expected] of [[{ dividendYield: 0.5 }, 0.5], [{ dividendYield: 0, trailingAnnualDividendYield: 0.02 }, 0], [{ trailingAnnualDividendYield: 0.005 }, 0.5]]) {
    const yahoo = harness({ fetch: async () => quoteResponse([{ symbol: "AAPL", epsTrailingTwelveMonths: 0, ...row }]) });
    const metrics = (await yahoo.getFinancialMetricMap(["AAPL"])).get("AAPL");
    assert.equal(metrics.dividendYieldPct, expected);
    assert.equal(metrics.epsTrailingTwelveMonths, 0);
  }
});

test("short or flat chart histories do not invent moving averages or extreme RSI", async () => {
  const yahoo = harness({ closes: Array(20).fill(100) });
  const metrics = (await yahoo.getFinancialMetricMap(["AAPL"])).get("AAPL");
  assert.equal(metrics.ma50, null);
  assert.equal(metrics.ma200, null);
  assert.equal(metrics.rsi14, 50);
  assert.equal(metrics.fiftyTwoWeekLow, null);
  assert.equal(metrics.fiftyTwoWeekHigh, null);
});

test("genuine volatile annual price ranges are kept rather than rejected by a price-distance heuristic", async () => {
  const yahoo = harness({ fetch: async () => quoteResponse([{ symbol: "AAPL", regularMarketPrice: 100, fiftyTwoWeekLow: 20, fiftyTwoWeekHigh: 300 }]) });
  const metrics = (await yahoo.getFinancialMetricMap(["AAPL"])).get("AAPL");
  assert.equal(metrics.fiftyTwoWeekLow, 20);
  assert.equal(metrics.fiftyTwoWeekHigh, 300);
});

test("an absent snapshot table degrades safely and requests both class-share spellings", async () => {
  const yahoo = harness();
  const selections = [];
  const client = { from: (table) => {
    assert.equal(table, "stock_fundamental_snapshots");
    return { select: (columns) => { selections.push(columns); return { in: async (column, tickers) => {
      assert.equal(column, "ticker");
      assert.deepEqual(tickers, ["BRK.B", "BRK-B"]);
      return { data: null, error: { code: "PGRST205" } };
    } }; } };
  } };
  assert.deepEqual(await yahoo.getFundamentalSnapshots(["BRK.B"], client), []);
  assert.equal(selections[0], "ticker,collected_at,source,values,metadata");
  assert.equal(yahoo.warnings.length, 1);
});

test("badly typed statement values remain missing and an invalid-dated duplicate cannot shadow a valid snapshot", async () => {
  const yahoo = harness();
  const valid = snapshot({ values: { ...snapshot().values, EPS: " ", ROIC: true, PE: -10 } });
  const metrics = (await yahoo.getFinancialMetricMap(["AAPL"], [snapshot({ collected_at: "invalid" }), valid])).get("AAPL");
  assert.equal(metrics.epsTrailingTwelveMonths, null);
  assert.equal(metrics.fundamentals.ROIC, null);
  assert.equal(metrics.trailingPE, null);
  assert.equal(metrics.fundamentalsStatus, "partial");
  assert.equal(metrics.metricsSource, "snapshot+chart");
  assert.equal(yahoo.calls.length, 0);
});

test("a successful quote response omitting a requested ticker cannot claim that ticker has live fundamentals", async () => {
  const yahoo = harness({ fetch: async () => quoteResponse([{ symbol: "MSFT", marketCap: 1234 }]) });
  const metrics = (await yahoo.getFinancialMetricMap(["AAPL"])).get("AAPL");
  assert.equal(metrics.quoteStatus, "unavailable");
  assert.equal(metrics.marketCap, null);
  assert.equal(metrics.fundamentalsStatus, "unavailable");
});

test("chart work starts immediately while the independent quote request is still pending", async () => {
  let resolveQuote;
  const pending = new Promise((resolve) => { resolveQuote = resolve; });
  const yahoo = harness({ fetch: () => pending });
  const result = yahoo.getFinancialMetricMap(["AAPL"]);
  assert.equal(yahoo.chartCalls.length, 1);
  assert.equal(yahoo.calls.length, 1);
  resolveQuote({ ok: false, status: 401 });
  assert.equal((await result).get("AAPL").regularMarketPrice, 110);
});

test("reporting periods use the newest actual statement date and readable calculation labels", () => {
  for (const [basis, label] of [["ttm", "Last 12 months"], ["annual", "Annual accounts"], ["quarterly_yoy", "Quarterly vs last year"], ["annual_yoy", "Annual vs prior year"], ["balance_sheet_snapshot", "Balance sheet"]]) {
    assert.equal(fundamentalReportingLabel({ basis, periods: ["2025-06-30", "2026-03-31", "2026-06-30", "2025-12-31"] }), `${label} · Jun 2026`);
  }
  assert.equal(fundamentalReportingLabel({ basis: "ttm", periods: ["2026-06-01T00:00:00Z"] }), "Last 12 months · Jun 2026");
});

test("raw or unknown calculation labels and unusable period values never leak into the interface", () => {
  assert.equal(fundamentalReportingLabel({ basis: "reported", periods: [] }), null);
  assert.equal(fundamentalReportingLabel({ basis: "internal_calculation_v4", periods: ["not a date", null, true] }), null);
  assert.equal(fundamentalReportingLabel({ basis: "reported", periods: ["2026-06-30"] }), "Jun 2026");
  assert.equal(fundamentalReportingLabel({ basis: "annual", period: "2025-12-31" }), "Annual accounts · Dec 2025");
});
