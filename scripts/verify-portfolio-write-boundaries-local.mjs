import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

const password = "LocalStockGPT!2026";
const active = { id: "11111111-1111-4111-8111-111111111111", email: "active-subscriber@stockgpt.invalid" };
const isolation = { id: "33333333-3333-4333-8333-333333333333", email: "isolation-user@stockgpt.invalid" };
const ids = {
  active: "a9000000-0000-4900-8900-000000000001",
  isolation: "a9000000-0000-4900-8900-000000000002",
  legacy: "a9000000-0000-4900-8900-000000000003",
  deletion: "a9000000-0000-4900-8900-000000000004",
};

function assert(value, message) { if (!value) throw new Error(message); }
function cli(args, options = {}) {
  return execFileSync(process.execPath, [resolve("node_modules/supabase/dist/supabase.js"), ...args], {
    cwd: process.cwd(), encoding: "utf8", ...options,
  });
}
function status() {
  return Object.fromEntries(cli(["status", "-o", "env"], { stdio: ["ignore", "pipe", "pipe"] })
    .split(/\r?\n/u).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u)).filter(Boolean)
    .map((match) => [match[1], match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]]));
}
async function signedIn(apiUrl, anonKey, user) {
  const client = createClient(apiUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password });
  if (error) throw new Error(error.message);
  assert(data.user?.id === user.id, `Wrong local user for ${user.email}`);
  return client;
}
async function required(call, label) {
  const { data, error } = await call;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}
async function rejected(call, label) {
  const { error } = await call;
  assert(error, `${label} unexpectedly succeeded`);
}
async function count(call, expected, label) {
  const { count: actual, error } = await call;
  if (error) throw new Error(`${label}: ${error.message}`);
  assert(actual === expected, `${label}: expected ${expected}, got ${actual}`);
}

function runtimeFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return runtimeFiles(path);
    return [".ts", ".tsx", ".js", ".jsx", ".mjs"].includes(extname(path)) ? [path] : [];
  });
}
const authoritative = new Set(["user_portfolios", "portfolio_holdings", "portfolio_transactions"]);
const mutations = new Set(["insert", "update", "delete", "upsert"]);
const violations = [];
for (const file of ["app", "components", "lib"].flatMap((root) => runtimeFiles(resolve(root)))) {
  if (file.endsWith("database.types.ts")) continue;
  const content = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && mutations.has(node.expression.name.text)) {
      const chain = node.expression.expression.getText(sourceFile);
      for (const table of authoritative) {
        if (new RegExp(`\\.from\\(\\s*["']${table}["']\\s*\\)`, "u").test(chain)) violations.push(`${file}: ${table}.${node.expression.name.text}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}
assert(violations.length === 0, `Runtime authoritative direct writes remain:\n${violations.join("\n")}`);

const management = readFileSync(resolve("lib/actions/portfolio-management.ts"), "utf8");
const tradeRoute = readFileSync(resolve("app/api/portfolio/holding-trade-levels/route.ts"), "utf8");
assert(!management.includes("getOrCreatePortfolio"), "First-Portfolio mutation fallback remains");
assert(!/markReviewed\s*\(\s*input:\s*MarkReviewedInput\s*\|/u.test(management), "markReviewed still accepts a compatibility overload");
assert(management.includes("markPortfolioHoldingReviewed"), "markReviewed does not use its narrow RPC wrapper");
assert(!/\.from\(\s*["'](?:user_portfolios|portfolio_holdings|portfolio_transactions)["']\s*\)[\s\S]{0,250}?\.(?:insert|update|delete|upsert)\(/u.test(tradeRoute), "Holding trade-level GET still writes authoritative state");

cli(["db", "query", "--local", "--file", "supabase/tests/verify_portfolio_write_boundaries.sql"], { stdio: "inherit" });
const env = status();
const anonKey = env.ANON_KEY ?? env.PUBLISHABLE_KEY;
const adminKey = env.SERVICE_ROLE_KEY ?? env.SECRET_KEY;
assert(env.API_URL && anonKey && adminKey, "Local Supabase status is incomplete");
const admin = createClient(env.API_URL, adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
const userA = await signedIn(env.API_URL, anonKey, active);
const userB = await signedIn(env.API_URL, anonKey, isolation);
const anon = createClient(env.API_URL, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const allIds = Object.values(ids);

try {
  await admin.from("user_portfolios").delete().in("id", allIds);
  for (const row of [
    { id: ids.active, user_id: active.id, name: "05I active", objective: "balanced", risk_tolerance: "moderate", time_horizon: "medium", currency: "USD", cash_balance: 100, cash_deposited_total: 100, investment_amount: 0 },
    { id: ids.isolation, user_id: isolation.id, name: "05I isolation", objective: "balanced", risk_tolerance: "moderate", time_horizon: "medium", currency: "USD", cash_balance: 50, cash_deposited_total: 50, investment_amount: 0 },
    { id: ids.legacy, user_id: active.id, name: "05I legacy", objective: "balanced", risk_tolerance: "moderate", time_horizon: "medium", currency: "GBP", cash_balance: 25, cash_deposited_total: 25, investment_amount: 10 },
    { id: ids.deletion, user_id: active.id, name: "05I deletion", objective: "balanced", risk_tolerance: "moderate", time_horizon: "medium", currency: "USD", cash_balance: 0, cash_deposited_total: 10, investment_amount: 10 },
  ]) await required(admin.from("user_portfolios").insert(row), `trusted setup ${row.id}`);
  for (const portfolioId of [ids.active, ids.isolation, ids.legacy, ids.deletion]) {
    await required(admin.from("portfolio_holdings").insert({ portfolio_id: portfolioId, ticker: "AAPL", shares: 1, entry_price: 10, source: "manual" }), `holding setup ${portfolioId}`);
  }
  await required(admin.from("portfolio_transactions").insert({ portfolio_id: ids.active, user_id: active.id, ticker: "AAPL", type: "log_existing", shares: 1, price: 10, amount: 10, currency: "USD", occurred_at: null }), "active transaction setup");
  await required(admin.from("portfolio_transactions").insert({ portfolio_id: ids.deletion, user_id: active.id, ticker: "AAPL", type: "log_existing", shares: 1, price: 10, amount: 10, currency: "USD", occurred_at: null }), "deletion transaction setup");

  await rejected(anon.from("user_portfolios").select("id"), "anon portfolio SELECT");
  for (const [table, insertRow, updateRow] of [
    ["user_portfolios", { user_id: active.id, name: "hostile", currency: "USD" }, { name: "hostile" }],
    ["portfolio_holdings", { portfolio_id: ids.active, ticker: "MSFT", shares: 1, entry_price: 1 }, { shares: 99 }],
    ["portfolio_transactions", { portfolio_id: ids.active, user_id: active.id, type: "deposit", amount: 1, currency: "USD" }, { amount: 99 }],
  ]) {
    await rejected(userA.from(table).insert(insertRow), `${table} direct INSERT`);
    await rejected(userA.from(table).update(updateRow).eq(table === "user_portfolios" ? "id" : "portfolio_id", ids.active), `${table} direct UPDATE`);
    await rejected(userA.from(table).delete().eq(table === "user_portfolios" ? "id" : "portfolio_id", ids.active), `${table} direct DELETE`);
  }

  await count(userA.from("user_portfolios").select("id", { count: "exact", head: true }).eq("id", ids.active), 1, "own portfolio SELECT");
  await count(userA.from("portfolio_holdings").select("id", { count: "exact", head: true }).eq("portfolio_id", ids.active), 1, "own holding SELECT");
  await count(userA.from("portfolio_transactions").select("id", { count: "exact", head: true }).eq("portfolio_id", ids.active), 1, "own transaction SELECT");
  await count(userA.from("user_portfolios").select("id", { count: "exact", head: true }).eq("id", ids.isolation), 0, "cross-user portfolio SELECT");
  await count(userA.from("portfolio_holdings").select("id", { count: "exact", head: true }).eq("portfolio_id", ids.isolation), 0, "cross-user holding SELECT");
  await count(userA.from("portfolio_transactions").select("id", { count: "exact", head: true }).eq("portfolio_id", ids.isolation), 0, "cross-user transaction SELECT");

  const financialBefore = JSON.stringify(await required(admin.from("user_portfolios").select("cash_balance,cash_deposited_total,investment_amount,currency").eq("id", ids.active).single(), "financial before"));
  const transactionCountBefore = await required(admin.from("portfolio_transactions").select("id", { count: "exact" }).eq("portfolio_id", ids.active), "ledger before");
  await required(userA.rpc("rename_owned_portfolio", { p_portfolio_id: ids.active, p_name: "Renamed 05I" }), "owned rename RPC");
  await required(userA.rpc("update_owned_portfolio_preferences", { p_portfolio_id: ids.active, p_objective: "growth", p_risk_tolerance: "aggressive", p_time_horizon: "long" }), "owned preference RPC");
  const review = await required(userA.rpc("mark_portfolio_holding_reviewed", { p_portfolio_id: ids.active, p_ticker: "aapl" }), "owned review RPC");
  assert(review?.[0]?.reviewed_at, "Review timestamp was not database-generated");
  assert(JSON.stringify(await required(admin.from("user_portfolios").select("cash_balance,cash_deposited_total,investment_amount,currency").eq("id", ids.active).single(), "financial after")) === financialBefore, "Metadata RPC changed financial state");
  const transactionCountAfter = await required(admin.from("portfolio_transactions").select("id", { count: "exact" }).eq("portfolio_id", ids.active), "ledger after");
  assert(transactionCountAfter.length === transactionCountBefore.length, "Review metadata added a ledger row");

  for (const call of [
    userA.rpc("rename_owned_portfolio", { p_portfolio_id: ids.isolation, p_name: "hostile" }),
    userA.rpc("update_owned_portfolio_preferences", { p_portfolio_id: ids.isolation, p_objective: "growth", p_risk_tolerance: "moderate", p_time_horizon: "long" }),
    userA.rpc("mark_portfolio_holding_reviewed", { p_portfolio_id: ids.isolation, p_ticker: "AAPL" }),
    userA.rpc("mark_portfolio_holding_reviewed", { p_portfolio_id: ids.active, p_ticker: "MSFT" }),
    anon.rpc("rename_owned_portfolio", { p_portfolio_id: ids.active, p_name: "anon" }),
  ]) await rejected(call, "unauthorized metadata RPC");
  await rejected(userA.rpc("update_owned_portfolio_preferences", { p_portfolio_id: ids.active, p_objective: "invalid", p_risk_tolerance: "moderate", p_time_horizon: "long" }), "invalid preference RPC");

  await required(userA.rpc("rename_owned_portfolio", { p_portfolio_id: ids.legacy, p_name: "Legacy renamed" }), "legacy rename RPC");
  await required(userA.rpc("update_owned_portfolio_preferences", { p_portfolio_id: ids.legacy, p_objective: "income", p_risk_tolerance: "conservative", p_time_horizon: "short" }), "legacy preferences RPC");
  await required(userA.rpc("mark_portfolio_holding_reviewed", { p_portfolio_id: ids.legacy, p_ticker: "AAPL" }), "legacy review RPC");
  await rejected(userA.rpc("mutate_portfolio_cash", { p_portfolio_id: ids.legacy, p_operation: "deposit", p_amount: 1 }), "legacy financial RPC");

  await rejected(userB.rpc("delete_owned_portfolio", { p_portfolio_id: ids.deletion }), "cross-user delete RPC");
  await required(userA.rpc("delete_owned_portfolio", { p_portfolio_id: ids.deletion }), "exact owner delete RPC");
  await count(admin.from("portfolio_holdings").select("id", { count: "exact", head: true }).eq("portfolio_id", ids.deletion), 0, "holding cascade");
  await count(admin.from("portfolio_transactions").select("id", { count: "exact", head: true }).eq("portfolio_id", ids.deletion), 0, "transaction cascade");
  await count(admin.from("user_portfolios").select("id", { count: "exact", head: true }).eq("id", ids.active), 1, "other portfolio preserved");
  console.log("Portfolio authoritative write-boundary checks passed.");
} finally {
  await admin.from("user_portfolios").delete().in("id", allIds);
  await Promise.all([userA.auth.signOut(), userB.auth.signOut()]);
}
