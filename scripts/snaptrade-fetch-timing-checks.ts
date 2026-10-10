import assert from "node:assert/strict";
import { mock } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import type { SnapTradeClient } from "../lib/brokerage/providers/snaptrade/client";
import { fetchSnapTradeSyncCandidate } from "../lib/brokerage/providers/snaptrade/service";
import { validateBrokerSyncCandidate } from "../lib/brokerage/sync-candidate";

const start = Date.parse("2026-01-15T12:00:00Z");
const iso = (time: number) => new Date(time).toISOString();

async function fixture(count: number, delay: number, timing: "during" | "completion" | "future" = "during", fail?: "provider" | "aliases") {
  let clock = start;
  let requestStart = start;
  const evidence: string[] = [];
  const steps: string[] = [];
  // Every response is asynchronous; advance only the deterministic test clock.
  const respond = async (step: string) => {
    await Promise.resolve();
    clock += delay;
    mock.timers.setTime(clock);
    steps.push(step);
  };
  const admin = {
    rpc: async () => ({ error: null, data: [{ provider_user_id: "synthetic-user", user_secret: "synthetic-secret" }] }),
    from: (table: string) => {
      assert.equal(table, "instrument_aliases");
      const query = {
        select: () => query,
        eq: () => query,
        in: async (_column: string, values: string[]) => {
          await respond("aliases");
          return { error: fail === "aliases" ? { code: "synthetic" } : null, data: values.map(value => ({
            instrument_id: "00000000-0000-0000-0000-000000000001", namespace: "snaptrade.instrument",
            scope: "", value, valid_from: null, valid_to: null,
          })) };
        },
      };
      return query;
    },
  } as unknown as SupabaseClient<Database>;
  const connection = { id: "connection", disabled: false, type: "read", brokerage: { id: "sandbox", name: "Synthetic" } };
  const sdk = {
    connections: { listBrokerageAuthorizations: async () => { await respond("connections"); return { data: [connection] }; } },
    accountInformation: {
      listUserAccounts: async () => {
        await respond("accounts");
        requestStart = clock;
        return { data: Array.from({ length: count + 1 }, (_, index) => ({
          id: String(index), brokerage_authorization: index < count ? "connection" : "other-connection",
          name: "Synthetic", number: "masked", institution_name: "Synthetic", created_date: iso(start),
          sync_status: { holdings: { initial_sync_completed: true, last_successful_sync: iso(start) } },
        })) };
      },
      getAllAccountPositions: async ({ accountId }: { accountId: string }) => {
        assert(Number(accountId) < count, "Unrelated account fetched");
        await respond(`positions:${accountId}`);
        if (fail === "provider") throw new Error("Synthetic provider failure");
        // The final account's balances, activities and alias response are still outstanding.
        const timestamp = count > 1 && accountId === "0" ? start
          : timing === "during" ? clock : clock + 3 * delay + (timing === "future" ? 1 : 0);
        evidence.push(iso(timestamp));
        return { data: { results: [{ instrument: {
          kind: "stock", id: `instrument-${accountId}`, symbol: "AAA", currency: "USD", exchange: "XNAS",
        }, units: "2", price: "10.50", currency: "USD" }], data_freshness: { as_of: iso(timestamp) } } };
      },
      getUserAccountBalance: async ({ accountId }: { accountId: string }) => {
        await respond(`balances:${accountId}`);
        return { data: [{ currency: { code: "USD" }, cash: 100 }] };
      },
      getAccountActivities: async ({ accountId }: { accountId: string }) => {
        await respond(`activities:${accountId}`);
        return { data: { data: [], pagination: { total: 0 } } };
      },
    },
  } as unknown as SnapTradeClient;
  const candidate = await fetchSnapTradeSyncCandidate(admin, {
    userId: "synthetic-user", providerId: "synthetic-provider", externalConnectionId: "connection",
  }, sdk);
  assert.equal(steps.at(-1), "aliases");
  assert.equal(candidate.fetchedAt, iso(clock), "Fetch timestamp must follow ALL provider and alias responses");
  assert.equal(candidate.accounts.length, count);
  assert.deepEqual(candidate.accounts.map(account => account.positions.items[0].asOf), evidence, "Provider timestamps rewritten");
  assert.equal(candidate.providerFreshnessAt, iso(Math.min(...evidence.map(Date.parse))));
  for (const account of candidate.accounts) {
    assert.equal(account.positions.items[0].quantity, 2);
    assert.equal(account.positions.items[0].price, 10.5);
    assert.equal(account.positions.items[0].instrumentId, "00000000-0000-0000-0000-000000000001");
    assert.equal(account.balances.items[0].amount, 100);
  }
  return { candidate, requestStart };
}

async function main() {
  const originalFetch = globalThis.fetch;
  mock.timers.enable({ apis: ["Date"], now: start });
  globalThis.fetch = async () => { throw new Error("Network forbidden in fetch timing regressions"); };
  try {
    for (const delay of [10, 1000, 60_000]) {
      for (const count of [1, 2, 5]) {
        mock.timers.setTime(start);
        const { candidate, requestStart } = await fixture(count, delay);
        assert.deepEqual(validateBrokerSyncCandidate(candidate), { ok: true });
        assert.deepEqual(validateBrokerSyncCandidate({ ...candidate, fetchedAt: iso(requestStart) }), {
          ok: false, retryable: false, errorCode: count === 1 ? "candidate_invalid" : "candidate_position_invalid",
        }, "Original request-start timing must reproduce the rejection");
      }
    }
    mock.timers.setTime(start);
    const equal = await fixture(2, 1000, "completion");
    assert.equal(equal.candidate.accounts[1].positions.items[0].asOf, equal.candidate.fetchedAt);
    assert.deepEqual(validateBrokerSyncCandidate(equal.candidate), { ok: true });
    mock.timers.setTime(start);
    const future = await fixture(2, 1000, "future");
    const before = structuredClone(future.candidate);
    const reasons: string[] = [];
    assert.deepEqual(validateBrokerSyncCandidate(future.candidate, reason => reasons.push(reason)), {
      ok: false, retryable: false, errorCode: "candidate_position_invalid",
    });
    assert.deepEqual(reasons, ["future_position_timestamp"]);
    assert.deepEqual(future.candidate, before, "Validation must not clamp future evidence");
    for (const failure of ["provider", "aliases"] as const) {
      mock.timers.setTime(start);
      await assert.rejects(fixture(2, 1000, "during", failure));
    }
  } finally {
    globalThis.fetch = originalFetch;
    mock.timers.reset();
  }
  console.log("SnapTrade completion timing: delayed/multi-account collection, preserved evidence, strict future rejection and failure propagation passed (mock-only).");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
