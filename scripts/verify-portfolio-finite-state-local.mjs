// LOCAL ONLY: hostile-state proof for malformed numeric legacy rows.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const cli = resolve("node_modules/supabase/dist/supabase.js");
function supabase(args) {
  return execFileSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
const status = Object.fromEntries(supabase(["status", "-o", "env"]).split(/\r?\n/u).flatMap((line) => {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/u);
  return match ? [[match[1], match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]]] : [];
}));
assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(status.API_URL).hostname), "Refusing non-local Supabase");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const client = createClient(status.API_URL, status.ANON_KEY, options);
const created = new Set();

async function required(call) {
  const { data, error } = await call;
  assert.equal(error, null, error?.message);
  return data;
}
async function rejected(call) {
  const result = await call;
  assert(result.error, "Malformed financial RPC unexpectedly succeeded");
}
async function createPortfolio(label) {
  const rows = await required(client.rpc("create_manual_portfolio", {
    p_name: `05K finite ${label}`,
    p_objective: "balanced",
    p_risk_tolerance: "moderate",
    p_time_horizon: "long",
    p_starting_cash: 100,
    p_holdings: [{ ticker: "AAPL", shares: 10, entry_price: 10 }],
  }));
  created.add(rows[0].portfolio_id);
  return rows[0].portfolio_id;
}
async function injectMalformed(portfolioId, field, value) {
  supabase(["db", "query", "--local", "alter table public.portfolio_holdings drop constraint portfolio_holdings_finite_financial_values"]);
  try {
    await required(admin.from("portfolio_holdings")
      .update({ shares: 10, entry_price: 10, [field]: value })
      .eq("portfolio_id", portfolioId));
  } finally {
    supabase(["db", "query", "--local", `alter table public.portfolio_holdings add constraint portfolio_holdings_finite_financial_values check (
      shares is not null and shares::text not in ('NaN', 'Infinity', '-Infinity') and shares > 0
      and entry_price is not null and entry_price::text not in ('NaN', 'Infinity', '-Infinity') and entry_price > 0
    ) not valid`]);
  }
}
async function state(portfolioId) {
  const [portfolio, holdings, ledger] = await Promise.all([
    required(admin.from("user_portfolios").select("cash_balance,cash_deposited_total").eq("id", portfolioId).single()),
    required(admin.from("portfolio_holdings").select("*").eq("portfolio_id", portfolioId).order("ticker")),
    required(admin.from("portfolio_transactions").select("*").eq("portfolio_id", portfolioId).order("created_at").order("id")),
  ]);
  return { portfolio, holdings, ledger };
}

await required(client.auth.signInWithPassword({
  email: "active-subscriber@stockgpt.invalid",
  password: "LocalStockGPT!2026",
}));
try {
  const malformed = await createPortfolio("arithmetic");
  for (const field of ["shares", "entry_price"]) {
    for (const value of ["NaN", "Infinity", "-Infinity"]) {
      await injectMalformed(malformed, field, value);
      const before = await state(malformed);
      for (const call of [
        client.rpc("buy_portfolio_holding", { p_portfolio_id: malformed, p_ticker: "AAPL", p_shares: 1, p_price: 10 }),
        client.rpc("log_existing_portfolio_holding", { p_portfolio_id: malformed, p_ticker: "AAPL", p_shares: 1, p_entry_price: 10 }),
        client.rpc("sell_portfolio_holding", { p_portfolio_id: malformed, p_ticker: "AAPL", p_shares: 1, p_price: 10 }),
        client.rpc("sell_portfolio_holding", { p_portfolio_id: malformed, p_ticker: "AAPL", p_shares: 10, p_price: 10 }),
      ]) {
        await rejected(call);
        assert.deepEqual(await state(malformed), before, "Rejected malformed operation changed authoritative state");
      }
      await required(client.rpc("correct_portfolio_holding", {
        p_portfolio_id: malformed,
        p_ticker: "AAPL",
        p_shares: 10,
        p_entry_price: 10,
      }));
    }
  }

  const removable = await createPortfolio("removal recovery");
  await injectMalformed(removable, "shares", "NaN");
  await required(client.rpc("remove_portfolio_holding_tracking", {
    p_portfolio_id: removable,
    p_ticker: "AAPL",
  }));
  const removed = await state(removable);
  assert.equal(removed.holdings.length, 0);
  assert.equal(removed.ledger.at(-1)?.type, "adjustment");
  assert.equal(removed.ledger.at(-1)?.shares, null);
  console.log("Local NaN/infinity financial-state rejection and safe cleanup checks passed.");
} finally {
  if (created.size > 0) await required(admin.from("user_portfolios").delete().in("id", [...created]));
  await client.auth.signOut();
}
