import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ACTIVE_ID = "11111111-1111-4111-8111-111111111111";
const ACTIVE_EMAIL = "active-subscriber@stockgpt.invalid";
const PASSWORD = "LocalStockGPT!2026";
const EVENT_IDS = ["evt_wave5_once", "evt_wave5_unknown", "evt_wave5_retry", "evt_wave5_link", "evt_wave5_end"];
const DIGEST_KEY = "weekly:wave5-test";
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function localStatus() {
  const cli = resolve("node_modules", "supabase", "dist", "supabase.js");
  const output = execFileSync(process.execPath, [cli, "status", "-o", "env"], { encoding: "utf8" });
  return Object.fromEntries(output.split(/\r?\n/u).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u)).filter(Boolean).map((match) => [match[1], match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]]));
}

const status = localStatus();
const adminKey = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
assert(status.API_URL && status.ANON_KEY && adminKey, "Local Supabase configuration unavailable");
const admin = createClient(status.API_URL, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
const userClient = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const signIn = await userClient.auth.signInWithPassword({ email: ACTIVE_EMAIL, password: PASSWORD });
if (signIn.error) throw signIn.error;

const original = await admin.from("profiles").select("subscription_status,stripe_customer_id").eq("id", ACTIVE_ID).single();
if (original.error) throw original.error;

try {
  const denied = await userClient.rpc("process_stripe_entitlement_event", {
    p_event_id: "evt_wave5_hostile", p_event_type: "checkout.session.completed",
    p_action: "activate_basic", p_user_id: ACTIVE_ID, p_customer_id: "cus_hostile",
  });
  assert(denied.error, "Authenticated customer unexpectedly executed the trusted Stripe RPC");

  const first = await admin.rpc("process_stripe_entitlement_event", {
    p_event_id: EVENT_IDS[0], p_event_type: "checkout.session.completed",
    p_action: "activate_basic", p_user_id: ACTIVE_ID, p_customer_id: "cus_wave5_once",
  });
  if (first.error) throw first.error;
  assert(first.data?.processed === true && first.data.entitlementChanged === false, "First Stripe delivery was not processed safely");
  const duplicate = await admin.rpc("process_stripe_entitlement_event", {
    p_event_id: EVENT_IDS[0], p_event_type: "checkout.session.completed",
    p_action: "activate_basic", p_user_id: ACTIVE_ID, p_customer_id: "cus_wave5_once",
  });
  if (duplicate.error) throw duplicate.error;
  assert(duplicate.data?.processed === false, "Duplicate Stripe delivery was applied twice");

  await admin.from("profiles").update({ subscription_status: "none", stripe_customer_id: null }).eq("id", ACTIVE_ID);
  const linkOnly = await admin.rpc("process_stripe_entitlement_event", {
    p_event_id: EVENT_IDS[3], p_event_type: "checkout.session.completed", p_action: "link_customer",
    p_user_id: ACTIVE_ID, p_customer_id: "cus_wave5_link_only", p_subscription_id: "sub_wave5_incomplete",
  });
  if (linkOnly.error) throw linkOnly.error;
  assert(linkOnly.data?.processed === true && linkOnly.data.customerLinked === true, "Customer identity was not linked");
  assert(linkOnly.data.entitlementChanged === false, "Customer linking unexpectedly granted access");
  const linkedProfile = await admin.from("profiles").select("subscription_status,stripe_customer_id").eq("id", ACTIVE_ID).single();
  assert(linkedProfile.data?.subscription_status === "none", "Customer-only link changed entitlement");
  assert(linkedProfile.data?.stripe_customer_id === "cus_wave5_link_only", "Customer-only link was not persisted");

  await admin.from("profiles").update({ subscription_status: "basic" }).eq("id", ACTIVE_ID);
  const endAccess = await admin.rpc("process_stripe_entitlement_event", {
    p_event_id: EVENT_IDS[4], p_event_type: "customer.subscription.deleted", p_action: "end_access",
    p_user_id: ACTIVE_ID, p_customer_id: "cus_wave5_link_only", p_subscription_id: "sub_wave5_incomplete",
  });
  if (endAccess.error) throw endAccess.error;
  assert(endAccess.data?.processed === true && endAccess.data.entitlementChanged === true, "Terminal subscription state did not remove access");
  const endedProfile = await admin.from("profiles").select("subscription_status").eq("id", ACTIVE_ID).single();
  assert(endedProfile.data?.subscription_status === "none", "Terminal subscription state left access active");

  const beforeUnknown = await admin.from("profiles").select("subscription_status,stripe_customer_id").eq("id", ACTIVE_ID).single();
  const unknown = await admin.rpc("process_stripe_entitlement_event", {
    p_event_id: EVENT_IDS[1], p_event_type: "unknown.future.event", p_action: "ignore",
  });
  if (unknown.error) throw unknown.error;
  const afterUnknown = await admin.from("profiles").select("subscription_status,stripe_customer_id").eq("id", ACTIVE_ID).single();
  assert(JSON.stringify(beforeUnknown.data) === JSON.stringify(afterUnknown.data), "Unknown Stripe event changed entitlement");

  const failed = await admin.rpc("process_stripe_entitlement_event", {
    p_event_id: EVENT_IDS[2], p_event_type: "checkout.session.completed", p_action: "activate_basic",
    p_user_id: "99999999-9999-4999-8999-999999999999", p_customer_id: "cus_wave5_retry",
  });
  assert(failed.error, "Required Stripe write failure was not surfaced");
  const recorded = await admin.rpc("record_stripe_webhook_failure", {
    p_event_id: EVENT_IDS[2], p_event_type: "checkout.session.completed", p_error_code: "profile_missing",
    p_customer_id: "cus_wave5_retry",
  });
  if (recorded.error) throw recorded.error;
  const failedRow = await admin.from("stripe_webhook_events").select("status,processed_at").eq("event_id", EVENT_IDS[2]).single();
  assert(failedRow.data?.status === "failed" && failedRow.data?.processed_at == null, "Failed event was falsely recorded successful");
  const retry = await admin.rpc("process_stripe_entitlement_event", {
    p_event_id: EVENT_IDS[2], p_event_type: "checkout.session.completed", p_action: "activate_basic",
    p_user_id: ACTIVE_ID, p_customer_id: "cus_wave5_link_only",
  });
  if (retry.error) throw retry.error;
  assert(retry.data?.processed === true && retry.data.entitlementChanged === true, "Failed Stripe event did not complete on retry");
  const retryRow = await admin.from("stripe_webhook_events").select("status,attempts,processed_at").eq("event_id", EVENT_IDS[2]).single();
  assert(retryRow.data?.status === "processed" && retryRow.data.attempts >= 2 && retryRow.data.processed_at, "Retry audit state is incomplete");

  const hidden = await userClient.from("stripe_webhook_events").select("event_id");
  assert(hidden.error, "Customer unexpectedly read trusted webhook audit rows");

  const digestDenied = await userClient.rpc("claim_email_digest_delivery", {
    p_digest_key: DIGEST_KEY, p_user_id: ACTIVE_ID,
  });
  assert(digestDenied.error, "Customer unexpectedly claimed a trusted digest delivery");
  const digestClaim = await admin.rpc("claim_email_digest_delivery", {
    p_digest_key: DIGEST_KEY, p_user_id: ACTIVE_ID,
  });
  if (digestClaim.error) throw digestClaim.error;
  assert(digestClaim.data === true, "Initial digest delivery was not claimed");
  const duplicateDigestClaim = await admin.rpc("claim_email_digest_delivery", {
    p_digest_key: DIGEST_KEY, p_user_id: ACTIVE_ID,
  });
  assert(duplicateDigestClaim.data === false, "Concurrent digest delivery was claimed twice");
  await admin.rpc("fail_email_digest_delivery", {
    p_digest_key: DIGEST_KEY, p_user_id: ACTIVE_ID, p_error_code: "synthetic_failure",
  });
  const retryDigest = await admin.rpc("claim_email_digest_delivery", {
    p_digest_key: DIGEST_KEY, p_user_id: ACTIVE_ID,
  });
  assert(retryDigest.data === true, "Failed digest delivery was not retryable");
  await admin.rpc("complete_email_digest_delivery", {
    p_digest_key: DIGEST_KEY, p_user_id: ACTIVE_ID, p_provider_message_id: "synthetic-message",
  });
  const sentDigest = await admin.rpc("claim_email_digest_delivery", {
    p_digest_key: DIGEST_KEY, p_user_id: ACTIVE_ID,
  });
  assert(sentDigest.data === false, "Sent digest delivery was claimable again");
  console.log("Wave 5 local Stripe/security checks passed.");
} finally {
  await admin.from("stripe_webhook_events").delete().in("event_id", [...EVENT_IDS, "evt_wave5_hostile"]);
  await admin.from("email_digest_deliveries").delete().eq("digest_key", DIGEST_KEY);
  await admin.from("profiles").update(original.data).eq("id", ACTIVE_ID);
}
