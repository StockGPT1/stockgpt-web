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
  isolation: {
    id: "33333333-3333-4333-8333-333333333333",
    email: "isolation-user@stockgpt.invalid",
    portfolioId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  },
};
const ids = {
  immediate: "71111111-1111-4111-8111-111111111111",
  unknown: "72222222-2222-4222-8222-222222222222",
  correction: "73333333-3333-4333-8333-333333333333",
  forged: "74444444-4444-4444-8444-444444444444",
  hostile: "75555555-5555-4555-8555-555555555555",
  isolation: "76666666-6666-4666-8666-666666666666",
  cascadePortfolio: "77777777-7777-4777-8777-777777777777",
  cascadeTransaction: "78888888-8888-4888-8888-888888888888",
};

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

async function expectRejected(query, message) {
  const { error } = await query;
  assert(error, `${message}: hostile write unexpectedly succeeded`);
  assert(
    /permission denied|privilege|row-level security|foreign key|violates/iu.test(error.message),
    `${message}: unexpected failure: ${error.message}`,
  );
}

function transaction(id, portfolioId, userId, overrides = {}) {
  return {
    id,
    portfolio_id: portfolioId,
    user_id: userId,
    ticker: null,
    type: "adjustment",
    shares: null,
    price: null,
    amount: 25,
    realised_pnl: null,
    currency: "USD",
    notes: "Stage 05C local ledger fixture",
    ...overrides,
  };
}

runSupabase(
  ["db", "query", "--local", "--file", "supabase/tests/verify_portfolio_ledger.sql"],
  { stdio: "inherit" },
);

const status = localStatus();
const adminKey = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
assert(status.API_URL && status.ANON_KEY && adminKey, "Local Supabase API configuration is unavailable");

