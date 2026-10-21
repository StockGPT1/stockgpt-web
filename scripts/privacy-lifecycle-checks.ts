import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { BROKER_EXPORT_COLUMNS, BROKER_EXPORT_LIMITS, BROKER_EXPORT_TABLES, buildBrokerDataExport, planBrokerLifecycle, PrivacyBoundaryError, type BrokerExportRows, type BrokerExportTable } from "../lib/privacy/broker-data-contract";
import { loadOwnBrokerDataExport } from "../lib/privacy/broker-data-loader";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1), other = id(2), connection = id(3), account = id(4), portfolio = id(5), institution = id(6);
const now = "2026-10-21T18:00:00Z";
let assertions = 0;
function check(name: string, fn: () => void) { fn(); assertions++; console.log(`PASS ${name}`); }
async function checkAsync(name: string, fn: () => Promise<void>) { await fn(); assertions++; console.log(`PASS ${name}`); }
function row(table: BrokerExportTable, values: Record<string, unknown>) {
  return Object.assign(Object.fromEntries(BROKER_EXPORT_COLUMNS[table].map((key) => [key, null])), { id: id(100), user_id: owner }, values);
}
function fixture(): BrokerExportRows {
  return {
    broker_connections: [row("broker_connections", { id: connection, provider_id: id(7), institution_id: institution, status: "active" })],
    broker_accounts: [row("broker_accounts", { id: account, connection_id: connection, institution_id: institution, status: "active", base_currency: "USD" })],
    broker_positions: [row("broker_positions", { account_id: account, quantity: 2, price: null, market_value: 42.13, market_value_currency: "USD", as_of: now })],
    broker_cash_balances: [row("broker_cash_balances", { account_id: account, amount: 0, currency: "USD", as_of: now })],
    broker_activities: [row("broker_activities", { account_id: account, activity_type: "CONTRIBUTION", net_amount: 42.13, occurred_at: now, occurred_at_precision: "date_only" })],
    broker_account_value_history: [row("broker_account_value_history", { account_id: account, cash_value: 0, total_value: 42.13, quality: "provider_reported", currency: "USD", value_at: now })],
    user_portfolios: [row("user_portfolios", { id: portfolio, broker_account_id: account, management_source: "connected" })],
  };
}
const failure = (code: string) => (error: unknown) => error instanceof PrivacyBoundaryError && error.code === code && error.message === code;

