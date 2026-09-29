import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { sendCoreSubscriptionActivatedEmail, sendPaymentFailedEmail, sendSubscriptionCancelledEmail } from "@/lib/transactional-email";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";

type SupabaseAdminClient = SupabaseClient<Database>;
type EntitlementAction = "activate_basic" | "ensure_basic" | "end_access" | "observe_only" | "ignore";

const KEEPING_ACCESS = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);
const ENDING_ACCESS = new Set<Stripe.Subscription.Status>(["canceled", "unpaid", "incomplete_expired"]);

async function getProfileEmail(admin: SupabaseAdminClient, column: "id" | "stripe_customer_id", value: string) {
  const { data, error } = await admin.from("profiles").select("email").eq(column, value).maybeSingle();
  if (error) throw error;
  return data?.email ?? null;
}

function customerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function safeErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) return String(error.code).slice(0, 100);
  return error instanceof Error ? error.name.replace(/[^a-z0-9_-]/gi, "_").slice(0, 100) : "unknown_error";
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "Webhook unavailable" }, { status: 500 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  const admin = createAdminClient();
  let action: EntitlementAction = "ignore";
  let userId: string | null = null;
  let stripeCustomerId: string | null = null;
  let subscriptionId: string | null = null;
  let emailKind: "activated" | "cancelled" | "payment_failed" | null = null;
  let explicitEmail: string | null = null;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    userId = session.metadata?.user_id ?? null;
    stripeCustomerId = customerId(session.customer);
    subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
    action = "activate_basic";
    emailKind = "activated";
    explicitEmail = session.customer_details?.email ?? session.customer_email ?? null;
  } else if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    stripeCustomerId = customerId(subscription.customer);
    subscriptionId = subscription.id;
    action = KEEPING_ACCESS.has(subscription.status)
      ? "ensure_basic"
      : ENDING_ACCESS.has(subscription.status) ? "end_access" : "observe_only";
  } else if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    stripeCustomerId = customerId(subscription.customer);
    subscriptionId = subscription.id;
    action = "end_access";
    emailKind = "cancelled";
  } else if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    stripeCustomerId = customerId(invoice.customer);
    action = "observe_only";
    emailKind = "payment_failed";
  }

  try {
    const { data: applied, error } = await admin.rpc("process_stripe_entitlement_event", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_action: action,
      p_user_id: userId ?? undefined,
      p_customer_id: stripeCustomerId ?? undefined,
      p_subscription_id: subscriptionId ?? undefined,
    });
    if (error) throw error;

    if (applied && emailKind) {
      const email = explicitEmail ?? (userId
        ? await getProfileEmail(admin, "id", userId)
        : stripeCustomerId ? await getProfileEmail(admin, "stripe_customer_id", stripeCustomerId) : null);
      if (email) {
        try {
          if (emailKind === "activated") await sendCoreSubscriptionActivatedEmail(email);
          if (emailKind === "cancelled") await sendSubscriptionCancelledEmail(email);
          if (emailKind === "payment_failed") await sendPaymentFailedEmail(email);
        } catch (emailError) {
          console.warn("[stripe-webhook] customer email failed", {
            eventId: event.id,
            eventType: event.type,
            errorCode: safeErrorCode(emailError),
          });
        }
      }
    }
    return NextResponse.json({ received: true, applied: Boolean(applied) });
  } catch (error) {
    const errorCode = safeErrorCode(error);
    const failure = await admin.rpc("record_stripe_webhook_failure", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_error_code: errorCode,
      p_customer_id: stripeCustomerId ?? undefined,
      p_subscription_id: subscriptionId ?? undefined,
    });
    if (failure.error) console.error("[stripe-webhook] failure state unavailable", { eventId: event.id });
    console.error("[stripe-webhook] processing failed", { eventId: event.id, eventType: event.type, errorCode });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
