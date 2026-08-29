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
  activeTransaction: "51111111-1111-4111-8111-111111111111",
  isolationTransaction: "53333333-3333-4333-8333-333333333333",
  hostileTransaction: "54444444-4444-4444-8444-444444444444",
  relationalTransaction: "55555555-5555-4555-8555-555555555555",
  activeSnapshot: "61111111-1111-4111-8111-111111111111",
  isolationSnapshot: "63333333-3333-4333-8333-333333333333",
  hostileSnapshot: "64444444-4444-4444-8444-444444444444",
  relationalSnapshot: "65555555-5555-4555-8555-555555555555",
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
      .map((match) => {
        const value = match[2].startsWith('"') ? JSON.parse(match[2]) : match[2];
        return [match[1], value];
      }),
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

function transactionRow(id, portfolioId, userId, notes) {
  return {
    id,
    portfolio_id: portfolioId,
    user_id: userId,
    type: "adjustment",
    ticker: null,
    shares: null,
    price: null,
    amount: 25,
    currency: "USD",
    realised_pnl: null,
    notes,
    occurred_at: null,
  };
}

function snapshotRow(id, portfolioId, userId, snapshotAt, value) {
  return {
    id,
    portfolio_id: portfolioId,
    user_id: userId,
    snapshot_at: snapshotAt,
    value,
    cash: 100,
    basis: value,
    pnl: 0,
    pnl_pct: 0,
    source: "system",
    created_at: snapshotAt,
  };
}

