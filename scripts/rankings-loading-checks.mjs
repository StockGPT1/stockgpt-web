import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url), ts = require("typescript"), jsx = require("react/jsx-runtime");
function load(path, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", code)((name) => {
    if (name === "react/jsx-runtime") return jsx;
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  }, loaded, loaded.exports);
  return loaded.exports;
}
const quotes = load("../lib/rankings-live-moves.ts");
const explain = load("../lib/research-explainability.ts");
const subscription = load("../lib/subscription.ts");
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const nodes = (tree) => Array.isArray(tree) ? tree.flatMap(nodes) : !tree || typeof tree !== "object" ? [] : [tree, ...nodes(tree.props?.children)];
const marker = () => null;
const rowData = [
  { id: "a", ticker: "AAA", company: "Alpha", sector: "Technology", rank: 1, score: 12000, price: 101.25 },
  { id: "b", ticker: "BBB", company: "Beta", sector: "Industrials", rank: 2, score: 11000, price: null },
];

function pageHarness() {
  const calls = [], live = deferred();
  const dependencies = {
    "next/link": { __esModule: true, default: marker },
    "@/components/AppShell": { AppShell: marker },
    "@/components/FreshnessLabel": { FreshnessLabel: marker },
    "@/components/RankingsMobileBatchList": { RankingsMobileBatchList: marker },
    "@/components/RankingsLiveMoves": { RankingsLiveMoves: marker, RankingDailyMove: marker, RankingPrice: marker, RankingWhy: marker },
    "@/components/RankingsLock": { RankingsLock: marker },
    "@/components/StockIcon": { StockIcon: marker },
    "@/components/StockLogo": { StockLogo: marker },
    "@/lib/yahoo": { getOneDayMoveMap: async tickers => { calls.push(tickers); return live.promise; }, getStockChart: () => assert.fail("Missing prices must not start chart downloads during server rendering") },
    "@/lib/rankings-live-moves": quotes,
    "@/lib/rank-history": { getRankMove24h: () => ({ tone: "flat", label: "—" }), getRankSnapshotMapAround24hAgo: async () => new Map(), moveClassName: () => "" },
    "@/lib/research-explainability": explain,
    "@/lib/stable-rankings": { getRankingSectors: async () => ["Technology"], getStableRankingsPage: async () => ({ rows: rowData, total: 100 }) },
    "@/lib/subscription": subscription,
    "@/lib/server-viewer": { getServerViewer: async () => ({ supabase: {} }), getViewerProfile: async () => ({ subscription_status: "active" }) },
    "@/utils/supabase/admin": { createAdminClient: () => assert.fail("Subscribers must use their authenticated DB client") },
  };
  const page = load("../app/(workspace)/rankings/page.tsx", dependencies);
  return { render: params => page.default({ searchParams: Promise.resolve(params) }), calls, live };
}

test("normal server rankings render stored scores and prices without waiting for Yahoo", async () => {
  const page = pageHarness();
  const tree = await page.render({});
  assert.deepEqual(page.calls, []);
  const mobile = nodes(tree).find(node => node.props?.initialItems);
  assert.deepEqual(mobile.props.initialItems.map(({ ticker, price, score, dailyMove }) => ({ ticker, price, score, dailyMove })), [
    { ticker: "AAA", price: 101.25, score: 12000, dailyMove: null },
    { ticker: "BBB", price: null, score: 11000, dailyMove: null },
  ]);
  assert.equal(mobile.props.totalPages, 2);
  const background = nodes(tree).find(node => node.props?.tickers);
  assert.equal(background.props.enabled, true);
});

test("an explicit price-move filter waits for quotes and filters actual results", async () => {
  const page = pageHarness();
  let settled = false;
  const pending = page.render({ priceMove: "up" }).then(tree => { settled = true; return tree; });
  await tick();
  assert.equal(settled, false);
  assert.deepEqual(page.calls, [["AAA", "BBB"]]);
  page.live.resolve(new Map([["AAA", { changePct: 2, currentPrice: 102 }], ["BBB", { changePct: -3, currentPrice: 90 }]]));
  const tree = await pending;
  const mobile = nodes(tree).find(node => node.props?.initialItems);
  assert.deepEqual(mobile.props.initialItems.map(row => row.ticker), ["AAA"]);
  assert.equal(mobile.props.initialItems[0].dailyMove, 2);
  assert.equal(nodes(tree).find(node => node.props?.tickers).props.enabled, false);
});

