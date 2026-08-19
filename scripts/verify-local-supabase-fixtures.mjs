import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const localPassword = "LocalStockGPT!2026";
const users = {
  active: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "active-subscriber@stockgpt.invalid",
    portfolioId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  },
  free: {
    id: "22222222-2222-4222-8222-222222222222",
    email: "free-user@stockgpt.invalid",
  },
  isolation: {
    id: "33333333-3333-4333-8333-333333333333",
    email: "isolation-user@stockgpt.invalid",
    portfolioId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  },
};

function runSupabase(args, options = {}) {
  const cli = resolve("node_modules", "supabase", "dist", "supabase.js");
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options,
  });
}

function localStatus() {
  const output = runSupabase(["status", "-o", "env"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  return Object.fromEntries(
    output
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u))
      .filter(Boolean)
      .map((match) => {
        const value = match[2].startsWith('"') ? JSON.parse(match[2]) : match[2];
        return [match[1], value];
      }),
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function exactCount(query, expected, message) {
  const { count, error } = await query;
  if (error) throw new Error(`${message}: ${error.message}`);
  assert(count === expected, `${message}: expected ${expected}, received ${count}`);
}

async function authenticatedClient(apiUrl, anonKey, user) {
  const client = createClient(apiUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: localPassword,
  });
  if (error) throw new Error(`Local Auth sign-in failed for ${user.email}: ${error.message}`);
  assert(data.user?.id === user.id, `Local Auth returned the wrong user for ${user.email}`);
  return client;
}

async function verifyActiveUser(client) {
  await exactCount(client.from("profiles").select("id", { count: "exact", head: true }), 1, "Active user profile RLS");
  await exactCount(client.from("user_portfolios").select("id", { count: "exact", head: true }), 1, "Active user portfolio RLS");
  await exactCount(client.from("portfolio_holdings").select("id", { count: "exact", head: true }), 2, "Active user holdings RLS");
  await exactCount(client.from("watchlist").select("id", { count: "exact", head: true }), 1, "Active user watchlist RLS");
  await exactCount(client.from("stock_rankings").select("id", { count: "exact", head: true }), 4, "Active subscriber rankings RLS");
  await exactCount(client.from("user_portfolios").select("id", { count: "exact", head: true }).eq("id", users.isolation.portfolioId), 0, "Active user portfolio isolation");
  await exactCount(client.from("watchlist").select("id", { count: "exact", head: true }).eq("user_id", users.isolation.id), 0, "Active user watchlist isolation");
  const { data, error } = await client.rpc("is_active_subscriber", { user_uuid: users.active.id });
  if (error) throw new Error(`Active subscriber RPC failed: ${error.message}`);
  assert(data === true, "Active user did not pass is_active_subscriber");
}

async function verifyApplicationQuerySeams(client) {
  const { data: watchlistEntry, error: watchlistError } = await client
    .from("watchlist")
    .select("id,ticker")
    .eq("user_id", users.active.id)
    .eq("ticker", "NVDA")
    .maybeSingle();
  if (watchlistError) throw new Error(`Stock-page watchlist query failed: ${watchlistError.message}`);
  assert(watchlistEntry?.ticker === "NVDA", "Stock-page watchlist lookup did not find the seeded row");

  const { data: ranking, error: rankingError } = await client
    .from("stock_rankings")
    .select("ticker,rank,score,price,momentum,pe,risk,updated_at")
    .eq("ticker", "AAPL")
    .maybeSingle();
  if (rankingError) throw new Error(`Financial-metrics ranking query failed: ${rankingError.message}`);
  assert(ranking?.ticker === "AAPL", "Financial-metrics ranking query did not find AAPL");

  const { data: diagnostics, error: diagnosticsError } = await client
    .from("stock_factor_diagnostics")
    .select("ticker,factor_coverage,updated_at")
    .eq("ticker", "AAPL")
    .maybeSingle();
  if (diagnosticsError) throw new Error(`Financial-metrics diagnostics query failed: ${diagnosticsError.message}`);
  assert(
    diagnostics?.ticker === "AAPL" && diagnostics.factor_coverage === 1,
    "Financial-metrics diagnostics query did not provide seeded factor coverage",
  );
}

async function verifyFreeUser(client) {
  await exactCount(client.from("profiles").select("id", { count: "exact", head: true }), 1, "Free user profile RLS");
  await exactCount(client.from("user_portfolios").select("id", { count: "exact", head: true }), 0, "Free-user empty state");
  await exactCount(client.from("stock_rankings").select("id", { count: "exact", head: true }), 0, "Free-user rankings gate");
  const { data, error } = await client.rpc("is_active_subscriber", { user_uuid: users.free.id });
  if (error) throw new Error(`Free subscriber RPC failed: ${error.message}`);
  assert(data === false, "Free user unexpectedly passed is_active_subscriber");
}

async function verifyIsolationUser(client) {
  await exactCount(client.from("user_portfolios").select("id", { count: "exact", head: true }), 1, "Isolation user portfolio RLS");
  await exactCount(client.from("portfolio_holdings").select("id", { count: "exact", head: true }), 1, "Isolation user holdings RLS");
  await exactCount(client.from("watchlist").select("id", { count: "exact", head: true }), 1, "Isolation user watchlist RLS");
  await exactCount(client.from("user_portfolios").select("id", { count: "exact", head: true }).eq("id", users.active.portfolioId), 0, "Isolation user portfolio isolation");
  await exactCount(client.from("watchlist").select("id", { count: "exact", head: true }).eq("user_id", users.active.id), 0, "Isolation user watchlist isolation");
}

runSupabase(["db", "query", "--local", "--file", "supabase/tests/verify_seed.sql"], {
  stdio: "inherit",
});

const status = localStatus();
assert(status.API_URL && status.ANON_KEY, "Local Supabase API configuration is unavailable");

const activeClient = await authenticatedClient(status.API_URL, status.ANON_KEY, users.active);
const freeClient = await authenticatedClient(status.API_URL, status.ANON_KEY, users.free);
const isolationClient = await authenticatedClient(status.API_URL, status.ANON_KEY, users.isolation);

await verifyActiveUser(activeClient);
await verifyApplicationQuerySeams(activeClient);
await verifyFreeUser(freeClient);
await verifyIsolationUser(isolationClient);

await Promise.all([activeClient.auth.signOut(), freeClient.auth.signOut(), isolationClient.auth.signOut()]);

console.log("StockGPT local synthetic seed, Auth, subscriber and RLS assertions passed.");
