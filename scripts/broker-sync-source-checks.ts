import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260913184520_establish_broker_sync_engine.sql", "utf8");
const secrets = readFileSync("supabase/migrations/20260913184518_establish_broker_secret_boundary.sql", "utf8");
const worker = readFileSync("lib/brokerage/sync-worker.ts", "utf8") + readFileSync("lib/brokerage/sync-runner.ts", "utf8");
const provider = readFileSync("lib/brokerage/providers/snaptrade/service.ts", "utf8");
const route = readFileSync("app/api/cron/broker-sync/route.ts", "utf8");
const core = readFileSync("lib/brokerage/sync-candidate.ts", "utf8");

assert.match(secrets, /create schema broker_private/u);
assert.match(secrets, /vault\.create_secret/u);
assert.match(secrets, /vault\.update_secret/u);
assert.match(secrets, /delete from vault\.secrets/u);
assert.match(secrets, /security definer[\s\S]*?set search_path = ''/u);
assert.match(secrets, /revoke all on function public\.get_broker_user_secret\(uuid, uuid\) from public, anon, authenticated/u);
assert.match(migration, /for update skip locked/u);
assert.match(migration, /for update/u);
assert.match(migration, /broker_sync_lease_not_owned/u);
assert.match(migration, /v_provider_freshness_at < v_connection\.last_successful_sync_at/u);
assert.match(migration, /v_positions_state is distinct from 'complete'/u);
assert.match(migration, /v_balances_state is distinct from 'complete'/u);
assert.match(migration, /v_activities_state is distinct from 'complete'/u);
assert.match(migration, /revoke all on function public\.promote_broker_sync_candidate\(uuid, text, jsonb\) from public, anon, authenticated/u);
assert.match(worker, /validateBrokerSyncCandidate\(candidate\)/u);
assert.match(worker, /promotion_failed/u);
assert.match(worker, /provider_unavailable/u);
assert.match(worker, /console\.warn\("\[broker-sync\][^"]+", \{ jobId: job\.id/u);
const logs = [...(worker + provider).matchAll(/console\.(?:log|info|warn|error)\([^\n]+/gu)].map((match) => match[0]);
assert(logs.every((entry) => /\{ jobId: job\.id(?:, code: validation\.errorCode)? \}/u.test(entry)), "Broker logs include more than a job ID and sanitized code");
assert(!/instrument_market_data|stock_rankings|user_portfolios/u.test(worker + provider + migration), "Broker prices leaked into global market/Portfolio truth");
assert(!/\.trading\.|refreshBrokerageAuthorization|place(Order|ForceOrder|MlegOrder|ComplexOrder)/u.test(worker + provider));
assert.match(route, /isAuthorizedCron\(request\)/u);
assert.match(route, /export const runtime = "nodejs"/u);
assert(!/SnapTrade|snaptrade/iu.test(core), "Provider-specific type leaked into core sync candidate");

console.log("Broker secret, bounded worker, atomic promotion, source-of-truth and read-only source contracts passed.");
