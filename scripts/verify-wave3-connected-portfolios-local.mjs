import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const cli = resolve("node_modules", "supabase", "dist", "supabase.js");
const raw = execFileSync(process.execPath, [cli, "status", "-o", "env"], { encoding: "utf8" });
const env = Object.fromEntries(raw.split(/\r?\n/u).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u)).filter(Boolean).map((match) => [match[1], match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]]));
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY ?? env.SECRET_KEY, { auth: { persistSession: false } });
const active = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
const isolation = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
const free = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
const password = "LocalStockGPT!2026";
for (const [client, email] of [[active, "active-subscriber@stockgpt.invalid"], [isolation, "isolation-user@stockgpt.invalid"], [free, "free-user@stockgpt.invalid"]]) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

const accountId = "73000000-0000-4000-8000-000000000001";
const freeConnectionId = "72000000-0000-4000-8000-000000000099";
const freeAccountId = "73000000-0000-4000-8000-000000000099";
let portfolioId = null;
try {
  const freeConnection = await admin.from("broker_connections").insert({
    id: freeConnectionId, user_id: "22222222-2222-4222-8222-222222222222",
    provider_id: "70000000-0000-4000-8000-000000000001", institution_id: "71000000-0000-4000-8000-000000000001",
    external_connection_id: "free-entitlement-check", status: "active", last_successful_sync_at: "2026-01-15T12:00:00Z",
  });
  if (freeConnection.error) throw freeConnection.error;
  const freeAccount = await admin.from("broker_accounts").insert({
    id: freeAccountId, user_id: "22222222-2222-4222-8222-222222222222", connection_id: freeConnectionId,
    institution_id: "71000000-0000-4000-8000-000000000001", external_account_id: "free-entitlement-check",
    name: "Free entitlement fixture", base_currency: "USD", status: "active", last_successful_sync_at: "2026-01-15T12:00:00Z",
  });
  if (freeAccount.error) throw freeAccount.error;
  const freeProjection = await free.rpc("create_connected_portfolio", { p_account_id: freeAccountId });
  assert(freeProjection.error?.message.includes("subscription_required"), "Free user bypassed the connected Portfolio entitlement boundary");

  const first = await active.rpc("create_connected_portfolio", { p_account_id: accountId });
  if (first.error) throw first.error;
  portfolioId = first.data?.[0]?.portfolio_id;
  assert(portfolioId && first.data[0].created === true, "Connected Portfolio was not created");

  const repeated = await active.rpc("create_connected_portfolio", { p_account_id: accountId });
  if (repeated.error) throw repeated.error;
  assert(repeated.data?.[0]?.portfolio_id === portfolioId && repeated.data[0].created === false, "Projection was not idempotent");

  const cross = await isolation.rpc("create_connected_portfolio", { p_account_id: accountId });
  assert(cross.error, "Cross-user broker account projection succeeded");

  const { data: portfolio } = await active.from("user_portfolios").select("management_source,broker_account_id,cash_balance,cash_deposited_total").eq("id", portfolioId).single();
  assert(portfolio?.management_source === "connected" && portfolio.broker_account_id === accountId, "Connected source mapping is incorrect");
  assert(Number(portfolio.cash_balance) === 0 && Number(portfolio.cash_deposited_total) === 0, "Manual financial truth leaked into connected Portfolio");
  const { count: copiedHoldings } = await admin.from("portfolio_holdings").select("id", { count: "exact", head: true }).eq("portfolio_id", portfolioId);
  assert(copiedHoldings === 0, "Broker positions were copied into manual holdings");

  const cashMutation = await active.rpc("mutate_portfolio_cash", { p_portfolio_id: portfolioId, p_operation: "deposit", p_amount: 10 });
  assert(cashMutation.error, "Cash RPC mutated a connected Portfolio");
  const buyMutation = await active.rpc("buy_portfolio_holding", { p_portfolio_id: portfolioId, p_ticker: "AAPL", p_shares: 1, p_price: 10 });
  assert(buyMutation.error, "Holding RPC mutated a connected Portfolio");
  const logMutation = await active.rpc("log_existing_portfolio_holding", { p_portfolio_id: portfolioId, p_ticker: "AAPL", p_shares: 1, p_entry_price: 10 });
  assert(logMutation.error, "Log-existing RPC mutated a connected Portfolio");
  const saleMutation = await active.rpc("sell_portfolio_holding", { p_portfolio_id: portfolioId, p_ticker: "AAPL", p_shares: 1, p_price: 10 });
  assert(saleMutation.error, "Sale RPC accepted a connected Portfolio");
  const correctionMutation = await active.rpc("correct_portfolio_holding", { p_portfolio_id: portfolioId, p_ticker: "AAPL", p_shares: 1, p_entry_price: 10 });
  assert(correctionMutation.error, "Correction RPC accepted a connected Portfolio");
  const removalMutation = await active.rpc("remove_portfolio_holding_tracking", { p_portfolio_id: portfolioId, p_ticker: "AAPL" });
  assert(removalMutation.error, "Remove-from-tracking RPC accepted a connected Portfolio");
  const csvMutation = await active.rpc("replace_portfolio_holdings_from_trading212", { p_portfolio_id: portfolioId, p_holdings: [{ ticker: "AAPL", shares: 1, entry_price: 10 }] });
  assert(csvMutation.error, "CSV replacement RPC mutated a connected Portfolio");
  const directHolding = await admin.from("portfolio_holdings").insert({ portfolio_id: portfolioId, ticker: "AAPL", shares: 1, entry_price: 10 });
  assert(directHolding.error, "Central database guard accepted connected manual holdings");

  const rename = await active.rpc("rename_owned_portfolio", { p_portfolio_id: portfolioId, p_name: "Renamed connected account" });
  if (rename.error) throw rename.error;
  const preferences = await active.rpc("update_owned_portfolio_preferences", { p_portfolio_id: portfolioId, p_objective: "balanced", p_risk_tolerance: "moderate", p_time_horizon: "long" });
  if (preferences.error) throw preferences.error;

  const accountBefore = await admin.from("broker_accounts").select("id").eq("id", accountId).single();
  const removed = await active.rpc("delete_owned_portfolio", { p_portfolio_id: portfolioId });
  if (removed.error) throw removed.error;
  portfolioId = null;
  const accountAfter = await admin.from("broker_accounts").select("id").eq("id", accountId).single();
  assert(accountBefore.data?.id === accountAfter.data?.id, "Portfolio deletion removed broker account history");

  const aliasRead = await active.from("brokerage_institution_aliases").select("id");
  if (aliasRead.error) throw aliasRead.error;
  const aliasWrite = await active.from("brokerage_institution_aliases").insert({ provider_id: "70000000-0000-4000-8000-000000000001", external_institution_id: "hostile", institution_id: "71000000-0000-4000-8000-000000000001" });
  assert(aliasWrite.error, "Browser gained institution mapping mutation authority");
} finally {
  if (portfolioId) await admin.from("user_portfolios").delete().eq("id", portfolioId);
  await admin.from("broker_accounts").delete().eq("id", freeAccountId);
  await admin.from("broker_connections").delete().eq("id", freeConnectionId);
  await Promise.all([active.auth.signOut(), isolation.auth.signOut(), free.auth.signOut()]);
}

console.log("Wave 3 connected Portfolio ownership, idempotence, read-only and lifecycle checks passed.");
