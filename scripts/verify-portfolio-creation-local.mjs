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
const randomPortfolioId = "f6000000-0000-4600-8600-999999999999";

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
    password,
  });
  if (error) throw new Error(error.message);
  assert(data.user?.id === user.id, "Authenticated the wrong local synthetic user");
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

async function count(query, expected, label) {
  const { count: found, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  assert(found === expected, `${label}: expected ${expected}, got ${found}`);
}

function manual(client, name, startingCash, holdings) {
  return client.rpc("create_manual_portfolio", {
    p_name: name,
    p_objective: "balanced",
    p_risk_tolerance: "moderate",
    p_time_horizon: "long",
    p_starting_cash: startingCash,
    p_holdings: holdings,
  });
}

function ai(client, name, holdings) {
  return client.rpc("create_ai_portfolio_draft", {
    p_name: name,
    p_risk_tolerance: "aggressive",
    p_time_horizon: "long",
    p_holdings: holdings,
  });
}

function holding(ticker, shares, entryPrice, extras = {}) {
  return { ticker, shares, entry_price: entryPrice, ...extras };
}

function installFailureTriggers() {
  cli([
    "db",
    "query",
    "--local",
    `
      create function public.stage05f_fail_creation_ledger()
      returns trigger language plpgsql set search_path = '' as $function$
      begin
        if exists (
          select 1 from public.user_portfolios p
          where p.id = new.portfolio_id and p.name like '05F Ledger failure%'
        ) then
          raise exception 'stage05f_forced_ledger_failure';
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
    "create trigger stage05f_fail_creation_ledger before insert on public.portfolio_transactions for each row execute function public.stage05f_fail_creation_ledger()",
  ]);
  cli([
    "db",
    "query",
    "--local",
    `
      create function public.stage05f_fail_creation_holding()
      returns trigger language plpgsql set search_path = '' as $function$
      begin
        if exists (
          select 1 from public.user_portfolios p
          where p.id = new.portfolio_id and p.name = '05F Holding failure'
        ) then
          raise exception 'stage05f_forced_holding_failure';
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
    "create trigger stage05f_fail_creation_holding before insert on public.portfolio_holdings for each row execute function public.stage05f_fail_creation_holding()",
  ]);
}

function removeFailureTriggers() {
  for (const statement of [
    "drop trigger if exists stage05f_fail_creation_ledger on public.portfolio_transactions",
    "drop function if exists public.stage05f_fail_creation_ledger()",
    "drop trigger if exists stage05f_fail_creation_holding on public.portfolio_holdings",
    "drop function if exists public.stage05f_fail_creation_holding()",
  ]) cli(["db", "query", "--local", statement]);
}

cli(["db", "query", "--local", "--file", "supabase/tests/verify_portfolio_creation.sql"], {
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
let triggersInstalled = false;

try {
  await admin.from("user_portfolios").delete().like("name", "05F %");
  const isolationBefore = await one(
    admin.from("user_portfolios").select("*").eq("id", users.isolation.portfolioId),
    "isolation Portfolio before tests",
  );

  await rejected(manual(anon, "05F Anonymous", 10, []), null, "unauthenticated creation");
  await rejected(
    active.rpc("delete_owned_portfolio", { p_portfolio_id: null }),
    "portfolio_id_required",
    "missing-ID deletion",
  );

  const manualCreated = await required(
    manual(active, "05F Manual", 500, [
      holding("AAA", 2, 100, { purchase_date: "2024-01-02", notes: "Synthetic position A" }),
      holding("BBB", 3, 50, { purchase_date: null, notes: "Synthetic position B" }),
    ]),
    "manual creation",
  );
  assert(
    Number(manualCreated.cash_balance) === 500
      && Number(manualCreated.holdings_basis) === 350
      && Number(manualCreated.cash_deposited_total) === 850
      && Number(manualCreated.holdings_count) === 2,
    "Manual creation totals are incorrect",
  );
  const manualPortfolio = await one(
    admin.from("user_portfolios").select("*").eq("id", manualCreated.portfolio_id),
    "manual Portfolio",
  );
  assert(
    manualPortfolio.user_id === users.active.id
      && manualPortfolio.currency === "USD"
      && Number(manualPortfolio.investment_amount) === 350
      && Number(manualPortfolio.cash_balance) === 500
      && Number(manualPortfolio.cash_deposited_total) === 850,
    "Manual parent accounting or ownership is incorrect",
  );
  await count(
    admin.from("portfolio_holdings").select("id", { count: "exact", head: true }).eq("portfolio_id", manualCreated.portfolio_id),
    2,
    "manual holdings",
  );
  const { data: manualLedger, error: manualLedgerError } = await admin
    .from("portfolio_transactions")
    .select("type,ticker,shares,price,amount,currency,occurred_at,created_at")
    .eq("portfolio_id", manualCreated.portfolio_id)
    .order("type");
  if (manualLedgerError) throw new Error(manualLedgerError.message);
  assert(manualLedger.length === 3, "Manual creation did not append exactly three ledger rows");
  const deposit = manualLedger.find((row) => row.type === "deposit");
  const existing = manualLedger.filter((row) => row.type === "log_existing");
  assert(
    Number(deposit?.amount) === 500
      && deposit?.occurred_at === null
      && Boolean(deposit?.created_at)
      && existing.length === 2
      && existing.every((row) => row.occurred_at === null)
      && existing.reduce((sum, row) => sum + Number(row.amount), 0) === 350
      && manualLedger.every((row) => row.type !== "buy" && row.type !== "sell"),
    "Manual initial ledger semantics are incorrect",
  );

  const cashOnly = await required(manual(active, "05F Cash only", 125, []), "cash-only creation");
  assert(Number(cashOnly.cash_deposited_total) === 125 && Number(cashOnly.holdings_basis) === 0, "Cash-only totals wrong");
  const holdingsOnly = await required(
    manual(active, "05F Holdings only", 0, [holding("CCC", 4, 25)]),
    "holdings-only creation",
  );
  assert(Number(holdingsOnly.cash_balance) === 0 && Number(holdingsOnly.cash_deposited_total) === 100, "Holdings-only totals wrong");

  const aiCreated = await required(
    ai(active, "05F AI basis", [
      holding("AAPL", 1, 497.42, { score_at_entry: 90, rank_at_entry: 1, allocation_pct: 49.85 }),
      holding("MSFT", 1, 500, { score_at_entry: 88, rank_at_entry: 2, allocation_pct: 50.15 }),
    ]),
    "AI creation",
  );
  assert(
    Number(aiCreated.holdings_basis) === 997.42
      && Number(aiCreated.cash_balance) === 0
      && Number(aiCreated.cash_deposited_total) === 997.42,
    "AI accounting did not follow persisted holding basis",
  );
  const aiPortfolio = await one(
    admin.from("user_portfolios").select("investment_amount,cash_balance,cash_deposited_total,currency,user_id").eq("id", aiCreated.portfolio_id),
    "AI Portfolio",
  );
  assert(
    Number(aiPortfolio.investment_amount) === 997.42
      && Number(aiPortfolio.cash_balance) === 0
      && Number(aiPortfolio.cash_deposited_total) === 997.42
      && aiPortfolio.currency === "USD"
      && aiPortfolio.user_id === users.active.id,
    "AI parent accounting is incorrect",
  );
  const aiLedger = await one(
    admin.from("portfolio_transactions").select("type,amount,occurred_at,created_at").eq("portfolio_id", aiCreated.portfolio_id),
    "AI initialization ledger",
  );
  assert(
    aiLedger.type === "import"
      && Number(aiLedger.amount) === 997.42
      && aiLedger.occurred_at === null
      && Boolean(aiLedger.created_at),
    "AI initialization fabricated a buy or occurrence time",
  );

  for (const [label, call] of [
    ["empty", manual(active, "05F Invalid empty", 0, [])],
    ["duplicate", manual(active, "05F Invalid duplicate", 0, [holding("AAA", 1, 10), holding("AAA", 1, 10)])],
    ["zero shares", manual(active, "05F Invalid shares", 0, [holding("AAA", 0, 10)])],
    ["negative price", manual(active, "05F Invalid price", 0, [holding("AAA", 1, -10)])],
    ["missing shares", manual(active, "05F Invalid missing shares", 0, [{ ticker: "AAA", entry_price: 10 }])],
    ["missing price", ai(active, "05F Invalid missing price", [{ ticker: "AAPL", shares: 1 }])],
    ["too many", manual(active, "05F Invalid limit", 0, Array.from({ length: 101 }, (_, index) => holding(`Z${String(index).padStart(3, "0")}`, 1, 1)))],
    ["invalid AI holding", ai(active, "05F Invalid AI", [holding("AAPL", 0, 10)])],
  ]) {
    await rejected(call, null, label);
  }
  await count(
    admin.from("user_portfolios").select("id", { count: "exact", head: true }).like("name", "05F Invalid%"),
    0,
    "invalid creation rollback",
  );

  installFailureTriggers();
  triggersInstalled = true;
  await rejected(
    manual(active, "05F Ledger failure manual", 0, [holding("AAA", 1, 10)]),
    "stage05f_forced_ledger_failure",
    "manual forced ledger failure",
  );
  await rejected(
    ai(active, "05F Ledger failure AI", [holding("AAPL", 1, 10)]),
    "stage05f_forced_ledger_failure",
    "AI forced ledger failure",
  );
  await rejected(
    manual(active, "05F Holding failure", 10, [holding("AAA", 1, 10)]),
    "stage05f_forced_holding_failure",
    "manual forced holding failure",
  );
  removeFailureTriggers();
  triggersInstalled = false;
  await count(
    admin.from("user_portfolios").select("id", { count: "exact", head: true }).like("name", "05F %failure%"),
    0,
    "forced-failure parent rollback",
  );

  await rejected(
    active.rpc("delete_owned_portfolio", { p_portfolio_id: users.isolation.portfolioId }),
    "portfolio_not_found",
    "cross-user deletion",
  );
  await rejected(
    active.rpc("delete_owned_portfolio", { p_portfolio_id: randomPortfolioId }),
    "portfolio_not_found",
    "random-ID deletion",
  );

  const deleteTarget = await required(
    manual(active, "05F Delete target", 10, [holding("DDD", 2, 20)]),
    "deletion target creation",
  );
  const keepTarget = await required(manual(active, "05F Keep target", 15, []), "preserved Portfolio creation");
  const deleted = await required(
    active.rpc("delete_owned_portfolio", { p_portfolio_id: deleteTarget.portfolio_id }),
    "exact owned deletion",
  );
  assert(deleted.portfolio_id === deleteTarget.portfolio_id, "Deletion returned the wrong Portfolio ID");
  await count(admin.from("user_portfolios").select("id", { count: "exact", head: true }).eq("id", deleteTarget.portfolio_id), 0, "deleted parent");
  await count(admin.from("portfolio_holdings").select("id", { count: "exact", head: true }).eq("portfolio_id", deleteTarget.portfolio_id), 0, "deleted holdings cascade");
  await count(admin.from("portfolio_transactions").select("id", { count: "exact", head: true }).eq("portfolio_id", deleteTarget.portfolio_id), 0, "deleted ledger cascade");
  await count(admin.from("user_portfolios").select("id", { count: "exact", head: true }).eq("id", keepTarget.portfolio_id), 1, "unselected Portfolio preservation");

  const isolationAfter = await one(
    admin.from("user_portfolios").select("*").eq("id", users.isolation.portfolioId),
    "isolation Portfolio after tests",
  );
  assert(JSON.stringify(isolationAfter) === JSON.stringify(isolationBefore), "Stage 05F changed another user's Portfolio");
} finally {
  if (triggersInstalled) removeFailureTriggers();
  await admin.from("user_portfolios").delete().like("name", "05F %");
  await Promise.all([active.auth.signOut(), isolation.auth.signOut()]);
}

console.log("Local atomic Portfolio creation, accounting, rollback, ownership and lifecycle assertions passed.");
