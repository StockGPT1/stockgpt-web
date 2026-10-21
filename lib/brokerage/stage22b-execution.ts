import "server-only";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { prepareStage22bProof, STAGE22B_SCOPE, type Stage22bApproval } from "./stage22b-proof";
import { validateBrokerSyncCandidate, type BrokerSyncCandidate } from "./sync-candidate";
import { createProofSnapTradeClient } from "./providers/snaptrade/proof-transport";
import { fetchSnapTradeSyncCandidate } from "./providers/snaptrade/service";

type Env = Readonly<Record<string, string | undefined>>;
type Admin = SupabaseClient<Database>;
export const PROOF_EXECUTION_MS = 180_000;
type Dependencies = {
  now?: () => number;
  createAdmin?: (env: Env, signal: AbortSignal) => Admin;
  collect?: (admin: Admin, approval: Stage22bApproval, env: Env, signal: AbortSignal, deadline: number) => Promise<BrokerSyncCandidate>;
};

function proofAdmin(env: Env, signal: AbortSignal): Admin {
  let requests = 0;
  return createClient<Database>(STAGE22B_SCOPE.supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      try {
        // Exact endpoint allowlist; no Auth fallback, retries or cross-host redirects.
        const target = new URL(String(url));
        const paths = ["claim_exact_broker_sync_proof_job", "get_broker_user_secret", "fail_broker_sync_job", "promote_broker_sync_candidate"].map((name) => `/rest/v1/rpc/${name}`);
        if (++requests > 64 || signal.aborted || target.origin !== STAGE22B_SCOPE.supabaseUrl || (!paths.includes(target.pathname) && target.pathname !== "/rest/v1/instrument_aliases")) throw new Error("proof_database_path_rejected");
        const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) });
        if (!response.ok || response.redirected) { await response.body?.cancel(); throw new Error("proof_database_http_rejected"); }
        return response;
      } catch {
        // postgrest-js otherwise retries idempotent alias reads on network/
        // 503 errors. AbortError explicitly disables that branch, including
        // budget/timeout failures; keep provider/DB details out of its error.
        throw new DOMException("proof_database_request_failed", "AbortError");
      }
    } },
  });
}

export async function runStage22bProof(env: Env, approvals: readonly Stage22bApproval[], deps: Dependencies = {}) {
  const now = deps.now ?? Date.now;
  const ready = prepareStage22bProof(env, approvals, now());
  if (!ready.ok) return { status: "blocked" as const, claimed: 0, code: ready.code };
  // No admin or provider object exists until the full reviewed receipt passes.
  const approval = ready.approval;
  const controller = new AbortController();
  const deadline = Math.min(now() + PROOF_EXECUTION_MS, Date.parse(env.STOCKGPT_STAGE22B_EXPIRES_AT!));
  const timer = setTimeout(() => controller.abort(), Math.max(1, deadline - now()));
  let admin: Admin | undefined;
  let phase: "claim" | "collect" | "promote" = "claim";
  let claimed: number | null = null;
  const worker = randomUUID();
  try {
    admin = (deps.createAdmin ?? proofAdmin)(env, controller.signal);
    const result = await admin.rpc("claim_exact_broker_sync_proof_job", {
      p_job_id: approval.jobId, p_user_id: approval.userId, p_connection_id: approval.connectionId,
      p_provider_id: approval.providerId, p_external_connection_id: approval.externalConnectionId,
      p_institution_id: approval.institutionId, p_external_institution_id: approval.externalInstitutionId, p_worker_id: worker,
    });
    if (result.error || !Array.isArray(result.data)) throw new Error("proof_claim_unavailable");
    claimed = result.data.length;
    if (claimed === 0) return { status: "not_claimed" as const, claimed: 0 };
    const job = result.data[0];
    if (claimed !== 1 || job.id !== approval.jobId || job.user_id !== approval.userId || job.connection_id !== approval.connectionId
      || job.status !== "running" || job.attempt_count !== 1 || job.leased_by !== worker) throw new Error("proof_claim_invalid");
    phase = "collect";
    const collect = deps.collect ?? (async (db, receipt, values, signal, end) => fetchSnapTradeSyncCandidate(db, {
      userId: receipt.userId, providerId: receipt.providerId, externalConnectionId: receipt.externalConnectionId,
    }, createProofSnapTradeClient({ approval: receipt, clientId: values.SNAPTRADE_CLIENT_ID!, consumerKey: values.SNAPTRADE_CONSUMER_KEY!, signal, deadline: end })));
    const candidate = await collect(admin, approval, env, controller.signal, deadline);
    // Sandbox evidence must never be promoted as verified real-market identity.
    // Reject rather than rewriting IDs resolved by the ordinary collector.
    if (candidate.accounts.some((a) => a.positions.items.some((p) => p.instrumentId != null)
      || a.activities.items.some((activity) => activity.instrumentId != null))) throw new Error("proof_candidate_rejected");
    const expected = new Set(approval.externalAccountIds);
    if (controller.signal.aborted || now() >= deadline || !validateBrokerSyncCandidate(candidate).ok
      || candidate.accounts.length !== expected.size || new Set(candidate.accounts.map((a) => a.externalAccountId)).size !== expected.size
      || candidate.accounts.some((a) => !expected.has(a.externalAccountId) || a.externalInstitutionId !== approval.externalInstitutionId)) throw new Error("proof_candidate_rejected");
    phase = "promote";
    const promoted = await admin.rpc("promote_broker_sync_candidate", { p_job_id: job.id, p_worker_id: worker, p_candidate: candidate });
    // A failed/timeout HTTP reply may follow a committed DB call. Never retry
    // promotion or compensate based on a missing acknowledgement.
    if (promoted.error) throw new Error("proof_promotion_unacknowledged");
    return { status: "succeeded" as const, claimed: 1 };
  } catch {
    if (phase === "collect" && admin && !controller.signal.aborted && now() < deadline) {
      try {
        const failed = await admin.rpc("fail_broker_sync_job", {
          p_job_id: approval.jobId, p_worker_id: worker, p_error_code: "proof_sync_failed", p_retryable: false,
        });
        if (!failed.error) return { status: "terminal_failure" as const, claimed: 1 };
      } catch { /* Unknown acknowledgement: stop; do not repeat a DB operation. */ }
    }
    return { status: "indeterminate" as const, claimed, code: "proof_inspection_required" };
  } finally { clearTimeout(timer); controller.abort(); }
}
