import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const cli = resolve("node_modules", "supabase", "dist", "supabase.js");
const output = execFileSync(process.execPath, [cli, "status", "-o", "env"], { encoding: "utf8" });
const env = Object.fromEntries(output.split(/\r?\n/u).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u)).filter(Boolean).map((match) => [match[1], match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]]));
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY ?? env.SECRET_KEY, { auth: { persistSession: false } });
const userId = "11111111-1111-4111-8111-111111111111";
const prefix = `wave6-${randomUUID()}`;
const seedScope = await admin.from("broker_connections")
  .select("provider_id,institution_id")
  .eq("id", "72000000-0000-4000-8000-000000000001")
  .single();
if (seedScope.error) throw seedScope.error;

const connections = Array.from({ length: 120 }, (_, index) => ({
  id: randomUUID(),
  user_id: userId,
  provider_id: seedScope.data.provider_id,
  institution_id: seedScope.data.institution_id,
  external_connection_id: `${prefix}-${String(index).padStart(3, "0")}`,
  status: "active",
}));

try {
  const inserted = await admin.from("broker_connections").insert(connections);
  if (inserted.error) throw inserted.error;
  for (const connection of connections) {
    const queued = await admin.rpc("enqueue_broker_sync", {
      p_user_id: userId,
      p_connection_id: connection.id,
    });
    if (queued.error) throw queued.error;
  }

  const claim = (worker) => admin.rpc("claim_broker_sync_jobs", {
    p_worker_id: worker,
    p_limit: 1,
    p_lease_seconds: 60,
  });
  const claims = await Promise.all(
    Array.from({ length: 120 }, (_, index) => claim(`${prefix}-worker-${index}`)),
  );
  const jobs = claims.flatMap((result) => {
    if (result.error) throw result.error;
    return result.data ?? [];
  });
  assert.equal(jobs.length, 120, "Concurrent workers failed to claim all available jobs");
  assert.equal(new Set(jobs.map((job) => job.id)).size, 120, "A job was leased more than once");

  const recover = jobs[0];
  const expired = await admin.from("broker_sync_jobs")
    .update({ lease_expires_at: "2026-01-01T00:00:00Z" })
    .eq("id", recover.id);
  if (expired.error) throw expired.error;
  const recovered = await claim(`${prefix}-recovery`);
  if (recovered.error) throw recovered.error;
  assert.equal(recovered.data?.[0]?.id, recover.id, "Expired lease was not recoverable");
  assert.equal(recovered.data?.[0]?.attempt_count, 2);

  const bounded = await admin.rpc("claim_broker_sync_jobs", {
    p_worker_id: `${prefix}-bounded`,
    p_limit: 26,
    p_lease_seconds: 60,
  });
  assert(bounded.error, "Database accepted an unbounded worker claim");
  console.log("Wave 6 broker queue load: 120 concurrent claims, no duplicates, expired lease recovered, DB claim cap enforced.");
} finally {
  await admin.from("broker_connections").delete().in("id", connections.map((connection) => connection.id));
}
