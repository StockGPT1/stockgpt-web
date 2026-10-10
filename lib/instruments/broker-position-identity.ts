import { resolveInstrumentAlias, type InstrumentAlias } from "./index";

export type PositionIdentity = { instrumentId: string | null; provenance: "provider_alias" | "persisted" | "sandbox_fixture" | "unresolved" };
export const SANDBOX_FIXTURE_LABEL = "Sandbox fixture — synthetic test data, not a market assessment";
export type HoldingIdentityPresentation = { instrumentId?: string | null; identityProvenance: PositionIdentity["provenance"]; testDataLabel: string | null };
export function positionIdentityLabel(identity: HoldingIdentityPresentation & { instrumentId: string | null }) {
  return identity.identityProvenance === "sandbox_fixture"
    ? identity.testDataLabel === SANDBOX_FIXTURE_LABEL ? identity.testDataLabel : SANDBOX_FIXTURE_LABEL
    : identity.instrumentId ? "StockGPT instrument resolved" : "Limited instrument coverage";
}

export type SandboxConnectionEvidence = {
  provider: string; connectionId: string; externalConnectionId: string;
  institutionId: string; externalInstitutionId: string; userId: string; accountId: string;
};
export type ApprovedSandboxConnection = SandboxConnectionEvidence & {
  provenance: "reviewed_read_only_sandbox";
};
export type SandboxFixtureContext = {
  optIn: boolean; deploymentEnvironment?: string; nodeEnvironment?: string;
  connection: SandboxConnectionEvidence | null;
  approvals: readonly ApprovedSandboxConnection[];
};
// The database does not yet store a Sandbox/read-only attestation. Environment
// flags or institution names cannot replace independently reviewed identities.
export const APPROVED_SANDBOX_CONNECTIONS: readonly ApprovedSandboxConnection[] = [];
export function sandboxFixtureConnectionEligible(context: SandboxFixtureContext | undefined): boolean {
  if (!context?.optIn || !context.connection) return false;
  const local = !context.deploymentEnvironment && ["development", "test"].includes(context.nodeEnvironment ?? "");
  if (context.deploymentEnvironment !== "preview" && !local) return false;
  const keys = ["provider", "connectionId", "externalConnectionId", "institutionId", "externalInstitutionId", "userId", "accountId"] as const;
  if (keys.some((key) => !context.connection![key].trim())) return false;
  return context.approvals.filter((approval) => approval.provenance === "reviewed_read_only_sandbox"
    && keys.every((key) => approval[key] === context.connection![key])).length === 1;
}
export type SandboxFixtureContract = {
  provenance: "synthetic_test_only";
  provider: string; scope: string; userId: string; accountId: string; connectionId: string;
  aliases: readonly InstrumentAlias[];
};
type Position = { id: string; user_id: string; account_id: string; instrument_id: string | null; external_instrument_id: string | null; as_of: string };

// No live Sandbox identity contract has been established. Never populate this
// from matching symbols or the synthetic development catalogue.
export const APPROVED_SANDBOX_FIXTURE_CONTRACTS: readonly SandboxFixtureContract[] = [];