runSupabase(
  ["db", "query", "--local", "--file", "supabase/tests/verify_portfolio_persistence_foundation.sql"],
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
const allTransactionIds = Object.values(ids).filter((id) => id.startsWith("5"));
const allSnapshotIds = Object.values(ids).filter((id) => id.startsWith("6"));

const isolationPortfolioBefore = await requiredSingle(
  admin
    .from("user_portfolios")
    .select("id,name,cash_balance,cash_deposited_total")
    .eq("id", users.isolation.portfolioId),
  "Could not capture isolation portfolio state",
);

try {
  await exactCount(
    activeClient.from("user_portfolios").select("id", { count: "exact", head: true }),
    1,
    "Active user own Portfolio visibility",
  );
  await exactCount(
    activeClient.from("portfolio_holdings").select("id", { count: "exact", head: true }),
    2,
    "Active user own holdings visibility",
  );
  await exactCount(
    activeClient.from("portfolio_transactions").select("id", { count: "exact", head: true }),
    3,
    "Active user own transactions visibility",
  );
  await exactCount(
    activeClient.from("portfolio_snapshots").select("id", { count: "exact", head: true }),
    2,
    "Active user own snapshots visibility",
  );
  await exactCount(
    activeClient
      .from("user_portfolios")
      .select("id", { count: "exact", head: true })
      .eq("id", users.isolation.portfolioId),
    0,
    "Cross-user Portfolio visibility",
  );
  await exactCount(
    activeClient
      .from("portfolio_holdings")
      .select("id", { count: "exact", head: true })
      .eq("portfolio_id", users.isolation.portfolioId),
    0,
    "Cross-user holdings visibility",
  );

  await requiredSingle(
    activeClient
      .from("portfolio_transactions")
      .insert(transactionRow(
        ids.activeTransaction,
        users.active.portfolioId,
        users.active.id,
        "05B active same-owner transaction",
      ))
      .select("id,portfolio_id,user_id,notes"),
    "Active user same-owner transaction insert failed",
  );
  await requiredSingle(
    isolationClient
      .from("portfolio_transactions")
      .insert(transactionRow(
        ids.isolationTransaction,
        users.isolation.portfolioId,
        users.isolation.id,
        "05B isolation same-owner transaction",
      ))
      .select("id,portfolio_id,user_id,notes"),
    "Isolation user same-owner transaction insert failed",
  );
  await requiredSingle(
    activeClient
      .from("portfolio_snapshots")
      .insert(snapshotRow(
        ids.activeSnapshot,
        users.active.portfolioId,
        users.active.id,
        "2026-03-01T11:00:00Z",
        5700,
      ))
      .select("id,portfolio_id,user_id,value"),
    "Active user same-owner snapshot insert failed",
  );
  await requiredSingle(
    isolationClient
      .from("portfolio_snapshots")
      .insert(snapshotRow(
        ids.isolationSnapshot,
        users.isolation.portfolioId,
        users.isolation.id,
        "2026-03-01T12:00:00Z",
        1100,
      ))
      .select("id,portfolio_id,user_id,value"),
    "Isolation user same-owner snapshot insert failed",
  );

  await exactCount(
    activeClient
      .from("portfolio_transactions")
      .select("id", { count: "exact", head: true })
      .eq("id", ids.isolationTransaction),
    0,
    "Cross-user transaction visibility",
  );
  await exactCount(
    activeClient
      .from("portfolio_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("id", ids.isolationSnapshot),
    0,
    "Cross-user snapshot visibility",
  );

  await expectRejected(
    activeClient.from("portfolio_transactions").insert(transactionRow(
      ids.hostileTransaction,
      users.isolation.portfolioId,
      users.active.id,
      "Hostile cross-owner transaction",
    )),
    "Cross-owner transaction insert",
  );
  await expectRejected(
    activeClient
      .from("portfolio_transactions")
      .update({ portfolio_id: users.isolation.portfolioId })
      .eq("id", ids.activeTransaction),
    "Cross-owner transaction update",
  );
  await expectRejected(
    activeClient.from("portfolio_transactions").insert(transactionRow(
      ids.hostileTransaction,
      users.active.portfolioId,
      users.isolation.id,
      "Hostile mismatched redundant transaction owner",
    )),
    "Mismatched transaction user_id insert",
  );

  const activeTransactionAfter = await requiredSingle(
    admin
      .from("portfolio_transactions")
      .select("portfolio_id,user_id,notes")
      .eq("id", ids.activeTransaction),
    "Could not verify rejected transaction update",
  );
  assert(
    activeTransactionAfter.portfolio_id === users.active.portfolioId
      && activeTransactionAfter.user_id === users.active.id,
    "Rejected transaction update changed parent or owner",
  );
  await expectRejected(
    activeClient
      .from("portfolio_transactions")
      .update({ notes: "05B transaction update must remain append-only" })
      .eq("id", ids.activeTransaction),
    "Same-owner transaction update",
  );

  await expectRejected(
    activeClient.from("portfolio_snapshots").insert(snapshotRow(
      ids.hostileSnapshot,
      users.isolation.portfolioId,
      users.active.id,
      "2026-03-02T11:00:00Z",
      5800,
    )),
    "Cross-owner snapshot insert",
  );
  await expectRejected(
    activeClient
      .from("portfolio_snapshots")
      .update({ portfolio_id: users.isolation.portfolioId })
      .eq("id", ids.activeSnapshot),
    "Cross-owner snapshot update",
  );
  await expectRejected(
    activeClient.from("portfolio_snapshots").insert(snapshotRow(
      ids.hostileSnapshot,
      users.active.portfolioId,
      users.isolation.id,
      "2026-03-02T12:00:00Z",
      5800,
    )),
    "Mismatched snapshot user_id insert",
  );

  const activeSnapshotAfter = await requiredSingle(
    admin
      .from("portfolio_snapshots")
      .select("portfolio_id,user_id,value")
      .eq("id", ids.activeSnapshot),
    "Could not verify rejected snapshot update",
  );
  assert(
    activeSnapshotAfter.portfolio_id === users.active.portfolioId
      && activeSnapshotAfter.user_id === users.active.id,
    "Rejected snapshot update changed parent or owner",
  );
  await requiredSingle(
    activeClient
      .from("portfolio_snapshots")
      .update({ value: 5750 })
      .eq("id", ids.activeSnapshot)
      .select("id,value"),
    "Legitimate same-owner snapshot update failed",
  );

  await expectRejected(
    admin.from("portfolio_transactions").insert(transactionRow(
      ids.relationalTransaction,
      users.isolation.portfolioId,
      users.active.id,
      "Service-role mismatch must hit the composite FK",
    )),
    "Service-role mismatched transaction relationship",
  );
  await expectRejected(
    admin.from("portfolio_snapshots").insert(snapshotRow(
      ids.relationalSnapshot,
      users.isolation.portfolioId,
      users.active.id,
      "2026-03-03T12:00:00Z",
      5800,
    )),
    "Service-role mismatched snapshot relationship",
  );

  const isolationPortfolioAfter = await requiredSingle(
    admin
      .from("user_portfolios")
      .select("id,name,cash_balance,cash_deposited_total")
      .eq("id", users.isolation.portfolioId),
    "Could not verify isolation portfolio state",
  );
  assert(
    JSON.stringify(isolationPortfolioAfter) === JSON.stringify(isolationPortfolioBefore),
    "Hostile writes changed the isolation Portfolio",
  );
  await exactCount(
    admin
      .from("portfolio_transactions")
      .select("id", { count: "exact", head: true })
      .eq("portfolio_id", users.isolation.portfolioId),
    1,
    "Isolation Portfolio transaction state after hostile writes",
  );
  await exactCount(
    admin
      .from("portfolio_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("portfolio_id", users.isolation.portfolioId),
    1,
    "Isolation Portfolio snapshot state after hostile writes",
  );
} finally {
  await admin.from("portfolio_transactions").delete().in("id", allTransactionIds);
  await admin.from("portfolio_snapshots").delete().in("id", allSnapshotIds);
  await Promise.all([activeClient.auth.signOut(), isolationClient.auth.signOut()]);
}

console.log("Local portfolio parent/owner constraints, RLS isolation and direct-write compatibility assertions passed.");