function routeHarness({ authenticated = true, subscribed = true, batch = false } = {}) {
  const calls = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: "member" } : null } }) },
    from: () => {
      const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: { subscription_status: subscribed ? "active" : "inactive" } }) };
      return chain;
    },
  };
  const dependencies = {
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    "@/lib/server-viewer": { getServerViewer: async () => ({ supabase, user: authenticated ? { id: "member" } : null }) },
    "@/utils/supabase/server": { createClient: async () => supabase },
    "@/lib/subscription": subscription,
    "@/lib/rankings-live-moves": quotes,
    "@/lib/stable-rankings": { getStableRankingsPage: async () => ({ rows: rowData, total: 100 }) },
    "@/lib/yahoo": { getOneDayMoveMap: async tickers => { calls.push(tickers); return new Map([["AAA", { currentPrice: 102, changePct: 2 }], ["BBB", { currentPrice: NaN, changePct: null }]]); } },
  };
  return { ...load(batch ? "../app/api/rankings/page/route.ts" : "../app/api/rankings/live-moves/route.ts", dependencies), calls };
}
const request = (query = "") => ({ nextUrl: new URL(`https://stockgpt.pro/api/rankings/live-moves?${query}`) });

test("optional quote endpoint validates tickers, keeps unknowns null and enforces membership", async () => {
  const route = routeHarness();
  const response = await route.GET(request("tickers=aaa,AAA,BBB,bad%20ticker"));
  assert.deepEqual(route.calls, [["AAA", "BBB"]]);
  assert.deepEqual(await response.json(), { quotes: { AAA: { currentPrice: 102, changePct: 2 }, BBB: { currentPrice: null, changePct: null } } });
  for (const [options, status] of [[{ authenticated: false }, 401], [{ subscribed: false }, 403]]) {
    const gated = routeHarness(options);
    assert.equal((await gated.GET(request("tickers=AAA"))).status, status);
    assert.deepEqual(gated.calls, []);
  }
  assert.equal(quotes.rankingQuoteTickers(Array.from({ length: 70 }, (_, index) => `T${index}`)).length, 50);
});

test("load-more batches skip live quotes unless the active filter requires them", async () => {
  const batch = routeHarness({ batch: true });
  const plain = await (await batch.GET(request("page=2"))).json();
  assert.deepEqual(batch.calls, []);
  assert.equal(plain.rows.length, 2);
  assert.deepEqual(plain.dailyMoves, { AAA: null, BBB: null });
  const filtered = await (await batch.GET(request("page=2&priceMove=up"))).json();
  assert.deepEqual(batch.calls, [["AAA", "BBB"]]);
  assert.equal(filtered.dailyMoves.AAA, 2);
});

test("late quotes fill missing prices without replacing stored prices or inventing zero moves", () => {
  const live = quotes.parseRankingLiveQuotes({ AAA: { currentPrice: 999, changePct: 0 }, BBB: { currentPrice: 90, changePct: -3 }, CCC: { currentPrice: 0, changePct: "4" } }, ["AAA", "BBB", "CCC"]);
  assert.deepEqual(quotes.resolveRankingLiveQuote("AAA", 101.25, null, live), { price: 101.25, dailyMove: 0 });
  assert.deepEqual(quotes.resolveRankingLiveQuote("BBB", null, null, live), { price: 90, dailyMove: -3 });
  assert.deepEqual(quotes.resolveRankingLiveQuote("CCC", null, null, live), { price: null, dailyMove: null });
  assert.deepEqual(quotes.resolveRankingLiveQuote("DDD", null, null, live), { price: null, dailyMove: null });
});