export function resolveBrokerPositionIdentities(input: {
  positions: readonly Position[]; provider: string; aliases: readonly InstrumentAlias[];
  environment: "normal" | "sandbox";
  fixtureContext?: SandboxFixtureContext;
  fixtureContracts?: readonly SandboxFixtureContract[];
}): Record<string, PositionIdentity> {
  const result: Record<string, PositionIdentity> = {};
  const aliasesByValue = new Map<string, InstrumentAlias[]>();
  for (const alias of input.aliases) {
    if (alias.namespace !== `${input.provider}.instrument` || alias.scope !== "") continue;
    const group = aliasesByValue.get(alias.value) ?? [];
    group.push(alias);
    aliasesByValue.set(alias.value, group);
  }
  for (const position of input.positions) {
    let instrumentId: string | null = null;
    let provenance: PositionIdentity["provenance"] = "unresolved";
    const value = position.external_instrument_id;
    if (input.environment === "sandbox") {
      const eligible = sandboxFixtureConnectionEligible(input.fixtureContext)
        && input.fixtureContext!.connection!.provider === input.provider
        && input.fixtureContext!.connection!.userId === position.user_id
        && input.fixtureContext!.connection!.accountId === position.account_id;
      const contracts = (input.fixtureContracts ?? []).filter((contract) =>
        eligible && contract.provenance === "synthetic_test_only" && contract.provider === input.provider
        && contract.connectionId === input.fixtureContext!.connection!.connectionId
        && contract.userId === position.user_id && contract.accountId === position.account_id && contract.scope.trim(),
      );
      const matches = (contracts.length === 1 ? contracts : []).flatMap((contract) => {
        const namespace = `sandbox.fixture.${input.provider}.instrument`;
        // Fixture approvals must explicitly bound both ends of their validity.
        const validContract = contract.aliases.every((alias) => alias.namespace === namespace
          && alias.scope === contract.scope && alias.instrumentId.trim() && alias.value.trim()
          && alias.validFrom && alias.validTo && Number.isFinite(Date.parse(alias.validFrom))
          && Number.isFinite(Date.parse(alias.validTo)) && Date.parse(alias.validFrom) < Date.parse(alias.validTo));
        const id = value && validContract ? resolveInstrumentAlias(contract.aliases, { namespace, scope: contract.scope, value, asOf: position.as_of }) : null;
        return id ? [id] : [];
      });
      if (matches.length === 1 && (!position.instrument_id || position.instrument_id === matches[0])) {
        instrumentId = matches[0]; provenance = "sandbox_fixture";
      }
    } else if (value) {
      const namespace = `${input.provider}.instrument`;
      const applicable = aliasesByValue.get(value) ?? [];
      const resolved = resolveInstrumentAlias(applicable, { namespace, value, asOf: position.as_of });
      // A stale/ambiguous/conflicting alias must not be bypassed by a cached ID.
      if (applicable.length) {
        if (resolved && (!position.instrument_id || position.instrument_id === resolved)) {
          instrumentId = resolved; provenance = "provider_alias";
        }
      } else if (position.instrument_id) { instrumentId = position.instrument_id; provenance = "persisted"; }
    } else if (position.instrument_id) { instrumentId = position.instrument_id; provenance = "persisted"; }
    result[position.id] = { instrumentId, provenance };
  }
  return result;
}

// Callback keeps this boundary testable without network or privileged clients.
export const BROKER_ALIAS_READ_BUDGET = { batchSize: 200, pageSize: 1000, maxRows: 10_000, maxPages: 50 } as const;
export class BrokerAliasAvailabilityError extends Error {
  constructor() { super("Connected Portfolio aliases unavailable"); this.name = "BrokerAliasAvailabilityError"; }
}
export function validateBrokerAliasPageEvidence(count: number | null, offset: number, size: number, limit: number) {
  // Unknown counts and server caps cannot justify treating a page as complete.
  if (count == null || !Number.isSafeInteger(count) || count < 0 || count > BROKER_ALIAS_READ_BUDGET.maxRows
    || offset > count || offset + size > count || size > limit || (size < limit && offset + size < count)) {
    throw new BrokerAliasAvailabilityError();
  }
}
export async function loadBrokerPositionAliases(
  provider: string, values: readonly string[],
  read: (namespace: string, values: string[], offset: number, limit: number) => Promise<{ rows: InstrumentAlias[]; count: number | null }>,
): Promise<InstrumentAlias[]> {
  const unique = [...new Set(values.filter(Boolean))];
  const aliases: InstrumentAlias[] = [];
  let pages = 0;
  for (let batchOffset = 0; batchOffset < unique.length; batchOffset += BROKER_ALIAS_READ_BUDGET.batchSize) {
    const batch = unique.slice(batchOffset, batchOffset + BROKER_ALIAS_READ_BUDGET.batchSize);
    let expectedCount: number | null = null;
    for (let offset = 0; ; offset += BROKER_ALIAS_READ_BUDGET.pageSize) {
      if (pages >= BROKER_ALIAS_READ_BUDGET.maxPages) throw new BrokerAliasAvailabilityError();
      pages++;
      let page: { rows: InstrumentAlias[]; count: number | null };
      try { page = await read(`${provider}.instrument`, batch, offset, BROKER_ALIAS_READ_BUDGET.pageSize); }
      catch { throw new BrokerAliasAvailabilityError(); }
      const { rows, count } = page;
      validateBrokerAliasPageEvidence(count, offset, rows.length, BROKER_ALIAS_READ_BUDGET.pageSize);
      if (expectedCount != null && count !== expectedCount) throw new BrokerAliasAvailabilityError();
      expectedCount = count;
      if (rows.length > BROKER_ALIAS_READ_BUDGET.pageSize || aliases.length + rows.length > BROKER_ALIAS_READ_BUDGET.maxRows) {
        throw new BrokerAliasAvailabilityError();
      }
      aliases.push(...rows);
      // Exact count proves completeness even for a full page. Do not request
      // offset === count: PostgREST can reject that range with HTTP 416.
      if (offset + rows.length === count) break;
    }
  }
  return aliases;
}

export async function loadBrokerPositionAliasesSafely(...args: Parameters<typeof loadBrokerPositionAliases>) {
  try { return { aliases: await loadBrokerPositionAliases(...args), available: true }; }
  catch { return { aliases: [], available: false }; }
}
