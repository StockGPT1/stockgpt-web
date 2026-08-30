import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const localPassword = "LocalStockGPT!2026";
const users = {
  active: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "active-subscriber@stockgpt.invalid",
  },
  isolation: {
    id: "33333333-3333-4333-8333-333333333333",
    email: "isolation-user@stockgpt.invalid",
    portfolioId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  },
};

const portfolioIds = {
  deposit: "d5000000-0000-4500-8500-000000000001",
  withdrawal: "d5000000-0000-4500-8500-000000000002",
  concurrentDeposit: "d5000000-0000-4500-8500-000000000003",
  concurrentWithdrawal: "d5000000-0000-4500-8500-000000000004",
  rollback: "d5000000-0000-4500-8500-000000000005",
  nonUsd: "d5000000-0000-4500-8500-000000000006",
  random: "d5000000-0000-4500-8500-000000000099",
};
const holdingId = "d5100000-0000-4510-8510-000000000001";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
      .map((match) => [
        match[1],
        match[2].startsWith('"') ? JSON.parse(match[2]) : match[2],
      ]),
  );
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

async function requiredSingle(query, message) {
  const { data, error } = await query.single();
  if (error) throw new Error(`${message}: ${error.message}`);
  return data;
}

async function exactCount(query, expected, message) {
  const { count, error } = await query;
  if (error) throw new Error(`${message}: ${error.message}`);
  assert(count === expected, `${message}: expected ${expected}, received ${count}`);
}

async function callCash(client, portfolioId, operation, amount) {
  return client.rpc("mutate_portfolio_cash", {
    p_portfolio_id: portfolioId,
    p_operation: operation,
    p_amount: amount,
  });
}

async function requiredCash(client, portfolioId, operation, amount, message) {
  const { data, error } = await callCash(client, portfolioId, operation, amount);
  if (error) throw new Error(`${message}: ${error.message}`);
  assert(Array.isArray(data) && data.length === 1, `${message}: expected one deterministic result row`);
  return data[0];
}

async function rejectedCash(client, portfolioId, operation, amount, expected, message) {
  const { error } = await callCash(client, portfolioId, operation, amount);
  assert(error, `${message}: hostile/invalid RPC unexpectedly succeeded`);
  if (expected) {
    assert(error.message.includes(expected), `${message}: unexpected error ${error.message}`);
  }
  return error;
}

function portfolio(id, cash, contribution, currency = "USD") {
  return {
    id,
    user_id: users.active.id,
    name: `Stage 05D ${id.slice(-2)}`,
    risk_tolerance: "moderate",
    time_horizon: "medium_term",
    objective: "balanced",
    investment_amount: 777,
    cash_balance: cash,
    cash_deposited_total: contribution,
    currency,
  };
}

function installFailureTrigger() {
  runSupabase([
    "db",
    "query",
    "--local",
    `
      create or replace function public.stage05d_test_cash_ledger_failure()
      returns trigger
      language plpgsql
      set search_path = ''
      as $function$
      begin
        if new.portfolio_id = '${portfolioIds.rollback}'::uuid
          and new.type in ('deposit', 'withdrawal') then
          raise exception 'stage05d_forced_ledger_failure';
        end if;
        return new;
      end;
      $function$;
    `,
  ]);
  runSupabase([
    "db",
    "query",
    "--local",
    `
      create trigger stage05d_test_cash_ledger_failure
        before insert on public.portfolio_transactions
        for each row execute function public.stage05d_test_cash_ledger_failure()
    `,
  ]);
}

function removeFailureTrigger() {
  runSupabase([
    "db",
    "query",
    "--local",
    `
      drop trigger if exists stage05d_test_cash_ledger_failure
        on public.portfolio_transactions
    `,
  ]);
  runSupabase([
    "db",
    "query",
    "--local",
    "drop function if exists public.stage05d_test_cash_ledger_failure()",
  ]);
}

runSupabase(
  ["db", "query", "--local", "--file", "supabase/tests/verify_portfolio_cash.sql"],
  { stdio: "inherit" },
);

