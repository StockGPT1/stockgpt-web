import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const password = "LocalStockGPT!2026";
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
const ids = {
  replacement: "a5000000-0000-4500-8500-000000000001",
  idempotent: "a5000000-0000-4500-8500-000000000002",
  concurrent: "a5000000-0000-4500-8500-000000000003",
  cashConcurrent: "a5000000-0000-4500-8500-000000000004",
  holdingConcurrent: "a5000000-0000-4500-8500-000000000005",
  nonUsd: "a5000000-0000-4500-8500-000000000006",
  failure: "a5000000-0000-4500-8500-000000000007",
};
const randomPortfolioId = "a5000000-0000-4500-8500-999999999999";

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
    password,
  });
  if (error) throw new Error(error.message);
  assert(data.user?.id === user.id, "Authenticated the wrong synthetic user");
  return client;
}

async function required(call, label) {
  const { data, error } = await call;
  if (error) throw new Error(`${label}: ${error.message}`);
  assert(Array.isArray(data) && data.length === 1, `${label}: missing deterministic result`);
  return data[0];
}

async function rejected(call, expected, label) {
  const { error } = await call;
  assert(error, `${label} unexpectedly succeeded`);
  if (expected) assert(error.message.includes(expected), `${label}: ${error.message}`);
}

async function one(query, label) {
  const { data, error } = await query.single();
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function rows(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data ?? [];
}

async function count(query, expected, label) {
  const { count: found, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  assert(found === expected, `${label}: expected ${expected}, got ${found}`);
}

function holding(ticker, shares, entryPrice, extras = {}) {
  return {
    ticker,
    shares,
    entry_price: entryPrice,
    purchase_date: null,
    score_at_entry: null,
    rank_at_entry: null,
    allocation_pct: null,
    ...extras,
  };
}

function createCsv(client, name, holdings) {
  return client.rpc("create_trading212_portfolio", {
    p_name: name,
    p_holdings: holdings,
  });
}

function replaceCsv(client, portfolioId, holdings) {
  return client.rpc("replace_portfolio_holdings_from_trading212", {
    p_portfolio_id: portfolioId,
    p_holdings: holdings,
  });
}

function portfolio(id, name, cash, contribution, currency = "USD") {
  return {
    id,
    user_id: users.active.id,
    name,
    objective: "balanced",
    risk_tolerance: "moderate",
    time_horizon: "medium",
    investment_amount: 100,
    cash_balance: cash,
    cash_deposited_total: contribution,
    currency,
  };
}

function installFailureTrigger() {
  cli([
    "db",
    "query",
    "--local",
    `
      create function public.stage05g_fail_import_ledger()
      returns trigger language plpgsql set search_path = '' as $function$
      begin
        if new.type = 'import' and exists (
          select 1 from public.user_portfolios p
          where p.id = new.portfolio_id and p.name like '05G Ledger failure%'
        ) then
          raise exception 'stage05g_forced_ledger_failure';
        end if;
        return new;
      end;
      $function$
    `,
  ]);
  cli([
    "db",
    "query",
    "--local",
    "create trigger stage05g_fail_import_ledger before insert on public.portfolio_transactions for each row execute function public.stage05g_fail_import_ledger()",
  ]);
}

function removeFailureTrigger() {
  for (const statement of [
    "drop trigger if exists stage05g_fail_import_ledger on public.portfolio_transactions",
    "drop function if exists public.stage05g_fail_import_ledger()",
  ]) cli(["db", "query", "--local", statement]);
}

cli(["db", "query", "--local", "--file", "supabase/tests/verify_portfolio_csv.sql"], {
  stdio: "inherit",
});
const env = localStatus();
const adminKey = env.SERVICE_ROLE_KEY ?? env.SECRET_KEY;
assert(env.API_URL && env.ANON_KEY && adminKey, "Local Supabase configuration unavailable");
const active = await authenticatedClient(env.API_URL, env.ANON_KEY, users.active);
const isolation = await authenticatedClient(env.API_URL, env.ANON_KEY, users.isolation);
const anon = createClient(env.API_URL, env.ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const admin = createClient(env.API_URL, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
let triggerInstalled = false;

try {
  await admin.from("user_portfolios").delete().in("id", Object.values(ids));
  await admin.from("user_portfolios").delete().like("name", "05G %");
  const isolationBefore = await one(
    admin.from("user_portfolios").select("*").eq("id", users.isolation.portfolioId),
    "isolation Portfolio before 05G",
  );

  await rejected(createCsv(anon, "05G Anonymous", [holding("AAPL", 1, 10)]), null, "anonymous creation");
  await rejected(replaceCsv(anon, ids.replacement, [holding("AAPL", 1, 10)]), null, "anonymous replacement");
  await rejected(
    replaceCsv(active, users.isolation.portfolioId, [holding("AAPL", 1, 10)]),
    "portfolio_not_found",
    "cross-user replacement",
  );
  await rejected(
    replaceCsv(active, randomPortfolioId, [holding("AAPL", 1, 10)]),
    "portfolio_not_found",
    "random-ID replacement",
  );

  const created = await required(
    createCsv(active, "05G CSV creation", [
      holding("AAPL", 2, 100, { purchase_date: "2025-01-02", score_at_entry: 90, rank_at_entry: 1 }),
      holding("MSFT", 3, 50),
    ]),
    "CSV Portfolio creation",
  );
  assert(
    Number(created.holdings_basis) === 350
      && Number(created.cash_balance) === 0
      && Number(created.cash_deposited_total) === 350
      && Number(created.holdings_count) === 2,
    "New CSV Portfolio accounting is incorrect",
  );
  const createdPortfolio = await one(
    admin.from("user_portfolios").select("*").eq("id", created.portfolio_id),
    "created CSV Portfolio",
  );
  assert(
    createdPortfolio.user_id === users.active.id
      && createdPortfolio.currency === "USD"
      && Number(createdPortfolio.cash_balance) === 0
      && Number(createdPortfolio.cash_deposited_total) === 350
      && Number(createdPortfolio.investment_amount) === 350,
    "New CSV Portfolio owner/USD/basis state is incorrect",
  );
  const createdLedger = await one(
    admin
      .from("portfolio_transactions")
      .select("type,amount,currency,occurred_at,created_at")
      .eq("portfolio_id", created.portfolio_id),
    "new CSV ledger",
  );
  assert(
    createdLedger.type === "import"
      && Number(createdLedger.amount) === 350
      && createdLedger.currency === "USD"
      && createdLedger.occurred_at === null
      && Boolean(createdLedger.created_at),
    "New CSV Portfolio ledger semantics are incorrect",
  );
  await count(
    admin.from("portfolio_transactions").select("id", { count: "exact", head: true }).eq("portfolio_id", created.portfolio_id).in("type", ["buy", "sell", "deposit"]),
    0,
    "fabricated CSV executions/cash",
  );

  await admin.from("user_portfolios").insert([
    portfolio(ids.replacement, "05G Replace", 250, 1800),
    portfolio(ids.idempotent, "05G Idempotent", 40, 600),
    portfolio(ids.concurrent, "05G Concurrent", 75, 900),
    portfolio(ids.cashConcurrent, "05G Cash concurrent", 100, 100),
    portfolio(ids.holdingConcurrent, "05G Holding concurrent", 500, 500),
    portfolio(ids.nonUsd, "05G Non USD", 100, 100, "GBP"),
    portfolio(ids.failure, "05G Ledger failure replace", 60, 700),
  ]);
  await admin.from("portfolio_holdings").insert([
    { portfolio_id: ids.replacement, ticker: "OLD1", shares: 1, entry_price: 100, source: "manual" },
    { portfolio_id: ids.replacement, ticker: "OLD2", shares: 2, entry_price: 200, source: "manual" },
    { portfolio_id: ids.replacement, ticker: "OLD3", shares: 3, entry_price: 300, source: "manual" },
    { portfolio_id: ids.idempotent, ticker: "OLDI", shares: 1, entry_price: 50, source: "manual" },
    { portfolio_id: ids.concurrent, ticker: "OLDC", shares: 1, entry_price: 50, source: "manual" },
    { portfolio_id: ids.cashConcurrent, ticker: "OLDD", shares: 1, entry_price: 50, source: "manual" },
    { portfolio_id: ids.holdingConcurrent, ticker: "OLDH", shares: 1, entry_price: 50, source: "manual" },
    { portfolio_id: ids.nonUsd, ticker: "OLDG", shares: 1, entry_price: 50, source: "manual" },
    { portfolio_id: ids.failure, ticker: "KEEP", shares: 7, entry_price: 70, source: "manual" },
  ]);
  await admin.from("portfolio_transactions").insert([
    { portfolio_id: ids.replacement, user_id: users.active.id, type: "deposit", amount: 250, currency: "USD", notes: "05G prior history" },
    { portfolio_id: ids.failure, user_id: users.active.id, type: "adjustment", amount: 0, currency: "USD", notes: "05G prior failure history" },
  ]);

  await rejected(
    replaceCsv(active, ids.nonUsd, [holding("AAPL", 1, 10)]),
    "portfolio_currency_unsupported",
    "non-USD replacement",
  );
  await rejected(replaceCsv(active, ids.replacement, []), "portfolio_initial_state_required", "empty replacement");

  const beforeReplacementLedger = await rows(
    admin.from("portfolio_transactions").select("id").eq("portfolio_id", ids.replacement),
    "replacement prior ledger",
  );
  const replacement = await required(
    replaceCsv(active, ids.replacement, [holding("AAPL", 10, 150), holding("MSFT", 17, 50)]),
    "existing replacement",
  );
  assert(
    Number(replacement.holdings_basis) === 2350
      && Number(replacement.cash_balance) === 250
      && Number(replacement.cash_deposited_total) === 1800,
    "Replacement changed cash/contribution or returned the wrong basis",
  );
  const replacementPortfolio = await one(
    admin.from("user_portfolios").select("cash_balance,cash_deposited_total,investment_amount").eq("id", ids.replacement),
    "replacement Portfolio",
  );
  assert(
    Number(replacementPortfolio.cash_balance) === 250
      && Number(replacementPortfolio.cash_deposited_total) === 1800
      && Number(replacementPortfolio.investment_amount) === 2350,
    "Replacement did not preserve cash/contribution or derive compatibility basis",
  );
  const replacementHoldings = await rows(
    admin.from("portfolio_holdings").select("ticker,shares,entry_price").eq("portfolio_id", ids.replacement).order("ticker"),
    "replacement holdings",
  );
  assert(
    JSON.stringify(replacementHoldings.map((row) => [row.ticker, Number(row.shares), Number(row.entry_price)]))
      === JSON.stringify([["AAPL", 10, 150], ["MSFT", 17, 50]]),
    "Replacement final holdings are not the exact imported set",
  );
  const replacementLedger = await rows(
    admin.from("portfolio_transactions").select("id,type,amount,occurred_at,notes").eq("portfolio_id", ids.replacement).order("created_at"),
    "replacement ledger",
  );
  assert(
    replacementLedger.length === beforeReplacementLedger.length + 1
      && replacementLedger.some((row) => beforeReplacementLedger.some((old) => old.id === row.id))
      && replacementLedger.at(-1)?.type === "import"
      && Number(replacementLedger.at(-1)?.amount) === 0
      && replacementLedger.at(-1)?.occurred_at === null,
    "Replacement did not preserve history and append one neutral import event",
  );

  const repeatHoldings = [holding("AAPL", 4, 25), holding("NVDA", 2, 100)];
  await required(replaceCsv(active, ids.idempotent, repeatHoldings), "first idempotent replacement");
  await required(replaceCsv(active, ids.idempotent, repeatHoldings), "second idempotent replacement");
  const repeated = await rows(
    admin.from("portfolio_holdings").select("ticker,shares,entry_price").eq("portfolio_id", ids.idempotent).order("ticker"),
    "idempotent holdings",
  );
  assert(
    JSON.stringify(repeated.map((row) => [row.ticker, Number(row.shares), Number(row.entry_price)]))
      === JSON.stringify([["AAPL", 4, 25], ["NVDA", 2, 100]]),
    "Repeated replacement doubled or compounded holdings",
  );
  const idempotentPortfolio = await one(
    admin.from("user_portfolios").select("cash_balance,cash_deposited_total").eq("id", ids.idempotent),
    "idempotent Portfolio",
  );
  assert(Number(idempotentPortfolio.cash_balance) === 40 && Number(idempotentPortfolio.cash_deposited_total) === 600, "Repeated replacement changed cash/contribution");

  const concurrentA = [holding("AAPL", 1, 10), holding("MSFT", 2, 20)];
  const concurrentB = [holding("NVDA", 3, 30)];
  const concurrentResults = await Promise.all([
    replaceCsv(active, ids.concurrent, concurrentA),
    replaceCsv(active, ids.concurrent, concurrentB),
  ]);
  assert(concurrentResults.every((result) => !result.error), "A concurrent replacement failed");
  const concurrentFinal = await rows(
    admin.from("portfolio_holdings").select("ticker,shares,entry_price").eq("portfolio_id", ids.concurrent).order("ticker"),
    "concurrent final holdings",
  );
  const finalShape = JSON.stringify(concurrentFinal.map((row) => [row.ticker, Number(row.shares), Number(row.entry_price)]));
  assert(
    finalShape === JSON.stringify([["AAPL", 1, 10], ["MSFT", 2, 20]])
      || finalShape === JSON.stringify([["NVDA", 3, 30]]),
    "Concurrent replacements produced an interleaved holding set",
  );

  const [cashReplacement, cashDeposit] = await Promise.all([
    replaceCsv(active, ids.cashConcurrent, [holding("AAPL", 2, 40)]),
    active.rpc("mutate_portfolio_cash", {
      p_portfolio_id: ids.cashConcurrent,
      p_operation: "deposit",
      p_amount: 25,
    }),
  ]);
  assert(!cashReplacement.error && !cashDeposit.error, "Concurrent cash/replacement operation failed");
  const cashFinal = await one(
    admin.from("user_portfolios").select("cash_balance,cash_deposited_total").eq("id", ids.cashConcurrent),
    "cash/replacement Portfolio",
  );
  assert(Number(cashFinal.cash_balance) === 125 && Number(cashFinal.cash_deposited_total) === 125, "CSV replacement lost a concurrent cash mutation");
  await count(admin.from("portfolio_holdings").select("id", { count: "exact", head: true }).eq("portfolio_id", ids.cashConcurrent).eq("ticker", "AAPL"), 1, "cash/replacement holding coherence");

  const [holdingReplacement, holdingBuy] = await Promise.all([
    replaceCsv(active, ids.holdingConcurrent, [holding("MSFT", 2, 50)]),
    active.rpc("buy_portfolio_holding", {
      p_portfolio_id: ids.holdingConcurrent,
      p_ticker: "NVDA",
      p_shares: 1,
      p_price: 10,
    }),
  ]);
  assert(!holdingReplacement.error && !holdingBuy.error, "Concurrent holding/replacement operation failed");
  const holdingFinal = await rows(
    admin.from("portfolio_holdings").select("ticker").eq("portfolio_id", ids.holdingConcurrent).order("ticker"),
    "holding/replacement final set",
  );
  const holdingTickers = holdingFinal.map((row) => row.ticker).join(",");
  assert(holdingTickers === "MSFT" || holdingTickers === "MSFT,NVDA", "Holding/replacement operations did not serialize coherently");
  const holdingPortfolio = await one(
    admin.from("user_portfolios").select("cash_balance,cash_deposited_total").eq("id", ids.holdingConcurrent),
    "holding/replacement Portfolio",
  );
  assert(Number(holdingPortfolio.cash_balance) === 490 && Number(holdingPortfolio.cash_deposited_total) === 500, "Holding/replacement concurrency lost accounting changes");

  installFailureTrigger();
  triggerInstalled = true;
  await rejected(
    createCsv(active, "05G Ledger failure create", [holding("AAPL", 1, 10)]),
    "stage05g_forced_ledger_failure",
    "forced create ledger failure",
  );
  await count(
    admin.from("user_portfolios").select("id", { count: "exact", head: true }).eq("name", "05G Ledger failure create"),
    0,
    "forced create parent rollback",
  );
  const failureBeforePortfolio = await one(
    admin.from("user_portfolios").select("*").eq("id", ids.failure),
    "failure Portfolio before",
  );
  const failureBeforeHoldings = await rows(
    admin.from("portfolio_holdings").select("ticker,shares,entry_price").eq("portfolio_id", ids.failure).order("ticker"),
    "failure holdings before",
  );
  const failureBeforeLedger = await rows(
    admin.from("portfolio_transactions").select("id,type,amount").eq("portfolio_id", ids.failure).order("created_at"),
    "failure ledger before",
  );
  await rejected(
    replaceCsv(active, ids.failure, [holding("AAPL", 9, 99)]),
    "stage05g_forced_ledger_failure",
    "forced replacement ledger failure",
  );
  removeFailureTrigger();
  triggerInstalled = false;
  const failureAfterPortfolio = await one(
    admin.from("user_portfolios").select("*").eq("id", ids.failure),
    "failure Portfolio after",
  );
  const failureAfterHoldings = await rows(
    admin.from("portfolio_holdings").select("ticker,shares,entry_price").eq("portfolio_id", ids.failure).order("ticker"),
    "failure holdings after",
  );
  const failureAfterLedger = await rows(
    admin.from("portfolio_transactions").select("id,type,amount").eq("portfolio_id", ids.failure).order("created_at"),
    "failure ledger after",
  );
  assert(JSON.stringify(failureAfterPortfolio) === JSON.stringify(failureBeforePortfolio), "Forced replacement failure changed parent financial state");
  assert(JSON.stringify(failureAfterHoldings) === JSON.stringify(failureBeforeHoldings), "Forced replacement failure did not restore original holdings");
  assert(JSON.stringify(failureAfterLedger) === JSON.stringify(failureBeforeLedger), "Forced replacement failure changed ledger history");

  const isolationAfter = await one(
    admin.from("user_portfolios").select("*").eq("id", users.isolation.portfolioId),
    "isolation Portfolio after 05G",
  );
  assert(JSON.stringify(isolationAfter) === JSON.stringify(isolationBefore), "05G changed another user's Portfolio");
} finally {
  if (triggerInstalled) removeFailureTrigger();
  await admin.from("user_portfolios").delete().in("id", Object.values(ids));
  await admin.from("user_portfolios").delete().like("name", "05G %");
  await Promise.all([active.auth.signOut(), isolation.auth.signOut()]);
}

console.log("Local Trading 212 atomic creation/replacement, ownership, idempotence, concurrency and rollback assertions passed.");