check("allowlisted export preserves unknown, known zero, monetary values and timing precision without mutation", () => {
  const data = fixture(), before = JSON.stringify(data);
  const result = buildBrokerDataExport(owner, data, now);
  assert.equal(result.data.broker_positions[0].market_value, 42.13);
  assert.equal(result.data.broker_positions[0].price, null);
  assert.equal(result.data.broker_cash_balances[0].amount, 0);
  assert.equal(result.data.broker_activities[0].occurred_at_precision, "date_only");
  assert.equal(result.consistency, "non_transactional_read");
  assert.equal(result.retentionPolicy, "awaiting_approved_policy");
  assert.equal(JSON.stringify(data), before);
});
check("extra credential, raw payload and external identity columns never enter output", () => {
  const data = fixture();
  for (const rows of Object.values(data)) for (const item of rows) Object.assign(item, { userSecret: "synthetic-secret-marker", raw_payload: { secret: "synthetic-secret-marker" }, external_account_id: "synthetic-secret-marker", description: "synthetic-secret-marker", leased_by: "synthetic-secret-marker" });
  assert.ok(!JSON.stringify(buildBrokerDataExport(owner, data, now)).includes("synthetic-secret-marker"));
});
for (const table of BROKER_EXPORT_TABLES) check(`cross-owner ${table} rejected`, () => {
  const data = fixture(); data[table][0].user_id = other;
  assert.throws(() => buildBrokerDataExport(owner, data, now), failure("owner_mismatch"));
});
check("unauthenticated/invalid subject rejected", () => assert.throws(() => buildBrokerDataExport("", fixture(), now), failure("authentication_required")));
check("orphan account, wrong institution, orphan child and wrong projection rejected", () => {
  for (const mutate of [
    (data: BrokerExportRows) => data.broker_accounts[0].connection_id = id(99),
    (data: BrokerExportRows) => data.broker_accounts[0].institution_id = id(99),
    (data: BrokerExportRows) => data.broker_positions[0].account_id = id(99),
    (data: BrokerExportRows) => data.user_portfolios[0].broker_account_id = id(99),
    (data: BrokerExportRows) => data.user_portfolios[0].management_source = "manual",
  ]) { const data = fixture(); mutate(data); assert.throws(() => buildBrokerDataExport(owner, data, now), failure("parent_mismatch")); }
});
check("duplicate rows, non-finite money, objects and missing required selected fields rejected", () => {
  const duplicate = fixture(); duplicate.broker_positions.push({ ...duplicate.broker_positions[0] });
  assert.throws(() => buildBrokerDataExport(owner, duplicate, now), failure("invalid_record"));
  for (const value of [NaN, Infinity, -Infinity, "42.13", { nested: "unsafe" }, undefined]) {
    const data = fixture(); data.broker_positions[0].quantity = value;
    assert.throws(() => buildBrokerDataExport(owner, data, now), failure("invalid_record"));
  }
  const malformed = fixture(); malformed.broker_positions = [null] as unknown as Record<string, unknown>[];
  assert.throws(() => buildBrokerDataExport(owner, malformed, now), failure("invalid_record"));
});
check("oversized text and total rows fail closed, never truncate", () => {
  const data = fixture(); data.broker_positions[0].symbol = "x".repeat(1_025);
  assert.throws(() => buildBrokerDataExport(owner, data, now), failure("export_limit_exceeded"));
  const excess = fixture(); excess.broker_positions = Array.from({ length: BROKER_EXPORT_LIMITS.maxRows }, (_, n) => row("broker_positions", { id: id(n + 1000), account_id: account }));
  assert.throws(() => buildBrokerDataExport(owner, excess, now), failure("export_limit_exceeded"));
});
check("byte budget and invalid recorded time rejected", () => {
  const data = fixture(); data.broker_positions = Array.from({ length: 2100 }, (_, n) => row("broker_positions", { id: id(n + 1000), account_id: account, symbol: "x".repeat(1000) }));
  assert.throws(() => buildBrokerDataExport(owner, data, now), failure("export_limit_exceeded"));
  assert.throws(() => buildBrokerDataExport(owner, fixture(), "invalid"), failure("invalid_record"));
});
check("lifecycle inventory never grants mutation and separates disconnect/removal/revocation/deletion", () => {
  const snapshot = buildBrokerDataExport(owner, fixture(), now), before = JSON.stringify(snapshot);
  for (const intent of ["disconnect_provider", "remove_connected_portfolio", "revoke_provider_credential", "delete_broker_data", "close_stockgpt_account"] as const) {
    const result = planBrokerLifecycle(snapshot, owner, intent, intent === "remove_connected_portfolio" ? portfolio : connection);
    assert.equal(result.executable, false);
    assert.equal(result.providerDisconnectIsDataDeletion, false);
    assert.equal(result.portfolioRemovalIsCredentialRevocation, false);
    assert.equal(result.wholeAccountInventoryComplete, false);
    assert.equal(result.relatedRecords.broker_positions, 1);
    assert.ok(result.uncounted.includes("vault"));
  }
  assert.equal(JSON.stringify(snapshot), before);
  assert.throws(() => planBrokerLifecycle(snapshot, other, "delete_broker_data", connection), failure("owner_mismatch"));
  assert.throws(() => planBrokerLifecycle(snapshot, owner, "remove_connected_portfolio", id(999)), failure("target_unavailable"));
});

type Response = { data: unknown; count: number | null; error: unknown };
function mockSession(data = fixture(), options: { authFailure?: boolean; response?: (table: BrokerExportTable, offset: number, value: Response) => Response; throwQuery?: boolean } = {}) {
  const calls: { table: string; selected: string; filters: [string, string][]; offset: number }[] = [];
  const session = {
    auth: { getUser: async () => ({ data: { user: options.authFailure ? null : { id: owner } }, error: null }) },
    from(table: BrokerExportTable) {
      let selected = ""; const filters: [string, string][] = [];
      const query = {
        select(columns: string, config: { count: string }) { assert.equal(config.count, "exact"); selected = columns; return query; },
        eq(key: string, value: string) { filters.push([key, value]); return query; },
        order(key: string) { assert.equal(key, "id"); return query; },
        async range(offset: number, end: number) {
          calls.push({ table, selected, filters, offset });
          if (options.throwQuery) throw new Error("synthetic-private-http-marker");
          const value = { data: data[table].slice(offset, end + 1), count: data[table].length, error: null };
          return options.response?.(table, offset, value) ?? value;
        },
      }; return query;
    },
  } as unknown as SupabaseClient<Database>;
  return { session, calls };
}

