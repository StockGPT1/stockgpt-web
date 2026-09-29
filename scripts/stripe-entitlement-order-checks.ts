import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type Stripe from "stripe";
import {
  buildStripeEntitlementPlan,
  entitlementActionForSubscriptionStatus,
  parseStripeEntitlementProcessingResult,
  shouldSendStripeEntitlementEmail,
} from "../lib/stripe-entitlement";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CUSTOMER_ID = "cus_order_safe";
const SUBSCRIPTION_ID = "sub_order_safe";

function subscription(status: Stripe.Subscription.Status) {
  return {
    id: SUBSCRIPTION_ID,
    object: "subscription",
    customer: CUSTOMER_ID,
    status,
    metadata: { user_id: USER_ID },
  } as unknown as Stripe.Subscription;
}

function checkoutEvent(
  type: "checkout.session.completed" | "checkout.session.async_payment_succeeded",
  paymentStatus: Stripe.Checkout.Session["payment_status"] = "paid",
) {
  return {
    type,
    data: {
      object: {
        mode: "subscription",
        customer: CUSTOMER_ID,
        subscription: SUBSCRIPTION_ID,
        metadata: { user_id: USER_ID },
        customer_details: { email: "subscriber@stockgpt.invalid" },
        customer_email: null,
        payment_status: paymentStatus,
      } as unknown as Stripe.Checkout.Session,
    },
  };
}

function subscriptionEvent(
  type: "customer.subscription.updated" | "customer.subscription.deleted",
  snapshotStatus: Stripe.Subscription.Status,
) {
  return { type, data: { object: subscription(snapshotStatus) } };
}

async function main() {
for (const status of ["active", "trialing", "past_due"] as const) {
  assert.equal(entitlementActionForSubscriptionStatus(status, "subscription_event"), "ensure_basic");
  assert.equal(entitlementActionForSubscriptionStatus(status, "checkout"), "activate_basic");
}
for (const status of ["canceled", "unpaid", "incomplete_expired"] as const) {
  assert.equal(entitlementActionForSubscriptionStatus(status, "subscription_event"), "end_access");
  assert.equal(entitlementActionForSubscriptionStatus(status, "checkout"), "end_access");
}
for (const status of ["incomplete", "paused"] as const) {
  assert.equal(entitlementActionForSubscriptionStatus(status, "subscription_event"), "observe_only");
  assert.equal(entitlementActionForSubscriptionStatus(status, "checkout"), "link_customer");
}

const staleActive = await buildStripeEntitlementPlan(
  subscriptionEvent("customer.subscription.updated", "active"),
  async () => subscription("canceled"),
);
assert.equal(staleActive.action, "end_access", "a stale active snapshot restored access after cancellation");
assert.equal(staleActive.resolvedSubscriptionStatus, "canceled");

for (const status of ["active", "trialing", "past_due"] as const) {
  const plan = await buildStripeEntitlementPlan(
    checkoutEvent("checkout.session.completed"),
    async () => subscription(status),
  );
  assert.equal(plan.action, "activate_basic");
  assert.equal(plan.customerId, CUSTOMER_ID);
  assert.equal(plan.userId, USER_ID);
}

for (const status of ["canceled", "unpaid", "incomplete_expired"] as const) {
  const plan = await buildStripeEntitlementPlan(
    checkoutEvent("checkout.session.completed", "unpaid"),
    async () => subscription(status),
  );
  assert.equal(plan.action, "end_access", `Checkout incorrectly activated ${status}`);
  assert.equal(plan.emailKind, null);
}

const incompleteCheckout = await buildStripeEntitlementPlan(
  checkoutEvent("checkout.session.completed", "unpaid"),
  async () => subscription("incomplete"),
);
assert.equal(incompleteCheckout.action, "link_customer");
assert.equal(incompleteCheckout.emailKind, null);

const delayedSuccess = await buildStripeEntitlementPlan(
  checkoutEvent("checkout.session.async_payment_succeeded"),
  async () => subscription("active"),
);
assert.equal(delayedSuccess.action, "activate_basic");

await assert.rejects(
  buildStripeEntitlementPlan(
    subscriptionEvent("customer.subscription.updated", "active"),
    async () => {
      throw Object.assign(new Error("temporary Stripe failure"), { code: "api_connection_error" });
    },
  ),
  /temporary Stripe failure/,
);

const definitivelyMissing = await buildStripeEntitlementPlan(
  subscriptionEvent("customer.subscription.updated", "active"),
  async () => {
    throw Object.assign(new Error("missing"), { code: "resource_missing", statusCode: 404 });
  },
);
assert.equal(definitivelyMissing.action, "end_access");

const unknown = await buildStripeEntitlementPlan(
  { type: "unknown.future.event", data: { object: {} } },
  async () => {
    throw new Error("unknown events must not retrieve subscriptions");
  },
);
assert.equal(unknown.action, "ignore");

const changed = parseStripeEntitlementProcessingResult({
  processed: true,
  entitlementChanged: true,
  customerLinked: true,
});
const unchanged = parseStripeEntitlementProcessingResult({
  processed: true,
  entitlementChanged: false,
  customerLinked: true,
});
assert.equal(shouldSendStripeEntitlementEmail("activated", changed), true);
assert.equal(shouldSendStripeEntitlementEmail("activated", unchanged), false);
assert.equal(shouldSendStripeEntitlementEmail("cancelled", unchanged), false);
assert.equal(shouldSendStripeEntitlementEmail("payment_failed", unchanged), true);

const routeSource = readFileSync(
  new URL("../app/api/stripe-webhook/route.ts", import.meta.url),
  "utf8",
);
assert.match(routeSource, /stripe\.subscriptions\.retrieve/);
assert.match(routeSource, /checkout\.session\.async_payment_succeeded|buildStripeEntitlementPlan/);
assert.doesNotMatch(routeSource, /event\.created/);
assert.ok(
  routeSource.indexOf("buildStripeEntitlementPlan") <
    routeSource.indexOf('admin.rpc("process_stripe_entitlement_event"'),
  "entitlement mutation happened before authoritative subscription resolution",
);

console.log("Stripe entitlement ordering checks passed.");
}

void main();