const activeClient = await authenticatedClient(status.API_URL, status.ANON_KEY, users.active);
const isolationClient = await authenticatedClient(status.API_URL, status.ANON_KEY, users.isolation);
const admin = createClient(status.API_URL, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const transactionIds = [
  ids.immediate,
  ids.unknown,
  ids.correction,
  ids.forged,
  ids.hostile,
  ids.isolation,
  ids.cascadeTransaction,
];

try {
  await requiredSingle(
    isolationClient
      .from("portfolio_transactions")
      .insert(transaction(ids.isolation, users.isolation.portfolioId, users.isolation.id))
      .select("id"),
    "Isolation owner could not insert its ledger fixture",
  );
  await exactCount(
    activeClient
      .from("portfolio_transactions")
      .select("id", { count: "exact", head: true })
      .eq("id", ids.isolation),
    0,
    "Cross-user ledger SELECT",
  );

  const immediate = await requiredSingle(
    activeClient
      .from("portfolio_transactions")
      .insert(transaction(ids.immediate, users.active.portfolioId, users.active.id))
      .select("id,portfolio_id,user_id,amount,notes,occurred_at,created_at"),
    "Immediate same-owner ledger INSERT failed",
  );
  assert(Number.isFinite(new Date(immediate.created_at).getTime()), "Immediate row lacks recorded time");
  assert(Number.isFinite(new Date(immediate.occurred_at).getTime()), "Immediate row lacks occurrence time");

  const unknown = await requiredSingle(
    activeClient
      .from("portfolio_transactions")
      .insert(transaction(ids.unknown, users.active.portfolioId, users.active.id, {
        type: "log_existing",
        occurred_at: null,
        notes: "Exact occurrence time was not separately stored",
      }))
      .select("id,occurred_at,created_at"),
    "Unknown-occurrence ledger INSERT failed",
  );
  assert(unknown.occurred_at === null, "Unknown occurrence was fabricated");
  assert(Number.isFinite(new Date(unknown.created_at).getTime()), "Unknown occurrence row lacks recorded time");

  await expectRejected(
    activeClient.from("portfolio_transactions").insert(
      transaction(ids.forged, users.active.portfolioId, users.active.id, {
        created_at: "2000-01-01T00:00:00Z",
      }),
    ),
    "Forged recorded timestamp INSERT",
  );
  await exactCount(
    admin
      .from("portfolio_transactions")
      .select("id", { count: "exact", head: true })
      .eq("id", ids.forged),
    0,
    "Forged recorded timestamp residue",
  );

  const original = await requiredSingle(
    admin
      .from("portfolio_transactions")
      .select("portfolio_id,user_id,type,ticker,shares,price,amount,realised_pnl,currency,notes,occurred_at,created_at")
      .eq("id", ids.immediate),
    "Could not capture original ledger row",
  );
  await expectRejected(
    activeClient
      .from("portfolio_transactions")
      .update({ amount: 999, notes: "Hostile rewrite" })
      .eq("id", ids.immediate),
    "Authenticated ledger UPDATE",
  );
  await expectRejected(
    activeClient.from("portfolio_transactions").delete().eq("id", ids.immediate),
    "Authenticated ledger DELETE",
  );
  const unchanged = await requiredSingle(
    admin
      .from("portfolio_transactions")
      .select("portfolio_id,user_id,type,ticker,shares,price,amount,realised_pnl,currency,notes,occurred_at,created_at")
      .eq("id", ids.immediate),
    "Original ledger row disappeared after rejected writes",
  );
  assert(JSON.stringify(unchanged) === JSON.stringify(original), "Rejected ledger mutation changed financial truth");

  await expectRejected(
    activeClient.from("portfolio_transactions").insert(
      transaction(ids.hostile, users.isolation.portfolioId, users.active.id),
    ),
    "Cross-owner ledger INSERT",
  );
  await expectRejected(
    activeClient.from("portfolio_transactions").insert(
      transaction(ids.hostile, users.active.portfolioId, users.isolation.id),
    ),
    "Mismatched redundant ledger owner INSERT",
  );

  const correction = await requiredSingle(
    activeClient
      .from("portfolio_transactions")
      .insert(transaction(ids.correction, users.active.portfolioId, users.active.id, {
        amount: -25,
        notes: "Explicit appended correction fixture",
      }))
      .select("id,amount,created_at,occurred_at"),
    "Explicit appended correction fixture failed",
  );
  assert(correction.amount === -25, "Correction fixture amount changed");
  const originalAfterCorrection = await requiredSingle(
    admin.from("portfolio_transactions").select("amount,notes").eq("id", ids.immediate),
    "Original row missing after correction append",
  );
  assert(originalAfterCorrection.amount === 25 && originalAfterCorrection.notes === original.notes,
    "Correction append rewrote the original row");

  await requiredSingle(
    activeClient
      .from("user_portfolios")
      .insert({
        id: ids.cascadePortfolio,
        user_id: users.active.id,
        name: "Stage 05C cascade fixture",
        currency: "USD",
      })
      .select("id"),
    "Temporary owned Portfolio creation failed",
  );
  await requiredSingle(
    activeClient
      .from("portfolio_transactions")
      .insert(transaction(ids.cascadeTransaction, ids.cascadePortfolio, users.active.id))
      .select("id"),
    "Temporary Portfolio ledger INSERT failed",
  );
  const { error: deletePortfolioError } = await activeClient
    .from("user_portfolios")
    .delete()
    .eq("id", ids.cascadePortfolio);
  if (deletePortfolioError) throw new Error(`Owned Portfolio lifecycle delete failed: ${deletePortfolioError.message}`);
  await exactCount(
    admin
      .from("portfolio_transactions")
      .select("id", { count: "exact", head: true })
      .eq("id", ids.cascadeTransaction),
    0,
    "Portfolio lifecycle cascade",
  );

  console.log("Portfolio ledger local security checks passed.");
} finally {
  await admin.from("portfolio_transactions").delete().in("id", transactionIds);
  await admin.from("user_portfolios").delete().eq("id", ids.cascadePortfolio);
  await Promise.all([activeClient.auth.signOut(), isolationClient.auth.signOut()]);
}
