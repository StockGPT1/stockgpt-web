import type { Database } from "../database.types";

type Tables = Database["public"]["Tables"];
type Selection<T extends keyof Tables> = readonly (keyof Tables[T]["Row"] & string)[];

// Explicit columns, not SELECT *: external identifiers, descriptions, fingerprints,
// worker IDs and credential storage are deliberately outside this portable subset.
export const BROKER_EXPORT_COLUMNS = {
  broker_connections: ["id", "user_id", "provider_id", "institution_id", "status", "connected_at", "disconnected_at", "last_attempted_sync_at", "last_successful_sync_at"],
  broker_accounts: ["id", "user_id", "connection_id", "institution_id", "account_type", "base_currency", "status", "last_successful_sync_at"],
  broker_positions: ["id", "user_id", "account_id", "instrument_id", "symbol", "asset_type", "quantity", "price", "price_currency", "market_value", "market_value_currency", "as_of"],
  broker_cash_balances: ["id", "user_id", "account_id", "amount", "currency", "as_of"],
  broker_activities: ["id", "user_id", "account_id", "instrument_id", "activity_type", "currency", "gross_amount", "net_amount", "price", "quantity", "occurred_at", "occurred_at_precision", "recorded_at"],
  broker_account_value_history: ["id", "user_id", "account_id", "cash_value", "currency", "quality", "recorded_at", "source", "total_value", "value_at"],
  user_portfolios: ["id", "user_id", "broker_account_id", "management_source", "created_at", "updated_at", "archived_at"],
} as const satisfies { [T in "broker_connections" | "broker_accounts" | "broker_positions" | "broker_cash_balances" | "broker_activities" | "broker_account_value_history" | "user_portfolios"]: Selection<T> };

export type BrokerExportTable = keyof typeof BROKER_EXPORT_COLUMNS;
export type BrokerExportRows = { [T in BrokerExportTable]: Record<string, unknown>[] };
export const BROKER_EXPORT_LIMITS = Object.freeze({ pageSize: 500, maxPages: 40, maxRows: 10_000, maxBytes: 2_000_000 });
export const BROKER_EXPORT_TABLES = Object.keys(BROKER_EXPORT_COLUMNS) as BrokerExportTable[];

export type PrivacyFailureCode = "authentication_required" | "export_unavailable" | "export_limit_exceeded" | "export_inconsistent" | "owner_mismatch" | "parent_mismatch" | "invalid_record" | "target_unavailable";
export class PrivacyBoundaryError extends Error {
  constructor(readonly code: PrivacyFailureCode) { super(code); this.name = "PrivacyBoundaryError"; }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const monetary = new Set(["quantity", "price", "market_value", "amount", "gross_amount", "net_amount", "cash_value", "total_value"]);
export function assertSubject(subjectId: string): void {
  if (!uuid.test(subjectId)) throw new PrivacyBoundaryError("authentication_required");
}

/** This is a brokerage subset, NOT a complete GDPR rights export or an atomic DB snapshot. */
export function buildBrokerDataExport(subjectId: string, input: BrokerExportRows, recordedAt: string) {
  assertSubject(subjectId);
  if (!Number.isFinite(Date.parse(recordedAt))) throw new PrivacyBoundaryError("invalid_record");
  let total = 0;
  const data = {} as BrokerExportRows;
  for (const table of BROKER_EXPORT_TABLES) {
    const seen = new Set<string>();
    const source = input[table];
    if (!Array.isArray(source)) throw new PrivacyBoundaryError("invalid_record");
    total += source.length;
    if (total > BROKER_EXPORT_LIMITS.maxRows) throw new PrivacyBoundaryError("export_limit_exceeded");
    data[table] = source.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) throw new PrivacyBoundaryError("invalid_record");
      if (row.user_id !== subjectId) throw new PrivacyBoundaryError("owner_mismatch");
      if (typeof row.id !== "string" || !uuid.test(row.id) || seen.has(row.id)) throw new PrivacyBoundaryError("invalid_record");
      seen.add(row.id);
      const projected: Record<string, string | number | null> = {};
      for (const key of BROKER_EXPORT_COLUMNS[table]) {
        const value = row[key];
        if (value !== null && typeof value !== "string" && typeof value !== "number") throw new PrivacyBoundaryError("invalid_record");
        if (typeof value === "number" && !Number.isFinite(value)) throw new PrivacyBoundaryError("invalid_record");
        if (monetary.has(key) && value !== null && typeof value !== "number") throw new PrivacyBoundaryError("invalid_record");
        if (typeof value === "string" && value.length > 1_024) throw new PrivacyBoundaryError("export_limit_exceeded");
        projected[key] = value;
      }
      return projected;
    });
  }
  const connections = new Map(data.broker_connections.map((row) => [row.id, row]));
  const accounts = new Map(data.broker_accounts.map((row) => [row.id, row]));
  for (const account of data.broker_accounts) {
    const parent = connections.get(account.connection_id);
    if (!parent || parent.institution_id !== account.institution_id) throw new PrivacyBoundaryError("parent_mismatch");
  }
  for (const table of ["broker_positions", "broker_cash_balances", "broker_activities", "broker_account_value_history"] as const) {
    for (const row of data[table]) if (!accounts.has(row.account_id)) throw new PrivacyBoundaryError("parent_mismatch");
  }
  for (const portfolio of data.user_portfolios) {
    if (portfolio.management_source !== "connected" || !accounts.has(portfolio.broker_account_id)) throw new PrivacyBoundaryError("parent_mismatch");
  }
  const result = { version: 1 as const, scope: "brokerage_subset" as const, subjectId, recordedAt, consistency: "non_transactional_read" as const, retentionPolicy: "awaiting_approved_policy" as const, data };
  if (new TextEncoder().encode(JSON.stringify(result)).length > BROKER_EXPORT_LIMITS.maxBytes) throw new PrivacyBoundaryError("export_limit_exceeded");
  return result;
}

