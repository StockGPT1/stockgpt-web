import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { BrokerSyncCandidate } from "@/lib/brokerage/sync-candidate";
import { validateBrokerSyncCandidate } from "@/lib/brokerage/sync-candidate";

type Job = Database["public"]["Tables"]["broker_sync_jobs"]["Row"];
export type BrokerSyncFetcher = (
  admin: SupabaseClient<Database>,
  scope: { userId: string; providerId: string; externalConnectionId: string },
) => Promise<BrokerSyncCandidate>;

async function fetchForProvider(
  admin: SupabaseClient<Database>,
  scope: { userId: string; providerId: string; externalConnectionId: string; providerKey: string },
  fetchSnapTrade: BrokerSyncFetcher,
) {
  if (scope.providerKey !== "snaptrade") throw new Error("provider_not_implemented");
  return fetchSnapTrade(admin, scope);
}

export async function processBrokerSyncJob(
  admin: SupabaseClient<Database>,
  job: Job,
  workerId: string,
  fetchSnapTrade: BrokerSyncFetcher,
) {
  const connection = await admin.from("broker_connections")
    .select("id,user_id,provider_id,external_connection_id,status,broker_providers(provider_key)")
    .eq("id", job.connection_id)
    .eq("user_id", job.user_id)
    .single();
  if (connection.error || !connection.data) {
    await admin.rpc("fail_broker_sync_job", {
      p_job_id: job.id, p_worker_id: workerId, p_error_code: "connection_unavailable", p_retryable: false,
    });
    return { status: "terminal_failure" as const };
  }

  const scope = {
    userId: connection.data.user_id,
    providerId: connection.data.provider_id,
    externalConnectionId: connection.data.external_connection_id,
    providerKey: connection.data.broker_providers.provider_key,
  };
  if (connection.data.status === "revoked" || connection.data.status === "disconnected") {
    await admin.rpc("fail_broker_sync_job", {
      p_job_id: job.id, p_worker_id: workerId, p_error_code: "connection_inactive", p_retryable: false,
    });
    return { status: "terminal_failure" as const };
  }

  let candidate: BrokerSyncCandidate;
  try {
    candidate = await fetchForProvider(admin, scope, fetchSnapTrade);
  } catch {
    const { error } = await admin.rpc("fail_broker_sync_job", {
      p_job_id: job.id, p_worker_id: workerId, p_error_code: "provider_unavailable", p_retryable: true,
      p_retry_after_seconds: Math.min(3600, 60 * 2 ** Math.min(job.attempt_count, 6)),
    });
    if (error) throw new Error("Unable to record broker sync failure");
    console.warn("[broker-sync] provider_unavailable", { jobId: job.id });
    return { status: "retryable_failure" as const };
  }

  const validation = validateBrokerSyncCandidate(candidate);
  if (!validation.ok) {
    const { error } = await admin.rpc("fail_broker_sync_job", {
      p_job_id: job.id, p_worker_id: workerId, p_error_code: validation.errorCode,
      p_retryable: validation.retryable,
      p_retry_after_seconds: 300,
    });
    if (error) throw new Error("Unable to record broker sync validation failure");
    console.warn("[broker-sync] candidate_rejected", { jobId: job.id, code: validation.errorCode });
    return { status: validation.retryable ? "retryable_failure" as const : "terminal_failure" as const };
  }

  const { error } = await admin.rpc("promote_broker_sync_candidate", {
    p_job_id: job.id,
    p_worker_id: workerId,
    p_candidate: candidate,
  });
  if (error) {
    const failed = await admin.rpc("fail_broker_sync_job", {
      p_job_id: job.id, p_worker_id: workerId, p_error_code: "promotion_failed", p_retryable: true,
      p_retry_after_seconds: 300,
    });
    if (failed.error) throw new Error("Unable to record broker promotion failure");
    console.warn("[broker-sync] promotion_failed", { jobId: job.id });
    return { status: "retryable_failure" as const };
  }
  return { status: "succeeded" as const };
}

export async function runBoundedBrokerSyncWorker(
  admin: SupabaseClient<Database>,
  input: { workerId?: string; limit?: number; fetchSnapTrade: BrokerSyncFetcher },
) {
  const workerId = input.workerId ?? randomUUID();
  const limit = Math.min(5, Math.max(1, input.limit ?? 2));
  const { data: jobs, error } = await admin.rpc("claim_broker_sync_jobs", {
    p_worker_id: workerId, p_limit: limit, p_lease_seconds: 300,
  });
  if (error) throw new Error("Unable to claim broker sync jobs");
  const results = [];
  for (const job of jobs ?? []) {
    results.push(await processBrokerSyncJob(admin, job, workerId, input.fetchSnapTrade));
  }
  return { claimed: jobs?.length ?? 0, results };
}
