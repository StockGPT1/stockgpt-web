import assert from "node:assert/strict";
import { deriveBrokerConnectionPresentation } from "../lib/brokerage/connection-presentation-state";

const lastSuccess = "2026-09-20T10:00:00Z";
const derive = (
  lifecycleStatus: Parameters<typeof deriveBrokerConnectionPresentation>[0]["lifecycleStatus"],
  latestSyncJobStatus: Parameters<typeof deriveBrokerConnectionPresentation>[0]["latestSyncJobStatus"],
  lastSuccessfulSyncAt: string | null = lastSuccess,
) => deriveBrokerConnectionPresentation({ lifecycleStatus, latestSyncJobStatus, lastSuccessfulSyncAt });

assert.equal(derive("active", "succeeded").state, "connected");
assert.equal(derive("active", null).state, "connected");
assert.equal(derive("active", "retryable_failure").state, "stale_error");
assert.equal(derive("active", "terminal_failure").state, "stale_error");
assert.equal(derive("disconnected", "terminal_failure").state, "disconnected");
assert.equal(derive("revoked", "retryable_failure").state, "revoked");
assert.equal(derive("active", "running", null).state, "syncing");
assert.equal(derive("active", "queued", null).state, "awaiting_discovery");
assert.equal(derive("pending", null, null).state, "awaiting_discovery");
assert.notEqual(derive("active", "retryable_failure").label, "Connected");
assert.notEqual(derive("active", "terminal_failure").label, "Connected");

console.log("Broker connection presentation-state precedence checks passed.");
