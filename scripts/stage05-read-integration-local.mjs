import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readPortfolioLedger } from "../lib/portfolio-ledger-reader.ts";
import { loadCurrentPortfolioIntelligenceFromClient } from "../lib/current-portfolio-intelligence/load-from-client.ts";
import { assessCurrentPortfolioIntelligenceFacts } from "../lib/current-portfolio-intelligence/map-current-facts.ts";
import { buildPortfolioIntelligenceView } from "../lib/portfolio-intelligence-presentation.ts";
import { buildDashboardPortfolioIntelligence } from "../lib/dashboard-portfolio.ts";
import { buildAskStockGPTPortfolioContext } from "../lib/ask-stockgpt-portfolio-context.ts";
import { buildCanonicalNotificationCandidates } from "../lib/canonical-notifications.ts";
import { buildPortfolioPageChartResult } from "../lib/portfolio-page-chart.ts";
import { buildCurrentPortfolioSnapshotPoint } from "../lib/portfolio-snapshots.ts";

const output = execFileSync(process.execPath, [resolve("node_modules/supabase/dist/supabase.js"), "status", "-o", "env"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const env = Object.fromEntries(output.split(/\r?\n/u).flatMap((line) => {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/u);
  return m ? [[m[1], m[2].startsWith('"') ? JSON.parse(m[2]) : m[2]]] : [];
}));
assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(env.API_URL).hostname));
process.env.NEXT_PUBLIC_SUPABASE_URL = env.API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SERVICE_ROLE_KEY;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
// Guard even accidental remote fetches in a future read implementation.
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  assert(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Non-local network request refused");
  return originalFetch(input, init);
};
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, options);
const client = createClient(env.API_URL, env.ANON_KEY, options);
const owner = "11111111-1111-4111-8111-111111111111";
const asOf = "2026-09-07T12:00:00.000Z";
const ticker = "ZZK";
let id;
let rankingAdded = false;
async function required(call) {
  const { data, error } = await call; assert.equal(error, null, error?.message); return data;
}
async function snapshot() {
  const result = {};
  for (const table of ["user_portfolios", "portfolio_holdings", "portfolio_transactions", "portfolio_snapshots"]) {
    if (table === "portfolio_transactions") { result[table] = await readPortfolioLedger(admin, id); continue; }
    result[table] = await required(admin.from(table).select("*")
      .eq(table === "user_portfolios" ? "id" : "portfolio_id", id).order("id").range(0, 1999));
  }
  return result;
}
async function facts() {
  const [portfolio, holdings, rankings, universe] = await Promise.all([
    required(client.from("user_portfolios").select("*").eq("id", id).single()),
    required(client.from("portfolio_holdings").select("*").eq("portfolio_id", id).order("ticker")),
    required(client.from("stock_rankings").select("ticker,score,rank,price,last_price_update,last_ranking_update").eq("ticker", ticker)),
    client.from("stock_rankings").select("rank", { count: "exact", head: true }).not("rank", "is", null),
  ]);
  assert.equal(universe.error, null);
  return { portfolio, holdings, rankings, diagnostics: [], rankingUniverseSize: universe.count };
}
async function checkSurfaces(expectedValue, limited = false) {
  const before = await snapshot();
  const f = await facts();
  const local = await loadCurrentPortfolioIntelligenceFromClient({ supabase: client, userId: owner, portfolioId: id, asOf });
  assert.equal(local.status, "ready");
  const mapped = assessCurrentPortfolioIntelligenceFacts(f, asOf);
  assert.deepEqual(local.input, mapped.input);
  assert.deepEqual(local.assessment, mapped.assessment);
  assert.equal(local.input.holdings[0].currentValue, expectedValue);
  assert(local.adapterLimitations.includes("canonical_event_severity_source_unmapped"));
  const portfolio = buildPortfolioIntelligenceView({ result: mapped.assessment, adapterLimitations: mapped.adapterLimitations });
  const dashboard = buildDashboardPortfolioIntelligence(f, asOf);
  assert.deepEqual(dashboard, portfolio);
  const ask = buildAskStockGPTPortfolioContext({ facts: f, asOf, holdingMetadata: [], meta: {
    id, name: f.portfolio.name, currency: f.portfolio.currency, cashDepositedTotal: f.portfolio.cash_deposited_total,
    investmentAmount: 999999, createdAt: f.portfolio.created_at, objective: f.portfolio.objective,
    riskTolerance: f.portfolio.risk_tolerance, timeHorizon: f.portfolio.time_horizon,
  } });
  assert.equal(ask.holdings[0].current_value, expectedValue);
  assert.equal(ask.factual_summary.cash_balance, limited ? null : 50);
  assert.equal(ask.meta.cash_deposited_total, limited ? null : -30);
  const notifications = buildCanonicalNotificationCandidates({ asOf, portfolios: [{ portfolioName: f.portfolio.name, facts: f, companiesByTicker: {} }] });
  for (const notification of notifications.filter((n) => n.kind === "canonical_review")) {
    assert.equal(notification.status, portfolio.holdingAssessments[ticker].status);
  }
  if (limited) {
    assert.equal(portfolio.statusLabel, "Analysis limited");
    assert.equal(ask.factual_summary.total_value, null);
    assert.equal(notifications.length, 0);
  }
  // The chart receives the same owner-authorized rows. Deliberately stale
  // enrichment price must not override missing/updated factual market quotes.
  const chart = await buildPortfolioPageChartResult({
    ownerId: owner, portfolio: f.portfolio, transactions: await readPortfolioLedger(client, id),
    enriched: [{ ticker, shares: 1, entryPrice: 100, currentPrice: 999, currentValue: 999, purchaseDate: null, addedAt: asOf }],
    marketFacts: f.rankings, summary: { holdingsCount: 1, totalValue: 175 },
  });
  if (limited || expectedValue == null) assert.deepEqual(chart.chartData, {});
  const point = buildCurrentPortfolioSnapshotPoint({
    portfolio: f.portfolio, holdings: f.holdings,
    currentPrices: Object.fromEntries(f.rankings.map((r) => [r.ticker, r.price])), snapshotAt: new Date(asOf),
  });
  if (!limited && expectedValue != null) {
    assert.equal(point.close, 50 + expectedValue);
    assert.equal(point.basis, -30); assert.equal(point.pnlPct, undefined);
  } else if (!limited) assert.equal(point, null);
  assert.deepEqual(await snapshot(), before, "Read/assessment/chart boundary changed authoritative or semantic history rows");
}
try {
  const login = await required(client.auth.signInWithPassword({ email: "active-subscriber@stockgpt.invalid", password: "LocalStockGPT!2026" }));
  assert.equal(login.user.id, owner);
  assert.deepEqual(await required(admin.from("stock_rankings").select("ticker").eq("ticker", ticker)), [], "Synthetic ticker collision");
  await required(admin.from("stock_rankings").insert({ ticker, score: 6000, rank: 2, price: 125, last_price_update: asOf, last_ranking_update: asOf }));
  rankingAdded = true;
  id = (await required(client.rpc("create_manual_portfolio", { p_name: "05K synthetic read boundary", p_objective: "balanced", p_risk_tolerance: "moderate", p_time_horizon: "long", p_starting_cash: 50, p_holdings: [{ ticker, shares: 1, entry_price: 100 }] })))[0].portfolio_id;
  await required(admin.from("user_portfolios").update({ cash_deposited_total: -30 }).eq("id", id));
  // Over the old 1000-row cap, including a recorded-late / occurred-early entry.
  for (let batch = 0; batch < 3; batch += 1) {
    await required(admin.from("portfolio_transactions").insert(Array.from({ length: 400 }, (_, offset) => ({
      portfolio_id: id, user_id: owner, type: "adjustment", amount: 0, realised_pnl: 1,
      occurred_at: null, created_at: new Date(Date.parse("2026-01-01T00:00:00Z") + (batch * 400 + offset) * 1000).toISOString(),
    }))));
  }
  await required(admin.from("portfolio_transactions").insert({ portfolio_id: id, user_id: owner, type: "adjustment", amount: 0, realised_pnl: 7,
    created_at: new Date().toISOString(), occurred_at: "2000-01-01T00:00:00Z" }));
  const ledger = await readPortfolioLedger(client, id);
  assert.equal(ledger.length, 1203);
  assert.equal(ledger.reduce((sum, t) => sum + (t.realised_pnl ?? 0), 0), 1207);
  assert(ledger.some((t) => t.occurred_at?.startsWith("2000")));
  assert.deepEqual(await readPortfolioLedger(client, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"), []);
  await checkSurfaces(125);
  for (const price of [null, 0]) {
    await required(admin.from("stock_rankings").update({ price }).eq("ticker", ticker));
    await checkSurfaces(null);
  }
  await required(admin.from("stock_rankings").update({ price: 130 }).eq("ticker", ticker));
  await checkSurfaces(130);
  await required(admin.from("user_portfolios").update({ currency: "GBP" }).eq("id", id));
  await checkSurfaces(null, true);
  console.log("05K: authenticated full-ledger reads, signed contribution, missing-price recovery, cross-surface fact parity, legacy availability and read-side-effect checks passed (no browser/LLM call).");
} finally {
  if (id) await required(admin.from("user_portfolios").delete().eq("id", id));
  if (rankingAdded) await required(admin.from("stock_rankings").delete().eq("ticker", ticker));
  await client.auth.signOut();
  globalThis.fetch = originalFetch;
}
