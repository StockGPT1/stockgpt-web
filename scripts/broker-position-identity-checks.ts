import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveBrokerPositionIdentities, loadBrokerPositionAliases, loadBrokerPositionAliasesSafely, validateBrokerAliasPageEvidence, APPROVED_SANDBOX_FIXTURE_CONTRACTS, APPROVED_SANDBOX_CONNECTIONS, BROKER_ALIAS_READ_BUDGET, BrokerAliasAvailabilityError, sandboxFixtureConnectionEligible, positionIdentityLabel, SANDBOX_FIXTURE_LABEL, type SandboxFixtureContract, type SandboxFixtureContext } from "../lib/instruments/broker-position-identity";
import type { InstrumentAlias } from "../lib/instruments";

async function main() {
  const position = { id: "p1", user_id: "synthetic-user", account_id: "synthetic-account", instrument_id: null, external_instrument_id: "entirely-synthetic-provider-id", as_of: "2026-01-15T12:00:00Z" };
  const alias: InstrumentAlias = { instrumentId: "entirely-synthetic-listing", namespace: "sandbox.fixture.example.instrument", scope: "fixture-v1", value: position.external_instrument_id, validFrom: "2026-01-01T00:00:00Z", validTo: "2026-02-01T00:00:00Z" };
  const connection = { provider: "example", connectionId: "synthetic-connection", externalConnectionId: "synthetic-provider-connection", institutionId: "synthetic-institution", externalInstitutionId: "synthetic-provider-institution", userId: position.user_id, accountId: position.account_id };
  const fixtureContext: SandboxFixtureContext = { optIn: true, deploymentEnvironment: "preview", nodeEnvironment: "production", connection, approvals: [{ ...connection, provenance: "reviewed_read_only_sandbox" }] };
  const contract: SandboxFixtureContract = { provenance: "synthetic_test_only", provider: "example", scope: "fixture-v1", userId: position.user_id, accountId: position.account_id, connectionId: connection.connectionId, aliases: [alias] };
  const resolve = (overrides: Partial<Parameters<typeof resolveBrokerPositionIdentities>[0]> = {}) => resolveBrokerPositionIdentities({ positions: [position], provider: "example", aliases: [], environment: "sandbox", fixtureContext, fixtureContracts: [contract], ...overrides });
  assert.deepEqual(resolve().p1, { instrumentId: alias.instrumentId, provenance: "sandbox_fixture" });
  assert.deepEqual(resolve(), resolve(), "Resolution must be idempotent");
  assert.equal(APPROVED_SANDBOX_FIXTURE_CONTRACTS.length, 0, "No actual provider fixture identities are approved");
  assert.equal(APPROVED_SANDBOX_CONNECTIONS.length, 0, "No verified runtime Sandbox identity attestation is approved");
  assert(sandboxFixtureConnectionEligible(fixtureContext));
  assert(sandboxFixtureConnectionEligible({ ...fixtureContext, deploymentEnvironment: undefined, nodeEnvironment: "test" }));
  for (const context of [undefined, { ...fixtureContext, optIn: false }, { ...fixtureContext, approvals: [] }, { ...fixtureContext, connection: null },
    { ...fixtureContext, deploymentEnvironment: "production" }, { ...fixtureContext, deploymentEnvironment: undefined, nodeEnvironment: "production" },
    { ...fixtureContext, deploymentEnvironment: "unexpected" }, { ...fixtureContext, approvals: [...fixtureContext.approvals, ...fixtureContext.approvals] }]) {
    assert.equal(sandboxFixtureConnectionEligible(context), false);
    assert.equal(resolve({ fixtureContext: context }).p1.instrumentId, null);
  }
  for (const key of ["provider", "connectionId", "externalConnectionId", "institutionId", "externalInstitutionId", "userId", "accountId"] as const) {
    const context = { ...fixtureContext, connection: { ...connection, [key]: "wrong" } };
    assert.equal(sandboxFixtureConnectionEligible(context), false, `Conflicting ${key} must fail closed`);
    assert.equal(resolve({ fixtureContext: context }).p1.instrumentId, null);
  }
  assert.equal(resolve({ fixtureContracts: [{ ...contract, connectionId: "wrong" }] }).p1.instrumentId, null);
  assert.equal(positionIdentityLabel({ instrumentId: alias.instrumentId, identityProvenance: "sandbox_fixture", testDataLabel: null }), SANDBOX_FIXTURE_LABEL);
  assert.equal(positionIdentityLabel({ instrumentId: alias.instrumentId, identityProvenance: "sandbox_fixture", testDataLabel: "StockGPT instrument resolved" }), SANDBOX_FIXTURE_LABEL);
  assert.equal(positionIdentityLabel({ instrumentId: alias.instrumentId, identityProvenance: "provider_alias", testDataLabel: null }), "StockGPT instrument resolved");
  assert.equal(positionIdentityLabel({ instrumentId: null, identityProvenance: "unresolved", testDataLabel: null }), "Limited instrument coverage");
  assert.equal(resolve({ fixtureContracts: [] }).p1.instrumentId, null);
  assert.equal(resolve({ environment: "normal" }).p1.instrumentId, null, "Sandbox aliases cannot resolve real providers");
  assert.equal(resolve({ provider: "another" }).p1.instrumentId, null);
  for (const changed of [{ user_id: "other" }, { account_id: "other" }, { external_instrument_id: "AAPL" }, { as_of: "2026-02-01T00:00:00Z" }, { as_of: "invalid" }]) {
    assert.equal(resolve({ positions: [{ ...position, ...changed }] }).p1.instrumentId, null);
  }
  for (const aliases of [[alias, { ...alias, instrumentId: "conflicting" }], [alias, { ...alias, validTo: null }], [{ ...alias, scope: "other" }], [{ ...alias, validTo: null }], [{ ...alias, validFrom: "invalid" }]]) {
    assert.equal(resolve({ fixtureContracts: [{ ...contract, aliases }] }).p1.instrumentId, null);
  }
  assert.equal(resolve({ fixtureContracts: [contract, contract] }).p1.instrumentId, null);
  assert.equal(resolve({ positions: [{ ...position, instrument_id: "conflict" }] }).p1.instrumentId, null);
  const real = { ...alias, namespace: "example.instrument", scope: "" };
  assert.equal(resolve({ environment: "normal", aliases: [real] }).p1.instrumentId, alias.instrumentId);
  assert.equal(resolve({ environment: "normal", aliases: [real, { ...real, instrumentId: "conflict" }] }).p1.instrumentId, null);
  assert.equal(resolve({ environment: "normal", aliases: [real], positions: [{ ...position, instrument_id: "conflict" }] }).p1.instrumentId, null);
  assert.equal(resolve({ environment: "normal", aliases: [{ ...real, validTo: "2026-01-02T00:00:00Z" }], positions: [{ ...position, instrument_id: alias.instrumentId }] }).p1.instrumentId, null);
  const original = JSON.stringify(position);
  resolve();
  assert.equal(JSON.stringify(position), original, "Identity resolution cannot mutate financial source records");
  for (const count of [0, 10, 50, 200, 401]) {
    let calls = 0;
    const values = Array.from({ length: count }, (_, index) => `synthetic-${index}`);
    await loadBrokerPositionAliases("example", [...values, ...values], async (namespace, batch) => {
      calls++; assert.equal(namespace, "example.instrument"); assert(batch.length <= 200); return { rows: [], count: 0 };
    });
    assert.equal(calls, Math.ceil(count / 200));
  }
  const many = Array.from({ length: BROKER_ALIAS_READ_BUDGET.maxRows }, () => real);
  let boundaryPages = 0;
  const full = await loadBrokerPositionAliases("example", [real.value], async (_namespace, _values, offset, limit) => {
    boundaryPages++; if (offset >= many.length) throw new Error("HTTP 416 range not satisfiable");
    return { rows: many.slice(offset, offset + limit), count: many.length };
  });
  assert.equal(full.length, BROKER_ALIAS_READ_BUDGET.maxRows);
  assert.equal(boundaryPages, 10, "Exact count must stop before the PostgREST HTTP 416 completion range");
  const isSanitized = (error: unknown) => error instanceof BrokerAliasAvailabilityError
    && error.message === "Connected Portfolio aliases unavailable" && !error.cause;
  validateBrokerAliasPageEvidence(10_000, 9000, 1000, 1000);
  validateBrokerAliasPageEvidence(10_000, 10_000, 0, 1000);
  validateBrokerAliasPageEvidence(0, 0, 0, 1000);
  for (const [count, offset, size, limit] of [[null, 0, 0, 1000], [10_001, 0, 1000, 1000], [1000, 0, 500, 1000],
    [1000, 1000, 1, 1000], [10, 1000, 0, 1000], [-1, 0, 0, 1000], [Infinity, 0, 0, 1000]]) {
    assert.throws(() => validateBrokerAliasPageEvidence(count, offset!, size!, limit!), isSanitized);
  }
  await assert.rejects(loadBrokerPositionAliases("example", [real.value], async (_ns, _values, offset, limit) =>
    ({ rows: [...many, real].slice(offset, offset + limit), count: many.length + 1 })), isSanitized);
  const crossBatchValues = Array.from({ length: 201 }, (_, index) => `batch-${index}`);
  await assert.rejects(loadBrokerPositionAliases("example", crossBatchValues, async (_ns, values, offset, limit) =>
    ({ rows: values[0] === "batch-0" ? many.slice(offset, offset + limit) : [real], count: values[0] === "batch-0" ? many.length : 1 })), isSanitized);
  let failurePages = 0;
  await assert.rejects(loadBrokerPositionAliases("example", [real.value], async () => {
    if (++failurePages === 1) return { rows: Array.from({ length: 1000 }, () => real), count: 2000 };
    throw new Error("sensitive-payload-not-to-propagate");
  }), isSanitized);
  const pageBoundary = Array.from({ length: BROKER_ALIAS_READ_BUDGET.maxPages * BROKER_ALIAS_READ_BUDGET.batchSize }, (_, index) => `id-${index}`);
  let pageCalls = 0;
  await loadBrokerPositionAliases("example", pageBoundary, async () => { pageCalls++; return { rows: [], count: 0 }; });
  assert.equal(pageCalls, BROKER_ALIAS_READ_BUDGET.maxPages);
  pageCalls = 0;
  await assert.rejects(loadBrokerPositionAliases("example", [...pageBoundary, "one-more"], async () => { pageCalls++; return { rows: [], count: 0 }; }), isSanitized);
  assert.equal(pageCalls, BROKER_ALIAS_READ_BUDGET.maxPages, "No over-budget request may execute");
  await assert.rejects(loadBrokerPositionAliases("example", [real.value], async () => ({ rows: Array.from({ length: 1001 }, () => real), count: 1001 })), isSanitized);
  let exactCalls = 0;
  const exactPage = await loadBrokerPositionAliases("example", [real.value], async (_ns, _values, offset) => {
    exactCalls++;
    if (offset === 1000) throw new Error("HTTP 416");
    return { rows: many.slice(0, 1000), count: 1000 };
  });
  assert.equal(exactCalls, 1); assert.equal(exactPage.length, 1000);
  for (const count of [null, 2000]) {
    await assert.rejects(loadBrokerPositionAliases("example", [real.value], async () => ({ rows: [real], count })), isSanitized);
  }
  await assert.rejects(loadBrokerPositionAliases("example", [real.value], async (_ns, _values, offset) => ({
    rows: many.slice(offset, offset + 1000), count: offset ? 3000 : 2000,
  })), isSanitized);
  const failedAliases = await loadBrokerPositionAliasesSafely("example", [real.value], async () => { throw new Error("private error"); });
  assert.deepEqual(failedAliases, { aliases: [], available: false }, "Identity availability must fail closed, separately from monetary facts");
  const source = readFileSync("lib/connected-portfolio-intelligence.ts", "utf8");
  assert(!/\.insert\(|\.update\(|\.upsert\(|providers\/snaptrade\/service|createAdminClient/.test(source));
  assert(source.includes('.eq("account_id", account.data.id)'));
  assert(source.includes('identity.provenance !== "sandbox_fixture"'));
  assert(source.includes('APPROVED_SANDBOX_CONNECTIONS.filter'));
  const workspace = readFileSync("components/ConnectedPortfolioWorkspace.tsx", "utf8");
  assert(workspace.includes("positionIdentityLabel(position)"));
  assert(!workspace.includes('position.instrumentId ? "StockGPT instrument resolved"'));
  console.log("Broker identity: explicit fixture contract, temporal ambiguity/conflict, ownership, isolation, immutability and bulk budgets passed.");
}
void main();
