import { createHash } from "node:crypto";

export const STAGE22B_SCOPE = {
  teamId: "team_eUm0mdcYHHHcNo4D5tMm9cHQ",
  projectId: "prj_AxbNJT8VObcG020Abob7Vu5XhdMo",
  supabaseUrl: "https://oocvbilwiosehfqpzges.supabase.co",
  branch: "codex/broker-sync-foundation",
} as const;

export type Stage22bApproval = {
  jobId: string; userId: string; connectionId: string; providerId: string;
  externalConnectionId: string; institutionId: string; externalInstitutionId: string;
  externalAccountIds: readonly string[];
  broker: "SANDBOX"; permission: "read"; keyClassification: "commercial_test";
  // A separately reviewed TEST-key receipt, not an inference from key format.
  credentialPairSha256: string;
};
// No job/key pair is activated by this preparation. Flags alone are insufficient.
export const APPROVED_STAGE22B_PROOFS: readonly Stage22bApproval[] = [];
type Env = Readonly<Record<string, string | undefined>>;
type Rejected = { ok: false; code: string };
const reject = (code: string): Rejected => ({ ok: false, code });
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function prepareStage22bProof(env: Env, approvals: readonly Stage22bApproval[], now: number): Rejected | { ok: true; approval: Stage22bApproval } {
  if (env.STOCKGPT_STAGE22B_PROOF_ENABLED !== "true") return reject("proof_disabled");
  // Production here means only the separate staging project's cron-capable
  // target. Customer Production, Preview, local and custom targets all reject.
  if (env.VERCEL !== "1" || env.NODE_ENV !== "production" || env.VERCEL_PROJECT_ID !== STAGE22B_SCOPE.projectId
    || env.VERCEL_ENV !== "production" || env.VERCEL_TARGET_ENV !== "production"
    || env.VERCEL_GIT_COMMIT_REF !== STAGE22B_SCOPE.branch) return reject("proof_runtime_scope_rejected");
  // Team is an operator-pinned deployment receipt; VERCEL_ORG_ID is a CLI
  // variable, not a documented automatic runtime identity variable.
  if (env.STOCKGPT_STAGE22B_TEAM_ID !== STAGE22B_SCOPE.teamId) return reject("proof_team_receipt_missing");
  if (env.NEXT_PUBLIC_SUPABASE_URL !== STAGE22B_SCOPE.supabaseUrl
    || (env.SUPABASE_URL != null && env.SUPABASE_URL !== STAGE22B_SCOPE.supabaseUrl)) return reject("proof_database_scope_rejected");
  if (env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX !== "true"
    || env.STOCKGPT_STAGE22B_KEY_CLASSIFICATION !== "commercial_test"
    || env.STOCKGPT_STAGE22B_BROKER !== "SANDBOX") return reject("proof_test_evidence_missing");
  const start = Date.parse(env.STOCKGPT_STAGE22B_NOT_BEFORE ?? "");
  const end = Date.parse(env.STOCKGPT_STAGE22B_EXPIRES_AT ?? "");
  if (![now, start, end].every(Number.isFinite) || start > now || now >= end
    || end <= start || end - start > 2 * 60 * 60 * 1000) return reject("proof_activation_window_rejected");
  const matches = approvals.filter((approval) => approval.jobId === env.STOCKGPT_STAGE22B_JOB_ID);
  if (matches.length !== 1) return reject("proof_identity_not_approved");
  const approval = matches[0];
  if (![approval.jobId, approval.userId, approval.connectionId, approval.providerId, approval.institutionId].every(uuid)
    || !approval.externalConnectionId.trim() || !approval.externalInstitutionId.trim()
    || !Array.isArray(approval.externalAccountIds) || approval.externalAccountIds.length < 1 || approval.externalAccountIds.length > 2
    || approval.externalAccountIds.some((id) => !uuid(id)) || new Set(approval.externalAccountIds).size !== approval.externalAccountIds.length
    || approval.broker !== "SANDBOX" || approval.permission !== "read"
    || approval.keyClassification !== "commercial_test") return reject("proof_approval_invalid");
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.SNAPTRADE_CLIENT_ID || !env.SNAPTRADE_CONSUMER_KEY) return reject("proof_credentials_missing");
  const digest = createHash("sha256").update(JSON.stringify([env.SNAPTRADE_CLIENT_ID, env.SNAPTRADE_CONSUMER_KEY])).digest("hex");
  if (!/^[a-f0-9]{64}$/.test(approval.credentialPairSha256) || digest !== approval.credentialPairSha256) return reject("proof_test_key_conflict");
  return { ok: true, approval };
}

export type Stage22bJobEvidence = {
  id: string; user_id: string; connection_id: string; status: string; attempt_count: number;
  available_at: string; leased_by: string | null; lease_expires_at: string | null; started_at: string | null;
};
export type Stage22bConnectionEvidence = {
  id: string; userId: string; providerId: string; providerKey: string; status: string;
  externalConnectionId: string; institutionId: string; externalInstitutionId: string;
};
// Specification-level operational preflight, NOT global queue isolation.
// The exact-job DB RPC rechecks relationships/freshness atomically but does not
// serialize concurrent enqueue operations. Never authorize the global claim RPC.
export function stage22bJobEligibility(approval: Stage22bApproval, activeJobs: readonly Stage22bJobEvidence[], connection: Stage22bConnectionEvidence, now: number) {
  if (activeJobs.length !== 1) return reject("proof_queue_not_single");
  const job = activeJobs[0];
  if (job.id !== approval.jobId || job.user_id !== approval.userId || job.connection_id !== approval.connectionId) return reject("proof_job_identity_rejected");
  if (job.status !== "queued" || job.attempt_count !== 0 || job.leased_by != null || job.lease_expires_at != null || job.started_at != null
    || !Number.isFinite(now) || !Number.isFinite(Date.parse(job.available_at)) || Date.parse(job.available_at) > now) return reject("proof_job_not_fresh");
  if (connection.id !== approval.connectionId || connection.userId !== approval.userId || connection.providerId !== approval.providerId
    || connection.providerKey !== "snaptrade" || !["active", "pending"].includes(connection.status)
    || connection.externalConnectionId !== approval.externalConnectionId || connection.institutionId !== approval.institutionId
    || connection.externalInstitutionId !== approval.externalInstitutionId) return reject("proof_connection_identity_rejected");
  return { ok: true as const };
}
