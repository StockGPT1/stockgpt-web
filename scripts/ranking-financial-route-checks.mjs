import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const compiled = ts.transpileModule(fs.readFileSync(new URL("../app/api/rankings/financial-metrics/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function harness({ user = { id: "member" }, subscribed = true, diagnosticError = null } = {}) {
  const calls = [], metricCalls = [], snapshot = { ticker: "BRK.B", values: { PE: 20 } };
  const diagnostic = { ticker: "BRK.B", factor_coverage: 17 / 21, updated_at: "2026-10-13T12:00:00Z" };
  const ranking = { ticker: "BRK.B", rank: 20, score: 1.2 };
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table) => {
      const call = { table }; calls.push(call);
      const chain = {
        select: (columns) => { call.columns = columns; return chain; },
        eq: () => chain,
        maybeSingle: async () => ({ data: { subscription_status: subscribed ? "active" : "inactive" } }),
        in: (column, tickers) => { call.filter = { column, tickers }; return chain; },
        order: () => chain,
        limit: async () => ({ data: [table === "stock_rankings" ? ranking : diagnostic], error: table === "stock_factor_diagnostics" ? diagnosticError : null }),
      };
      return chain;
    },
  };
  const container = { exports: {} };
  new Function("require", "module", "exports", "console", compiled)(
    (name) => {
      if (name === "next/server") return { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) } };
      if (name === "@/utils/supabase/server") return { createClient: async () => client };
      if (name === "@/lib/subscription") return { hasActiveSubscription: (status) => status === "active" };
      if (name === "@/lib/yahoo-financials") return {
        getFundamentalSnapshots: async (tickers, receivedClient) => { assert.equal(receivedClient, client); assert.deepEqual(tickers, ["BRK.B"]); return [snapshot]; },
        getFinancialMetricMap: async (tickers, snapshots) => { metricCalls.push({ tickers, snapshots }); return new Map([["BRK.B", { fundamentalsSource: "yahoo+statements", trailingPE: 20 }]]); },
      };
      throw new Error(`Unexpected import: ${name}`);
    }, container, container.exports, { warn() {} },
  );
  return { ...container.exports, calls, metricCalls, snapshot, diagnostic, ranking };
}
const request = (ticker = "BRK.B") => ({ nextUrl: new URL(`https://stockgpt.pro/api/rankings/financial-metrics?ticker=${ticker}`) });

test("subscribers receive valid ranking columns, diagnostic completeness and authenticated stored fundamentals", async () => {
  const route = harness();
  const result = await route.GET(request());
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.ranking, route.ranking);
  assert.deepEqual(result.data.diagnostics, route.diagnostic);
  assert.equal(result.data.metrics.trailingPE, 20);
  assert.deepEqual(route.metricCalls, [{ tickers: ["BRK.B"], snapshots: [route.snapshot] }]);
  assert.deepEqual(route.calls.find((call) => call.table === "stock_rankings").columns.split(","), ["ticker", "rank", "score", "price", "momentum", "pe", "risk", "updated_at"]);
  assert.ok(route.calls.find((call) => call.table === "stock_factor_diagnostics").columns.split(",").includes("factor_coverage"));
  assert.deepEqual(route.calls.find((call) => call.table === "stock_rankings").filter.tickers, ["BRK.B", "BRK-B"]);
});

test("authentication and subscription failures do not request premium financial data", async () => {
  for (const [options, status] of [[{ user: null }, 401], [{ subscribed: false }, 403]]) {
    const route = harness(options);
    const result = await route.GET(request());
    assert.equal(result.status, status);
    assert.equal(route.metricCalls.length, 0);
    assert.ok(route.calls.every((call) => call.table === "profiles"));
  }
});

test("diagnostic query errors preserve ranking and measured financial data without faking completeness", async () => {
  const route = harness({ diagnosticError: { message: "temporary failure" } });
  const result = await route.GET(request());
  assert.equal(result.status, 200);
  assert.equal(result.data.diagnostics, null);
  assert.deepEqual(result.data.ranking, route.ranking);
  assert.equal(result.data.metrics.trailingPE, 20);
});
