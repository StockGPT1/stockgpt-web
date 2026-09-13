import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const password = "LocalStockGPT!2026";
const cli = resolve("node_modules", "supabase", "dist", "supabase.js");
const run = (args, options = {}) => execFileSync(process.execPath, [cli, ...args], { cwd: process.cwd(), encoding: "utf8", ...options });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const status = Object.fromEntries(run(["status", "-o", "env"], { stdio: ["ignore", "pipe", "pipe"] }).split(/\r?\n/u).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u)).filter(Boolean).map((match) => [match[1], match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]]));
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY ?? status.SECRET_KEY, { auth: { persistSession: false } });
const active = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
const isolation = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
for (const [client, email] of [[active, "active-subscriber@stockgpt.invalid"], [isolation, "isolation-user@stockgpt.invalid"]]) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

const ids = {
  activeUser: "11111111-1111-4111-8111-111111111111",
  isolationUser: "33333333-3333-4333-8333-333333333333",
  activeConnection: "72000000-0000-4000-8000-000000000001",
  activeAccount: "73000000-0000-4000-8000-000000000001",
  isolationAccount: "73000000-0000-4000-8000-000000000002",
};

async function rows(client, table, select = "*") {
  const { data, error } = await client.from(table).select(select);
  if (error) throw error;
  return data;
}

try {
  assert((await rows(active, "broker_connections", "id")).length === 1, "Owner connection read failed");
  assert((await rows(active, "broker_accounts", "id")).length === 1, "Owner account read failed");
  assert((await rows(active, "broker_positions", "id,instrument_id")).length === 2, "Owner positions read failed");
  assert((await rows(active, "broker_cash_balances", "currency")).length === 2, "Multi-currency cash was not retained");
  assert((await rows(active, "broker_activities", "id")).length === 1, "Owner activity read failed");
  assert((await rows(isolation, "broker_positions", "id")).length === 1, "Isolation owner position read failed");

  const activePositions = await rows(active, "broker_positions", "instrument_id,external_instrument_id");
  assert(activePositions.some((row) => row.instrument_id === null && row.external_instrument_id), "Unmapped provider instrument was fabricated or dropped");
  const allMapped = await rows(admin, "broker_positions", "account_id,instrument_id");
  assert(allMapped.filter((row) => row.instrument_id === "60000000-0000-4000-8000-000000000001").length === 2, "Two providers did not resolve to the same permanent instrument");

  for (const table of ["broker_connections", "broker_accounts", "broker_positions", "broker_cash_balances", "broker_activities"]) {
    const { error } = await active.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    assert(error, `Authenticated client gained mutation authority on ${table}`);
  }

  const { error: crossOwnerPosition } = await admin.from("broker_positions").insert({
    id: "74000000-0000-4000-8000-000000000099",
    user_id: ids.activeUser,
    account_id: ids.isolationAccount,
    position_key: "cross-owner",
    external_instrument_id: "cross-owner",
    quantity: 1,
    as_of: "2026-01-15T12:00:00Z",
  });
  assert(crossOwnerPosition, "Composite owner FK accepted a cross-user position");

  const { error: duplicateFingerprint } = await admin.from("broker_activities").insert({
    user_id: ids.activeUser,
    account_id: ids.activeAccount,
    fingerprint: "a".repeat(64),
    activity_type: "trade",
  });
  assert(duplicateFingerprint, "Duplicate deterministic activity fingerprint was accepted");

  const before = {
    accounts: (await rows(admin, "broker_accounts", "id")).length,
    positions: (await rows(admin, "broker_positions", "id")).length,
    activities: (await rows(admin, "broker_activities", "id")).length,
  };
  const { error: disconnectError } = await admin.from("broker_connections").update({ status: "disconnected", disconnected_at: "2026-02-01T00:00:00Z" }).eq("id", ids.activeConnection);
  if (disconnectError) throw disconnectError;
  const after = {
    accounts: (await rows(admin, "broker_accounts", "id")).length,
    positions: (await rows(admin, "broker_positions", "id")).length,
    activities: (await rows(admin, "broker_activities", "id")).length,
  };
  assert(JSON.stringify(before) === JSON.stringify(after), "Disconnect state deleted normalized broker history");
  await admin.from("broker_connections").update({ status: "active", disconnected_at: null }).eq("id", ids.activeConnection);

  const portfolioIds = new Set((await rows(admin, "user_portfolios", "id")).map((row) => row.id));
  assert(!(await rows(admin, "broker_accounts", "id")).some((row) => portfolioIds.has(row.id)), "Broker account identity collapsed into a StockGPT Portfolio");
} finally {
  await admin.from("broker_positions").delete().eq("id", "74000000-0000-4000-8000-000000000099");
  await admin.from("broker_connections").update({ status: "active", disconnected_at: null }).eq("id", ids.activeConnection);
  await Promise.all([active.auth.signOut(), isolation.auth.signOut()]);
}

console.log("Local provider-neutral broker ownership, read isolation, idempotency and disconnect checks passed.");
