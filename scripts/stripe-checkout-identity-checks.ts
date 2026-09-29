import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveStripeCheckoutIdentity } from "../lib/stripe-checkout-identity";

const emailIdentity = resolveStripeCheckoutIdentity({
  email: "new-subscriber@stockgpt.invalid",
  hasActiveEntitlement: false,
  stripeCustomerId: null,
});
assert.deepEqual(emailIdentity, {
  kind: "create_checkout",
  customerParameters: {
    customer_email: "new-subscriber@stockgpt.invalid",
  },
});
assert.equal("customer" in emailIdentity.customerParameters, false);

for (const inactiveStatus of ["none", "canceled"] as const) {
  const existingIdentity = resolveStripeCheckoutIdentity({
    email: "returning-subscriber@stockgpt.invalid",
    hasActiveEntitlement: false,
    stripeCustomerId: "cus_existing_identity",
  });
  assert.deepEqual(existingIdentity, {
    kind: "create_checkout",
    customerParameters: { customer: "cus_existing_identity" },
  });
  assert.equal("customer_email" in existingIdentity.customerParameters, false);
  assert.ok(inactiveStatus, "inactive/canceled users retain the same decision");
}

assert.deepEqual(
  resolveStripeCheckoutIdentity({
    email: "active-subscriber@stockgpt.invalid",
    hasActiveEntitlement: true,
    stripeCustomerId: "cus_active_identity",
  }),
  { kind: "manage_existing" },
);

const routeSource = readFileSync(
  new URL("../app/api/create-checkout-session/route.ts", import.meta.url),
  "utf8",
);
assert.match(routeSource, /createClient/);
assert.match(routeSource, /\.select\("stripe_customer_id,subscription_status"\)/);
assert.match(routeSource, /\.eq\("id", user\.id\)/);
assert.match(routeSource, /hasActiveSubscription/);
assert.match(routeSource, /resolveStripeCheckoutIdentity/);
assert.match(routeSource, /checkoutIdentity\.kind === "manage_existing"/);
assert.ok(
  routeSource.indexOf('checkoutIdentity.kind === "manage_existing"') <
    routeSource.indexOf("stripe.checkout.sessions.create"),
  "active entitlement must short-circuit before Stripe Checkout creation",
);
assert.match(routeSource, /\.\.\.checkoutIdentity\.customerParameters/);
assert.doesNotMatch(
  routeSource,
  /createAdminClient|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_KEY/,
);

for (const requiredMetadata of [
  "user_id: user.id",
  "legal_version: LEGAL_VERSION",
  'legal_acknowledgement: "research_software"',
  "terms_url:",
  "subscription_terms_url:",
  "privacy_url:",
  "disclaimer_url:",
  "metadata: legalMetadata",
  "subscription_data:",
]) {
  assert.ok(
    routeSource.includes(requiredMetadata),
    `Checkout lost required metadata: ${requiredMetadata}`,
  );
}

const webhookMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260929085011_make_stripe_entitlement_state_order_safe.sql",
    import.meta.url,
  ),
  "utf8",
);
assert.match(webhookMigration, /stripe_customer_conflict/);
assert.match(webhookMigration, /stripe_customer_already_linked/);

const billingPortalSource = readFileSync(
  new URL("../app/api/create-billing-portal-session/route.ts", import.meta.url),
  "utf8",
);
assert.match(billingPortalSource, /\.select\("stripe_customer_id"\)/);
assert.match(billingPortalSource, /customer: customerId/);

console.log("Stripe Checkout identity checks passed.");
