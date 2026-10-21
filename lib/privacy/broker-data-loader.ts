import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { assertSubject, BROKER_EXPORT_COLUMNS, BROKER_EXPORT_LIMITS, BROKER_EXPORT_TABLES, buildBrokerDataExport, PrivacyBoundaryError, type BrokerExportRows } from "./broker-data-contract";

/** Supply the normal authenticated session/RLS client, never an admin client.
 * No subject ID parameter: current ownership comes from verified getUser().
 * Deliberately not exposed by an HTTP route until delivery/rights policy is approved.
 */
export async function loadOwnBrokerDataExport(session: SupabaseClient<Database>, recordedAt: string) {
  let subjectId: string;
  try {
    const auth = await session.auth.getUser();
    if (auth.error || !auth.data.user) throw new PrivacyBoundaryError("authentication_required");
    subjectId = auth.data.user.id;
    assertSubject(subjectId);
  } catch { throw new PrivacyBoundaryError("authentication_required"); }
  const rows = {} as BrokerExportRows;
  let pages = 0;
  let totalRows = 0;
  for (const table of BROKER_EXPORT_TABLES) {
    rows[table] = [];
    let expectedCount: number | null = null;
    for (let offset = 0; ; offset += BROKER_EXPORT_LIMITS.pageSize) {
      if (++pages > BROKER_EXPORT_LIMITS.maxPages) throw new PrivacyBoundaryError("export_limit_exceeded");
      let result;
      try {
        const query = table === "user_portfolios"
          ? session.from("user_portfolios").select(BROKER_EXPORT_COLUMNS[table].join(","), { count: "exact" }).eq("user_id", subjectId).eq("management_source", "connected")
          : session.from(table).select(BROKER_EXPORT_COLUMNS[table].join(","), { count: "exact" }).eq("user_id", subjectId);
        result = await query.order("id").range(offset, offset + BROKER_EXPORT_LIMITS.pageSize - 1);
      } catch { throw new PrivacyBoundaryError("export_unavailable"); }
      if (result.error || !Array.isArray(result.data)) throw new PrivacyBoundaryError("export_unavailable");
      if (!Number.isSafeInteger(result.count) || result.count === null || result.count < 0) throw new PrivacyBoundaryError("export_inconsistent");
      if (expectedCount !== null && expectedCount !== result.count) throw new PrivacyBoundaryError("export_inconsistent");
      expectedCount = result.count;
      if (expectedCount > BROKER_EXPORT_LIMITS.maxRows - (totalRows - rows[table].length)) throw new PrivacyBoundaryError("export_limit_exceeded");
      const batch = result.data as unknown as Record<string, unknown>[];
      if (batch.length > BROKER_EXPORT_LIMITS.pageSize || rows[table].length + batch.length > expectedCount) throw new PrivacyBoundaryError("export_inconsistent");
      rows[table].push(...batch);
      totalRows += batch.length;
      if (rows[table].length === expectedCount) break;
      if (batch.length !== BROKER_EXPORT_LIMITS.pageSize) throw new PrivacyBoundaryError("export_inconsistent");
    }
  }
  return buildBrokerDataExport(subjectId, rows, recordedAt);
}
