import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
function compile(relativePath) {
  return ts.transpileModule(fs.readFileSync(new URL(relativePath, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
function load(code, imports = () => { throw new Error("Unexpected import"); }) {
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)(imports, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const routeCode = compile("../app/api/top-movers/route.ts");
const rankHistory = load(compile("../lib/rank-history.ts"));
const subscription = load(compile("../lib/subscription.ts"));
const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const rankings = [
  { ticker: "aaa", company: "Alpha", sector: "Technology", price: 120.123, score: 8000.6, rank: 2 },
  { ticker: "BBB", company: "Beta", sector: "Industrials", price: 85, score: 7000, rank: 8 },
  { ticker: "CCC", company: null, sector: null, price: 0, score: "bad", rank: null },
];

function routeHarness(options = {}) {
  const calls = [];
  const supabase = {
    auth: { getUser: async () => { calls.push({ name: "auth" }); return { data: { user: options.user === null ? null : { id: "user-1" } } }; } },
    from(table) {
      assert.equal(table, "profiles");
      calls.push({ name: "profile" });
      const query = {
        select(columns) { assert.equal(columns, "subscription_status"); return query; },
        eq(column, value) { assert.equal(column, "id"); assert.equal(value, "user-1"); return query; },
        maybeSingle: async () => ({ data: options.status === null ? null : { subscription_status: options.status ?? "premium" } }),
      };
      return query;
    },
  };
  const dependencies = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/utils/supabase/server": { createClient: async () => supabase },
    "@/lib/subscription": subscription,
    "@/lib/rank-history": {
      getRankMove24h: rankHistory.getRankMove24h,
      getRankSnapshotMapAround24hAgo: async (client) => {
        assert.strictEqual(client, supabase);
        calls.push({ name: "snapshot" });
        return options.snapshot ?? new Map([["AAA", 10], ["BBB", 5]]);
      },
    },
    "@/lib/stable-rankings": { getStableRankings: async (client) => {
      assert.strictEqual(client, supabase);
      calls.push({ name: "rankings" });
      return options.rankings ?? rankings;
    } },
    "@/lib/yahoo": {
      getOneDayMoveMap: async (tickers) => {
        calls.push({ name: "quotes", tickers });
        return options.moves ?? new Map([["AAA", { changePct: 12.345, currentPrice: 999 }], ["BBB", { changePct: -7.65, currentPrice: 999 }]]);
      },
      getStockChart: async (ticker, ranges) => {
        calls.push({ name: "chart", ticker, ranges });
        return options.charts?.[ticker] ?? { [ranges[0]]: ticker === "AAA" ? [{ close: 0 }, { close: 100 }, { close: Number.NaN }, { close: 115 }] : ticker === "BBB" ? [{ close: 100 }, { close: 90 }] : [] };
      },
    },
  };
  const route = load(routeCode, (name) => {
    if (!dependencies[name]) throw new Error(`Unexpected route dependency ${name}`);
    return dependencies[name];
  });
  return { calls, get: (period = "1d") => route.GET({ nextUrl: new URL(`https://stockgpt.test/api/top-movers?period=${period}`) }) };
}

test("top movers requires login before subscription or market reads", async () => {
  const harness = routeHarness({ user: null });
  const response = await harness.get();
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Login required.", movers: [] });
  assert.deepEqual(harness.calls.map((call) => call.name), ["auth"]);
});

test("top movers requires an active subscription before market reads", async () => {
  for (const status of [null, "cancelled", "paused"]) {
    const harness = routeHarness({ status });
    const response = await harness.get();
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "Active subscription required.", movers: [] });
    assert.deepEqual(harness.calls.map((call) => call.name), ["auth", "profile"]);
  }
});

for (const period of ["1d", "1w", "1m"]) {
  test(`${period} prices start as soon as rankings are available while rank history remains pending`, async () => {
    const snapshot = deferred();
    const rankingRead = deferred();
    const harness = routeHarness({ snapshot: snapshot.promise, rankings: rankingRead.promise });
    const request = harness.get(period);
    try {
      await tick();
      assert.ok(harness.calls.some((call) => call.name === "snapshot"));
      assert.ok(harness.calls.some((call) => call.name === "rankings"));
      assert.equal(harness.calls.some((call) => call.name === "quotes" || call.name === "chart"), false);
      rankingRead.resolve(rankings);
      await tick();
      assert.ok(harness.calls.some((call) => call.name === (period === "1d" ? "quotes" : "chart")));
    } finally {
      rankingRead.resolve(rankings);
      snapshot.resolve(new Map());
      await request;
    }
  });
}

test("a failed rank snapshot is handled while the ranking read is still pending", async () => {
  const snapshot = deferred();
  const rankingRead = deferred();
  const harness = routeHarness({ snapshot: snapshot.promise, rankings: rankingRead.promise });
  const request = harness.get();
  const rejected = assert.rejects(request, /Rank snapshot unavailable/);
  await tick();
  snapshot.reject(new Error("Rank snapshot unavailable"));
  try {
    await rejected;
  } finally {
    rankingRead.resolve(rankings);
    await tick();
  }
});

test("a failed ranking read cannot leave its concurrent snapshot rejection unhandled", async () => {
  const snapshot = deferred();
  const rankingRead = deferred();
  const harness = routeHarness({ snapshot: snapshot.promise, rankings: rankingRead.promise });
  const rejected = assert.rejects(harness.get(), /Rankings unavailable/);
  await tick();
  rankingRead.reject(new Error("Rankings unavailable"));
  await rejected;
  snapshot.reject(new Error("Snapshot also unavailable"));
  await tick();
  assert.equal(harness.calls.some((call) => call.name === "quotes" || call.name === "chart"), false);
});

test("daily payload preserves ranking prices, 24h rank moves and unknown quote states", async () => {
  const harness = routeHarness();
  const response = await harness.get();
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.period, "1d");
  assert.equal(payload.movers.length, 3);
  assert.deepEqual(payload.movers[0], {
    ticker: "AAA", company: "Alpha", sector: "Technology", price: "$120.12", score: "8,001",
    rankLabel: "↑ 8", rankTone: "up", rankTitle: "Moved up 8 places versus the 24-hour snapshot",
    actualRankLabel: "#2", dailyMoveLabel: "+12.3%", dailyMoveTone: "positive",
  });
  assert.equal(payload.movers[1].rankLabel, "↓ 3");
  assert.equal(payload.movers[1].dailyMoveLabel, "-7.7%");
  assert.equal(payload.movers[1].dailyMoveTone, "negative");
  assert.equal(payload.movers[2].dailyMoveLabel, "—");
  assert.equal(payload.movers[2].dailyMoveTone, "neutral");
  assert.equal(payload.movers[2].price, "—");
  assert.equal(payload.movers[2].actualRankLabel, "#—");
  assert.deepEqual(harness.calls.find((call) => call.name === "quotes").tickers, ["AAA", "BBB", "CCC"]);
  assert.equal(harness.calls.some((call) => call.name === "chart"), false);
});

for (const [period, range, field] of [["1w", "5D", "weekly"], ["1m", "1M", "monthly"]]) {
  test(`${period} payload uses the existing ${range} return and retains period-specific fields`, async () => {
    const harness = routeHarness();
    const payload = await (await harness.get(period)).json();
    assert.equal(payload.period, period);
    assert.equal(payload.movers[0][`${field}MoveLabel`], "+15.0%");
    assert.equal(payload.movers[0][`${field}MoveTone`], "positive");
    assert.equal(payload.movers[0].dailyMoveLabel, "+15.0%");
    assert.equal(payload.movers[1][`${field}MoveLabel`], "-10.0%");
    assert.equal(payload.movers[2][`${field}MoveLabel`], "—");
    assert.equal(harness.calls.some((call) => call.name === "quotes"), false);
    assert.ok(harness.calls.filter((call) => call.name === "chart").every((call) => call.ranges.length === 1 && call.ranges[0] === range));
  });
}

test("unknown periods default to daily and the ranking universe remains capped at 500", async () => {
  const rows = [{ ticker: null }, ...Array.from({ length: 510 }, (_, index) => ({ ...rankings[0], ticker: `T${index}` }))];
  const harness = routeHarness({ rankings: rows });
  const payload = await (await harness.get("unexpected")).json();
  assert.equal(payload.period, "1d");
  assert.equal(payload.movers.length, 500);
  assert.equal(payload.movers.at(-1).ticker, "T499");
  assert.equal(harness.calls.find((call) => call.name === "quotes").tickers.length, 500);
});
