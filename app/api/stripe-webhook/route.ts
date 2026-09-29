import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { sendCoreSubscriptionActivatedEmail, sendPaymentFailedEmail, sendSubscriptionCancelledEmail } from "@/lib/transactional-email";
import { stripe } from "@/lib/stripe";
import {
  buildStripeEntitlementPlan,
  parseStripeEntitlementProcessingResult,
  shouldSendStripeEntitlementEmail,
  type StripeEntitlementPlan,
} from "@/lib/stripe-entitlement";
import { createAdminClient } from "@/utils/supabase/admin";

type SupabaseAdminClient = SupabaseClient<Database>;

async function getProfileEmail(admin: SupabaseAdminClient, column: "id" | "stripe_customer_id", value: string) {
  const { data, error } = await admin.from("profiles").select("email").eq(column, value).maybeSingle();
  if (error) throw error;
  return data?.email ?? null;
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
  let plan: StripeEntitlementPlan | null = null;

  try {
    plan = await buildStripeEntitlementPlan(
      event,
      (subscriptionId) => stripe.subscriptions.retrieve(subscriptionId),
    );
    const { data: applied, error } = await admin.rpc("process_stripe_entitlement_event", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_action: plan.action,
      p_user_id: plan.userId ?? undefined,
      p_customer_id: plan.customerId ?? undefined,
      p_subscription_id: plan.subscriptionId ?? undefined,
    });
    if (error) throw error;
    const result = parseStripeEntitlementProcessingResult(applied);

    if (shouldSendStripeEntitlementEmail(plan.emailKind, result)) {
      const email = plan.explicitEmail ?? (plan.userId
        ? await getProfileEmail(admin, "id", plan.userId)
        : plan.customerId ? await getProfileEmail(admin, "stripe_customer_id", plan.customerId) : null);
      if (email) {
        try {
          if (plan.emailKind === "activated") await sendCoreSubscriptionActivatedEmail(email);
          if (plan.emailKind === "cancelled") await sendSubscriptionCancelledEmail(email);
          if (plan.emailKind === "payment_failed") await sendPaymentFailedEmail(email);
        } catch (emailError) {
          console.warn("[stripe-webhook] customer email failed", {
            eventId: event.id,
            eventType: event.type,
            errorCode: safeErrorCode(emailError),
          });
        }
      }
    }
    return NextResponse.json({ received: true, applied: result.processed });
  } catch (error) {
    const errorCode = safeErrorCode(error);
    const failure = await admin.rpc("record_stripe_webhook_failure", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_error_code: errorCode,
      p_customer_id: plan?.customerId ?? undefined,
      p_subscription_id: plan?.subscriptionId ?? undefined,
    });
    if (failure.error) console.error("[stripe-webhook] failure state unavailable", { eventId: event.id });
    console.error("[stripe-webhook] processing failed", { eventId: event.id, eventType: event.type, errorCode });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