const status = localStatus();
const adminKey = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
assert(status.API_URL && status.ANON_KEY && adminKey, "Local Supabase API configuration is unavailable");

const activeClient = await authenticatedClient(status.API_URL, status.ANON_KEY, users.active);
const isolationClient = await authenticatedClient(status.API_URL, status.ANON_KEY, users.isolation);
const unauthenticatedClient = createClient(status.API_URL, status.ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const admin = createClient(status.API_URL, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const temporaryPortfolioIds = Object.values(portfolioIds).filter((id) => id !== portfolioIds.random);

let failureTriggerInstalled = false;
try {
  await admin.from("user_portfolios").delete().in("id", temporaryPortfolioIds);
  const { error: setupError } = await admin.from("user_portfolios").insert([
    portfolio(portfolioIds.deposit, 100, 20),
    portfolio(portfolioIds.withdrawal, 100, 20),
    portfolio(portfolioIds.concurrentDeposit, 100, 50),
    portfolio(portfolioIds.concurrentWithdrawal, 100, 20),
    portfolio(portfolioIds.rollback, 40, 10),
    portfolio(portfolioIds.nonUsd, 100, 100, "GBP"),
  ]);
  if (setupError) throw new Error(`Could not create Stage 05D portfolios: ${setupError.message}`);

  const { error: holdingSetupError } = await admin.from("portfolio_holdings").insert({
    id: holdingId,
    portfolio_id: portfolioIds.deposit,
    ticker: "AAPL",
    shares: 1,
    entry_price: 100,
    source: "manual",
  });
  if (holdingSetupError) throw new Error(`Could not create Stage 05D holding: ${holdingSetupError.message}`);

  const isolationBefore = await requiredSingle(
    admin
      .from("user_portfolios")
      .select("id,cash_balance,cash_deposited_total,investment_amount")
      .eq("id", users.isolation.portfolioId),
    "Could not capture isolation Portfolio state",
  );
  await rejectedCash(
    unauthenticatedClient,
    portfolioIds.deposit,
    "deposit",
    10,
    null,
    "Unauthenticated cash mutation",
  );
  await rejectedCash(
    activeClient,
    users.isolation.portfolioId,
    "deposit",
    10,
    "portfolio_not_found",
    "Cross-user cash mutation",
  );
  await rejectedCash(
    activeClient,
    portfolioIds.random,
    "deposit",
    10,
    "portfolio_not_found",
    "Missing Portfolio cash mutation",
  );

  const depositStartedAt = Date.now();
  const deposit = await requiredCash(
    activeClient,
    portfolioIds.deposit,
    "deposit",
    10.005,
    "Atomic deposit",
  );
  const depositFinishedAt = Date.now();
  assert(Number(deposit.amount) === 10.01, "Deposit amount did not round to two decimals");
  assert(Number(deposit.cash_balance) === 110.01, "Deposit cash result is incorrect");
  assert(Number(deposit.cash_deposited_total) === 30.01, "Deposit contribution result is incorrect");
  assert(
    Date.parse(deposit.created_at) >= depositStartedAt - 1000
      && Date.parse(deposit.created_at) <= depositFinishedAt + 1000
      && Date.parse(deposit.occurred_at) >= depositStartedAt - 1000
      && Date.parse(deposit.occurred_at) <= depositFinishedAt + 1000,
    "Deposit ledger timestamps were not generated at execution time",
  );

  const depositPortfolio = await requiredSingle(
    admin
      .from("user_portfolios")
      .select("cash_balance,cash_deposited_total,investment_amount")
      .eq("id", portfolioIds.deposit),
    "Could not verify deposit Portfolio",
  );
  assert(Number(depositPortfolio.cash_balance) === 110.01, "Committed deposit cash is incorrect");
  assert(Number(depositPortfolio.cash_deposited_total) === 30.01, "Committed deposit contribution is incorrect");
  assert(Number(depositPortfolio.investment_amount) === 777, "Deposit changed investment_amount");
  await exactCount(
    admin
      .from("portfolio_holdings")
      .select("id", { count: "exact", head: true })
      .eq("id", holdingId)
      .eq("shares", 1),
    1,
    "Deposit holding preservation",
  );
  const depositLedger = await requiredSingle(
    admin
      .from("portfolio_transactions")
      .select("id,portfolio_id,user_id,type,amount,currency,occurred_at,created_at")
      .eq("id", deposit.transaction_id),
    "Could not verify deposit ledger row",
  );
  assert(
    depositLedger.portfolio_id === portfolioIds.deposit
      && depositLedger.user_id === users.active.id
      && depositLedger.type === "deposit"
      && Number(depositLedger.amount) === 10.01
      && depositLedger.currency === "USD",
    "Deposit ledger contract is incorrect",
  );
  await exactCount(
    admin
      .from("portfolio_transactions")
      .select("id", { count: "exact", head: true })
      .eq("portfolio_id", portfolioIds.deposit)
      .eq("type", "deposit"),
    1,
    "Atomic deposit ledger row count",
  );

  const { error: updateError } = await activeClient
    .from("portfolio_transactions")
    .update({ amount: 999 })
    .eq("id", deposit.transaction_id);
  assert(updateError, "Authenticated user updated the RPC ledger row");
  const { error: deleteError } = await activeClient
    .from("portfolio_transactions")
    .delete()
    .eq("id", deposit.transaction_id);
  assert(deleteError, "Authenticated user deleted the RPC ledger row");

  const withdrawal = await requiredCash(
    activeClient,
    portfolioIds.withdrawal,
    "withdrawal",
    50,
    "Atomic withdrawal",
  );
  assert(Number(withdrawal.cash_balance) === 50, "Withdrawal cash result is incorrect");
  assert(
    Number(withdrawal.cash_deposited_total) === -30,
    "Withdrawal did not allow negative net contributed capital",
  );
  const withdrawalLedger = await requiredSingle(
    admin
      .from("portfolio_transactions")
      .select("portfolio_id,user_id,type,amount,currency")
      .eq("id", withdrawal.transaction_id),
    "Could not verify withdrawal ledger row",
  );
  assert(
    withdrawalLedger.type === "withdrawal"
      && Number(withdrawalLedger.amount) === 50
      && withdrawalLedger.portfolio_id === portfolioIds.withdrawal
      && withdrawalLedger.user_id === users.active.id
      && withdrawalLedger.currency === "USD",
    "Withdrawal ledger contract is incorrect",
  );
  await exactCount(
    admin
      .from("portfolio_transactions")
      .select("id", { count: "exact", head: true })
      .eq("portfolio_id", portfolioIds.withdrawal)
      .eq("type", "withdrawal"),
    1,
    "Atomic withdrawal ledger row count",
  );
  const beforeInsufficient = await requiredSingle(
    admin
      .from("user_portfolios")
      .select("cash_balance,cash_deposited_total")
      .eq("id", portfolioIds.withdrawal),
    "Could not capture withdrawal state",
  );
  await rejectedCash(
    activeClient,
    portfolioIds.withdrawal,
    "withdrawal",
    51,
    "insufficient_cash",
    "Excessive withdrawal",
  );
  const afterInsufficient = await requiredSingle(
    admin
      .from("user_portfolios")
      .select("cash_balance,cash_deposited_total")
      .eq("id", portfolioIds.withdrawal),
    "Could not verify excessive-withdrawal rollback",
  );
  assert(
    JSON.stringify(afterInsufficient) === JSON.stringify(beforeInsufficient),
    "Excessive withdrawal changed Portfolio balances",
  );

  await rejectedCash(
    activeClient,
    portfolioIds.nonUsd,
    "deposit",
    10,
    "portfolio_currency_unsupported",
    "Ambiguous non-USD cash mutation",
  );

  const concurrentDeposits = await Promise.all([
    callCash(activeClient, portfolioIds.concurrentDeposit, "deposit", 10),
    callCash(activeClient, portfolioIds.concurrentDeposit, "deposit", 15),
  ]);
  assert(concurrentDeposits.every((result) => !result.error), "A concurrent deposit failed");
  const afterConcurrentDeposits = await requiredSingle(
    admin
      .from("user_portfolios")
      .select("cash_balance,cash_deposited_total")
      .eq("id", portfolioIds.concurrentDeposit),
    "Could not verify concurrent deposits",
  );
  assert(
    Number(afterConcurrentDeposits.cash_balance) === 125
      && Number(afterConcurrentDeposits.cash_deposited_total) === 75,
    "Concurrent deposits lost an update",
  );
  await exactCount(
    admin
      .from("portfolio_transactions")
      .select("id", { count: "exact", head: true })
      .eq("portfolio_id", portfolioIds.concurrentDeposit)
      .eq("type", "deposit"),
    2,
    "Concurrent deposit ledger rows",
  );

  const competingWithdrawals = await Promise.all([
    callCash(activeClient, portfolioIds.concurrentWithdrawal, "withdrawal", 80),
    callCash(activeClient, portfolioIds.concurrentWithdrawal, "withdrawal", 80),
  ]);
  assert(
    competingWithdrawals.filter((result) => !result.error).length === 1
      && competingWithdrawals.filter((result) => result.error?.message.includes("insufficient_cash")).length === 1,
    "Competing withdrawals did not produce exactly one success and one insufficient-cash failure",
  );
  const afterCompetingWithdrawals = await requiredSingle(
    admin
      .from("user_portfolios")
      .select("cash_balance,cash_deposited_total")
      .eq("id", portfolioIds.concurrentWithdrawal),
    "Could not verify competing withdrawals",
  );
  assert(
    Number(afterCompetingWithdrawals.cash_balance) === 20
      && Number(afterCompetingWithdrawals.cash_deposited_total) === -60,
    "Competing withdrawals overspent or changed contribution more than once",
  );
  await exactCount(
    admin
      .from("portfolio_transactions")
      .select("id", { count: "exact", head: true })
      .eq("portfolio_id", portfolioIds.concurrentWithdrawal)
      .eq("type", "withdrawal"),
    1,
    "Competing withdrawal ledger rows",
  );

  const rollbackBefore = await requiredSingle(
    admin
      .from("user_portfolios")
      .select("cash_balance,cash_deposited_total,investment_amount")
      .eq("id", portfolioIds.rollback),
    "Could not capture forced-failure Portfolio",
  );
  installFailureTrigger();
  failureTriggerInstalled = true;
  await rejectedCash(
    activeClient,
    portfolioIds.rollback,
    "deposit",
    7,
    "stage05d_forced_ledger_failure",
    "Forced ledger failure",
  );
  removeFailureTrigger();
  failureTriggerInstalled = false;
  const rollbackAfter = await requiredSingle(
    admin
      .from("user_portfolios")
      .select("cash_balance,cash_deposited_total,investment_amount")
      .eq("id", portfolioIds.rollback),
    "Could not verify forced-failure rollback",
  );
  assert(
    JSON.stringify(rollbackAfter) === JSON.stringify(rollbackBefore),
    "Ledger failure did not roll back Portfolio cash state",
  );
  await exactCount(
    admin
      .from("portfolio_transactions")
      .select("id", { count: "exact", head: true })
      .eq("portfolio_id", portfolioIds.rollback),
    0,
    "Forced-failure ledger state",
  );

  const isolationAfter = await requiredSingle(
    admin
      .from("user_portfolios")
      .select("id,cash_balance,cash_deposited_total,investment_amount")
      .eq("id", users.isolation.portfolioId),
    "Could not verify isolation Portfolio state",
  );
  assert(
    JSON.stringify(isolationAfter) === JSON.stringify(isolationBefore),
    "Cash tests changed another user's Portfolio",
  );

  await exactCount(
    admin
      .from("user_portfolios")
      .select("id", { count: "exact", head: true })
      .eq("id", portfolioIds.random),
    0,
    "Missing-ID fallback Portfolio creation",
  );
} finally {
  if (failureTriggerInstalled) removeFailureTrigger();
  await admin.from("user_portfolios").delete().in("id", temporaryPortfolioIds);
  await Promise.all([activeClient.auth.signOut(), isolationClient.auth.signOut()]);
}

console.log(
  "Local atomic cash ownership, rounding, contribution, concurrency and rollback assertions passed.",
);
