import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const password = "LocalStockGPT!2026";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "active-subscriber@stockgpt.invalid",
  seededPortfolioId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
};
const ids = {
  legacy: "a8000000-0000-4800-8800-000000000001",
  directUsd: "a8000000-0000-4800-8800-000000000002",
};

function assert(value, message) {
  if (!value) throw new Error(message);
}

function cli(args, options = {}) {
  return execFileSync(
    process.execPath,
    [resolve("node_modules/supabase/dist/supabase.js"), ...args],
    { cwd: process.cwd(), encoding: "utf8", ...options },
  );
}

function localStatus() {
  return Object.fromEntries(
    cli(["status", "-o", "env"], { stdio: ["ignore", "pipe", "pipe"] })
      .split(/\r?\n/gu)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u))
      .filter(Boolean)
      .map((match) => [match[1], match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]]),
  );
}

async function rejected(call, label) {
  const { error } = await call;
  assert(error, `${label} unexpectedly succeeded`);
}

async function required(call, label) {
  const { data, error } = await call;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

function financialPortfolioFields(row) {
  return {
    currency: row.currency,
    cash_balance: row.cash_balance,
    cash_deposited_total: row.cash_deposited_total,
    investment_amount: row.investment_amount,
  };
}

const env = localStatus();
const apiUrl = env.API_URL;
const anonKey = env.ANON_KEY ?? env.PUBLISHABLE_KEY;
const adminKey = env.SERVICE_ROLE_KEY ?? env.SECRET_KEY;
assert(apiUrl && anonKey && adminKey, "Local Supabase status is missing required values");

const admin = createClient(apiUrl, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authenticated = createClient(apiUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const signIn = await authenticated.auth.signInWithPassword({
  email: user.email,
  password,
});
if (signIn.error) throw new Error(signIn.error.message);
assert(signIn.data.user?.id === user.id, "Authenticated the wrong synthetic user");

await admin.from("user_portfolios").delete().in("id", Object.values(ids));

for (const currency of ["GBP", "EUR", "CHF"]) {
  await rejected(
    authenticated.from("user_portfolios").insert({
      user_id: user.id,
      name: `Hostile ${currency}`,
      objective: "balanced",
      risk_tolerance: "moderate",
      time_horizon: "medium",
      investment_amount: 0,
      cash_balance: 0,
      cash_deposited_total: 0,
      currency,
    }),
    `authenticated direct ${currency} portfolio insert`,
  );
}

await required(
  authenticated.from("user_portfolios").insert({
    id: ids.directUsd,
    user_id: user.id,
    name: "Direct USD control",
    objective: "balanced",
    risk_tolerance: "moderate",
    time_horizon: "medium",
    investment_amount: 0,
    cash_balance: 10,
    cash_deposited_total: 10,
    currency: "USD",
  }),
  "authenticated direct USD insert",
);

await required(
  admin.from("user_portfolios").insert({
    id: ids.legacy,
    user_id: user.id,
    name: "Synthetic legacy GBP",
    objective: "balanced",
    risk_tolerance: "moderate",
    time_horizon: "medium",
    investment_amount: 100,
    cash_balance: 100,
    cash_deposited_total: 500,
    currency: "GBP",
  }),
  "trusted legacy parent setup",
);
await required(
  admin.from("portfolio_holdings").insert({
    portfolio_id: ids.legacy,
    ticker: "AAPL",
    shares: 2,
    entry_price: 50,
    source: "manual",
  }),
  "trusted legacy holding setup",
);
await required(
  admin.from("portfolio_transactions").insert({
    portfolio_id: ids.legacy,
    user_id: user.id,
    ticker: "AAPL",
    type: "import",
    shares: 2,
    price: 50,
    amount: 100,
    currency: "GBP",
    occurred_at: null,
  }),
  "trusted legacy transaction setup",
);

const legacyBefore = await required(
  authenticated.from("user_portfolios").select("id,name,objective,risk_tolerance,time_horizon,currency,cash_balance,cash_deposited_total,investment_amount").eq("id", ids.legacy).single(),
  "legacy owner read",
);
assert(legacyBefore.currency === "GBP", "Legacy currency was rewritten");

await required(
  authenticated.from("user_portfolios").update({ name: "Renamed legacy GBP" }).eq("id", ids.legacy),
  "legacy rename",
);
await required(
  authenticated.from("user_portfolios").update({ objective: "growth", risk_tolerance: "aggressive", time_horizon: "long" }).eq("id", ids.legacy),
  "legacy preference update",
);
await rejected(
  authenticated.from("user_portfolios").update({ currency: "USD" }).eq("id", ids.legacy),
  "legacy currency rewrite",
);
await rejected(
  authenticated.from("user_portfolios").update({ cash_balance: 999 }).eq("id", ids.legacy),
  "legacy financial rewrite",
);

await rejected(
  authenticated.from("portfolio_holdings").insert({ portfolio_id: ids.legacy, ticker: "MSFT", shares: 1, entry_price: 20, source: "manual" }),
  "legacy direct holding insert",
);
await required(
  authenticated.from("portfolio_holdings").update({ shares: 9 }).eq("portfolio_id", ids.legacy).eq("ticker", "AAPL"),
  "legacy direct holding update request",
);
await required(
  authenticated.from("portfolio_holdings").delete().eq("portfolio_id", ids.legacy).eq("ticker", "AAPL"),
  "legacy direct holding delete request",
);
const legacyHolding = await required(
  admin.from("portfolio_holdings").select("shares,entry_price").eq("portfolio_id", ids.legacy).eq("ticker", "AAPL").single(),
  "legacy holding unchanged check",
);
assert(legacyHolding.shares === 2 && legacyHolding.entry_price === 50, "Legacy holding was mutated through direct RLS path");

await rejected(
  authenticated.from("portfolio_transactions").insert({
    portfolio_id: ids.legacy,
    user_id: user.id,
    ticker: "AAPL",
    type: "import",
    shares: 1,
    price: 50,
    amount: 50,
    currency: "GBP",
    occurred_at: null,
  }),
  "legacy direct transaction insert",
);
await rejected(
  authenticated.from("portfolio_transactions").insert({
    portfolio_id: ids.directUsd,
    user_id: user.id,
    type: "deposit",
    amount: 10,
    currency: "GBP",
    occurred_at: null,
  }),
  "canonical parent non-USD transaction insert",
);

const financialCalls = [
  authenticated.rpc("mutate_portfolio_cash", { p_portfolio_id: ids.legacy, p_operation: "deposit", p_amount: 1 }),
  authenticated.rpc("buy_portfolio_holding", { p_portfolio_id: ids.legacy, p_ticker: "AAPL", p_shares: 1, p_price: 1 }),
  authenticated.rpc("log_existing_portfolio_holding", { p_portfolio_id: ids.legacy, p_ticker: "AAPL", p_shares: 1, p_entry_price: 1 }),
  authenticated.rpc("sell_portfolio_holding", { p_portfolio_id: ids.legacy, p_ticker: "AAPL", p_shares: 1, p_price: 1 }),
  authenticated.rpc("correct_portfolio_holding", { p_portfolio_id: ids.legacy, p_ticker: "AAPL", p_shares: 2, p_entry_price: 50 }),
  authenticated.rpc("remove_portfolio_holding_tracking", { p_portfolio_id: ids.legacy, p_ticker: "AAPL" }),
  authenticated.rpc("replace_portfolio_holdings_from_trading212", { p_portfolio_id: ids.legacy, p_holdings: [{ ticker: "AAPL", shares: 2, entry_price: 50 }] }),
];
for (const [index, call] of financialCalls.entries()) {
  await rejected(call, `legacy financial RPC ${index + 1}`);
}

const legacyAfter = await required(
  admin.from("user_portfolios").select("currency,cash_balance,cash_deposited_total,investment_amount").eq("id", ids.legacy).single(),
  "legacy unchanged financial check",
);
assert(JSON.stringify(financialPortfolioFields(legacyAfter)) === JSON.stringify(financialPortfolioFields(legacyBefore)), "Failed hostile writes changed legacy financial values");

const financialSnapshot = async () => {
  const [portfolio, holdings, transactions] = await Promise.all([
    required(admin.from("user_portfolios").select("currency,cash_balance,cash_deposited_total,investment_amount").eq("id", user.seededPortfolioId).single(), "preference portfolio snapshot"),
    required(admin.from("portfolio_holdings").select("id,shares,entry_price").eq("portfolio_id", user.seededPortfolioId).order("id"), "preference holdings snapshot"),
    required(admin.from("portfolio_transactions").select("id,amount,price,realised_pnl,currency").eq("portfolio_id", user.seededPortfolioId).order("id"), "preference ledger snapshot"),
  ]);
  return JSON.stringify({ portfolio, holdings, transactions });
};
const beforePreference = await financialSnapshot();
const profileBefore = await required(admin.from("profiles").select("preferred_currency").eq("id", user.id).single(), "profile currency read");
await required(authenticated.from("profiles").update({ preferred_currency: "GBP" }).eq("id", user.id), "preferred currency update");
assert(await financialSnapshot() === beforePreference, "Display preference changed financial truth");
await required(admin.from("profiles").update({ preferred_currency: profileBefore.preferred_currency }).eq("id", user.id), "preferred currency restore");

await required(authenticated.rpc("delete_owned_portfolio", { p_portfolio_id: ids.legacy }), "legacy exact deletion");
const { count: legacyChildren } = await admin.from("portfolio_holdings").select("id", { count: "exact", head: true }).eq("portfolio_id", ids.legacy);
assert(legacyChildren === 0, "Legacy exact deletion did not cascade holdings");
await required(authenticated.rpc("delete_owned_portfolio", { p_portfolio_id: ids.directUsd }), "USD control cleanup");

console.log("Portfolio currency local authenticated checks passed.");