export type BrokerDataExport = ReturnType<typeof buildBrokerDataExport>;
export type LifecycleIntent = "disconnect_provider" | "remove_connected_portfolio" | "revoke_provider_credential" | "delete_broker_data" | "close_stockgpt_account";

/** Inventory only. No permission grant, provider operation, SQL or destructive executor. */
export function planBrokerLifecycle(snapshot: BrokerDataExport, subjectId: string, intent: LifecycleIntent, targetId: string) {
  if (!["disconnect_provider", "remove_connected_portfolio", "revoke_provider_credential", "delete_broker_data", "close_stockgpt_account"].includes(intent)) throw new PrivacyBoundaryError("invalid_record");
  // Revalidate caller-provided snapshots instead of trusting a previously generated object.
  const safe = buildBrokerDataExport(subjectId, snapshot.data, snapshot.recordedAt);
  if (snapshot.subjectId !== subjectId) throw new PrivacyBoundaryError("owner_mismatch");
  const isPortfolio = intent === "remove_connected_portfolio";
  const target = (isPortfolio ? safe.data.user_portfolios : safe.data.broker_connections).find((row) => row.id === targetId);
  if (!target) throw new PrivacyBoundaryError("target_unavailable");
  const accounts = safe.data.broker_accounts.filter((row) => isPortfolio ? row.id === target.broker_account_id : row.connection_id === targetId);
  const accountIds = new Set(accounts.map((row) => row.id));
  const relatedRecords = Object.fromEntries(BROKER_EXPORT_TABLES.map((table) => [table, safe.data[table].filter((row) => table === "broker_connections" ? row.id === (isPortfolio ? accounts[0]?.connection_id : targetId) : table === "broker_accounts" ? accountIds.has(row.id) : table === "user_portfolios" ? accountIds.has(row.broker_account_id) : accountIds.has(row.account_id)).length]));
  return {
    intent, targetId, mode: "inventory_only" as const, executable: false as const,
    decision: intent === "delete_broker_data" || intent === "close_stockgpt_account" ? "blocked_pending_retention_and_rights_policy" : "requires_separate_trusted_operation",
    relatedRecords,
    preservesLastGoodFinancialData: intent !== "delete_broker_data" && intent !== "close_stockgpt_account",
    // Explicit separation: none of these counts authorizes cascading deletion.
    providerDisconnectIsDataDeletion: false as const,
    portfolioRemovalIsCredentialRevocation: false as const,
    uncounted: ["broker_private.user_provider_credentials", "vault", "broker_sync_jobs", "manual_portfolio_ledger", "ask_stockgpt_messages", "billing", "backups", "platform_logs"],
    wholeAccountInventoryComplete: false as const,
  };
}
