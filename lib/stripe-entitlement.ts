import type Stripe from "stripe";

export type StripeEntitlementAction =
  | "activate_basic"
  | "ensure_basic"
  | "end_access"
  | "link_customer"
  | "observe_only"
  | "ignore";

export type StripeEntitlementEmailKind = "activated" | "cancelled" | "payment_failed";

export type StripeEntitlementPlan = {
  action: StripeEntitlementAction;
  userId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  resolvedSubscriptionStatus: Stripe.Subscription.Status | null;
  emailKind: StripeEntitlementEmailKind | null;
  explicitEmail: string | null;
};

export type StripeEntitlementProcessingResult = {
  processed: boolean;
  entitlementChanged: boolean;
  customerLinked: boolean;
};

type StripeEventLike = {
  type: string;
  data: { object: unknown };
};

type SubscriptionRetriever = (subscriptionId: string) => Promise<Stripe.Subscription>;

const KEEPING_ACCESS = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);
const ENDING_ACCESS = new Set<Stripe.Subscription.Status>(["canceled", "unpaid", "incomplete_expired"]);
const CHECKOUT_SUCCESS_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

function idFromExpandable<T extends { id: string }>(value: string | T | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function userIdFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  const value = metadata?.user_id?.trim();
  return value || null;
}

function isDefinitivelyMissingStripeResource(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; statusCode?: unknown };
  return candidate.code === "resource_missing" || candidate.statusCode === 404;
}

async function retrieveCurrentSubscription(
  subscriptionId: string,
  retrieveSubscription: SubscriptionRetriever,
) {
  try {
    return await retrieveSubscription(subscriptionId);
  } catch (error) {
    if (isDefinitivelyMissingStripeResource(error)) return null;
    throw error;
  }
}

export function entitlementActionForSubscriptionStatus(
  status: Stripe.Subscription.Status,
  source: "checkout" | "subscription_event",
): StripeEntitlementAction {
  if (KEEPING_ACCESS.has(status)) {
    return source === "checkout" ? "activate_basic" : "ensure_basic";
  }
  if (ENDING_ACCESS.has(status)) return "end_access";
  return source === "checkout" ? "link_customer" : "observe_only";
}

export async function buildStripeEntitlementPlan(
  event: StripeEventLike,
  retrieveSubscription: SubscriptionRetriever,
): Promise<StripeEntitlementPlan> {
  const emptyPlan: StripeEntitlementPlan = {
    action: "ignore",
    userId: null,
    customerId: null,
    subscriptionId: null,
    resolvedSubscriptionStatus: null,
    emailKind: null,
    explicitEmail: null,
  };

  if (CHECKOUT_SUCCESS_EVENTS.has(event.type)) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription") return emptyPlan;

    const subscriptionId = idFromExpandable(session.subscription);
    const sessionCustomerId = idFromExpandable(session.customer);
    const userId = userIdFromMetadata(session.metadata);
    const explicitEmail = session.customer_details?.email ?? session.customer_email ?? null;

    if (!subscriptionId) {
      return {
        ...emptyPlan,
        action: sessionCustomerId && userId ? "link_customer" : "observe_only",
        userId,
        customerId: sessionCustomerId,
        explicitEmail,
      };
    }

    const subscription = await retrieveCurrentSubscription(subscriptionId, retrieveSubscription);
    if (!subscription) {
      return {
        ...emptyPlan,
        action: sessionCustomerId && userId ? "end_access" : "observe_only",
        userId,
        customerId: sessionCustomerId,
        subscriptionId,
        explicitEmail,
      };
    }

    const subscriptionCustomerId = idFromExpandable(subscription.customer);
    if (sessionCustomerId && subscriptionCustomerId && sessionCustomerId !== subscriptionCustomerId) {
      throw new Error("stripe_customer_mismatch");
    }

    const action = entitlementActionForSubscriptionStatus(subscription.status, "checkout");
    return {
      action,
      userId: userId ?? userIdFromMetadata(subscription.metadata),
      customerId: subscriptionCustomerId ?? sessionCustomerId,
      subscriptionId,
      resolvedSubscriptionStatus: subscription.status,
      emailKind: action === "activate_basic" ? "activated" : null,
      explicitEmail,
    };
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const snapshot = event.data.object as Stripe.Subscription;
    const snapshotCustomerId = idFromExpandable(snapshot.customer);
    const subscription = await retrieveCurrentSubscription(snapshot.id, retrieveSubscription);

    if (!subscription) {
      return {
        ...emptyPlan,
        action: "end_access",
        userId: userIdFromMetadata(snapshot.metadata),
        customerId: snapshotCustomerId,
        subscriptionId: snapshot.id,
        emailKind: event.type === "customer.subscription.deleted" ? "cancelled" : null,
      };
    }

    const action = entitlementActionForSubscriptionStatus(subscription.status, "subscription_event");
    return {
      action,
      userId: userIdFromMetadata(subscription.metadata),
      customerId: idFromExpandable(subscription.customer) ?? snapshotCustomerId,
      subscriptionId: subscription.id,
      resolvedSubscriptionStatus: subscription.status,
      emailKind:
        event.type === "customer.subscription.deleted" && action === "end_access"
          ? "cancelled"
          : null,
      explicitEmail: null,
    };
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    return {
      ...emptyPlan,
      action: "observe_only",
      customerId: idFromExpandable(invoice.customer),
      emailKind: "payment_failed",
    };
  }

  return emptyPlan;
}

export function parseStripeEntitlementProcessingResult(
  value: unknown,
): StripeEntitlementProcessingResult {
  if (!value || typeof value !== "object") {
    throw new Error("invalid_stripe_entitlement_result");
  }
  const result = value as Record<string, unknown>;
  if (
    typeof result.processed !== "boolean" ||
    typeof result.entitlementChanged !== "boolean" ||
    typeof result.customerLinked !== "boolean"
  ) {
    throw new Error("invalid_stripe_entitlement_result");
  }
  return {
    processed: result.processed,
    entitlementChanged: result.entitlementChanged,
    customerLinked: result.customerLinked,
  };
}

export function shouldSendStripeEntitlementEmail(
  emailKind: StripeEntitlementEmailKind | null,
  result: StripeEntitlementProcessingResult,
) {
  if (!result.processed || !emailKind) return false;
  if (emailKind === "activated" || emailKind === "cancelled") {
    return result.entitlementChanged;
  }
  return true;
}