async function main() {
await checkAsync("session loader derives owner, exact columns and connected-only projections without service role", async () => {
  const { session, calls } = mockSession(); await loadOwnBrokerDataExport(session, now);
  assert.equal(calls.length, 7);
  for (const call of calls) {
    assert.deepEqual(call.filters[0], ["user_id", owner]);
    assert.equal(call.selected, BROKER_EXPORT_COLUMNS[call.table as BrokerExportTable].join(","));
    assert.ok(!call.selected.includes("*"));
  }
  assert.deepEqual(calls.at(-1)?.filters[1], ["management_source", "connected"]);
});
await checkAsync("exact 500-row PostgREST boundary stops without invalid completion range", async () => {
  const data = fixture(); data.broker_positions = Array.from({ length: 500 }, (_, n) => row("broker_positions", { id: id(1000 + n), account_id: account, quantity: 1 }));
  const { session, calls } = mockSession(data, { response(table, offset, value) {
    if (table === "broker_positions" && offset === 500) return { data: null, count: 500, error: { status: 416 } };
    return value;
  } });
  const result = await loadOwnBrokerDataExport(session, now);
  assert.equal(result.data.broker_positions.length, 500);
  assert.equal(calls.filter((call) => call.table === "broker_positions").length, 1);
});
await checkAsync("authentication failure performs no table read", async () => {
  const { session, calls } = mockSession(fixture(), { authFailure: true });
  await assert.rejects(loadOwnBrokerDataExport(session, now), failure("authentication_required")); assert.equal(calls.length, 0);
});
await checkAsync("query failures have only allowlisted diagnostics and no raw payload", async () => {
  await assert.rejects(loadOwnBrokerDataExport(mockSession(fixture(), { throwQuery: true }).session, now), failure("export_unavailable"));
  await assert.rejects(loadOwnBrokerDataExport(mockSession(fixture(), { response: () => ({ data: null, count: null, error: { message: "synthetic-private-http-marker" } }) }).session, now), failure("export_unavailable"));
});
await checkAsync("missing counts, truncated data and excessive evidence rejected", async () => {
  for (const response of [
    (table: BrokerExportTable, offset: number, value: Response) => ({ ...value, count: null }),
    (table: BrokerExportTable, offset: number, value: Response) => ({ ...value, count: 20 }),
  ]) await assert.rejects(loadOwnBrokerDataExport(mockSession(fixture(), { response }).session, now), failure("export_inconsistent"));
  await assert.rejects(loadOwnBrokerDataExport(mockSession(fixture(), { response: (table, offset, value) => ({ ...value, count: 10_001 }) }).session, now), failure("export_limit_exceeded"));
});
await checkAsync("count changes and cross-owner leakage during paging fail whole export", async () => {
  const data = fixture(); data.broker_positions = Array.from({ length: 501 }, (_, n) => row("broker_positions", { id: id(1000 + n), account_id: account, quantity: 1 }));
  await assert.rejects(loadOwnBrokerDataExport(mockSession(data, { response: (table, offset, value) => table === "broker_positions" && offset > 0 ? { ...value, count: 502 } : value }).session, now), failure("export_inconsistent"));
  data.broker_positions[500].user_id = other;
  await assert.rejects(loadOwnBrokerDataExport(mockSession(data).session, now), failure("owner_mismatch"));
});
await checkAsync("empty brokerage subset is honest and connected ownership remains checked", async () => {
  const empty = Object.fromEntries(BROKER_EXPORT_TABLES.map((table) => [table, []])) as unknown as BrokerExportRows;
  assert.equal((await loadOwnBrokerDataExport(mockSession(empty).session, now)).data.broker_accounts.length, 0);
});
check("source contract forbids credential RPC/admin/mutation/logging in new loader", () => {
  const loader = readFileSync("lib/privacy/broker-data-loader.ts", "utf8");
  assert.ok(loader.startsWith('import "server-only"'));
  for (const prohibited of [/\.rpc\(/, /\.delete\(/, /\.update\(/, /\.insert\(/, /console\./, /service.role/i, /get_broker_user_secret/, /\.select\(["']\*/]) assert.ok(!prohibited.test(loader), String(prohibited));
});
console.log(`Privacy lifecycle/export: ${assertions} deterministic checks passed; no database/provider calls.`);
}
main().catch(() => { console.error("Privacy lifecycle/export: deterministic checks failed"); process.exitCode = 1; });
