import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  sendCoreSubscriptionActivatedEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCancelledEmail,
} from "@/lib/transactional-email";
import { hasActiveSubscription } from "@/lib/subscription";
import { stripe } from "@/lib/stripe";

type ProfileRow = {
  email: string | null;
  subscription_status: string | null;
};

type SupabaseAdminClient = SupabaseClient;

// Stripe subscription statuses that should not remove app access.
// "past_due" is included on purpose: Stripe keeps retrying the payment
// (smart retries) and most involuntary failures recover. Access is only
// removed once Stripe gives up and the subscription is deleted/canceled.
const STRIPE_STATUSES_KEEPING_ACCESS = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
]);

const STRIPE_STATUSES_ENDING_ACCESS = new Set<Stripe.Subscription.Status>([
  "canceled",
  "unpaid",
  "incomplete_expired",
]);

async function getProfileEmail(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[stripe-webhook] optional email lookup failed", { code: error.code });
    return null;
  }

  const profile = data as Pick<ProfileRow, "email"> | null;

  return profile?.email ?? null;
}

async function getProfileByStripeCustomer(
  supabaseAdmin: SupabaseAdminClient,
  customerId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("email,subscription_status")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    console.error("[stripe-webhook] profile lookup failed", { code: error.code });
    throw new Error("Could not look up subscription");
  }
  return (data as ProfileRow | null) ?? null;
}

/** A Stripe event must not be acknowledged as successful if the entitlement
 * write failed. A non-2xx webhook response tells Stripe to retry delivery. */
async function writeProfileOrThrow(
  supabaseAdmin: SupabaseAdminClient,
  filter: "id" | "stripe_customer_id",
  value: string,
  changes: { subscription_status: string; stripe_customer_id?: string | null },
) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(changes)
    .eq(filter, value)
    .select("id");
  if (error || !data?.length) {
    console.error("[stripe-webhook] entitlement write failed", {
      code: error?.code ?? "profile_not_found",
    });
    throw new Error("Could not persist subscription status");
  }
}

async function sendEmailBestEffort(operation: () => Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    // Email delivery should not cause Stripe to replay a successful billing change.
    console.error("[stripe-webhook] subscription email failed", error instanceof Error ? error.name : "Unknown");
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!webhookSecret || !supabaseUrl || !serviceRole) {
    return NextResponse.json(
      { error: "Missing webhook environment variables" },
      { status: 500 },
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRole);

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  try {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const customerId =
      typeof session.customer === "string" ? session.customer : null;

    if (userId && customerId && session.mode === "subscription" && (session.payment_status === "paid" || session.payment_status === "no_payment_required")) {
      await writeProfileOrThrow(supabaseAdmin, "id", userId, {
        subscription_status: "basic",
        stripe_customer_id: customerId,
      });

      const email =
        session.customer_details?.email ??
        session.customer_email ??
        (await getProfileEmail(supabaseAdmin, userId));

      if (email) {
        await sendEmailBestEffort(() => sendCoreSubscriptionActivatedEmail(email));
      }
    }
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : null;

    if (customerId) {
      if (STRIPE_STATUSES_KEEPING_ACCESS.has(subscription.status)) {
        // Reinstate lapsed profiles — e.g. Stripe recovered a previously
        // failed payment, or a subscription resumed after being paused.
        // Profiles that already hold an active plan (including manually
        // granted tiers like "alpha") are left untouched so this event
        // never downgrades a plan name.
        const profile = await getProfileByStripeCustomer(
          supabaseAdmin,
          customerId,
        );

        if (profile && !hasActiveSubscription(profile.subscription_status)) {
          await writeProfileOrThrow(supabaseAdmin, "stripe_customer_id", customerId, {
            subscription_status: "basic",
          });
        }
      } else if (STRIPE_STATUSES_ENDING_ACCESS.has(subscription.status)) {
        await writeProfileOrThrow(supabaseAdmin, "stripe_customer_id", customerId, {
          subscription_status: "none",
        });
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : null;

    if (customerId) {
      const profile = await getProfileByStripeCustomer(
        supabaseAdmin,
        customerId,
      );

      await writeProfileOrThrow(supabaseAdmin, "stripe_customer_id", customerId, {
        subscription_status: "none",
      });

      const email = profile?.email;
      if (email) {
        await sendEmailBestEffort(() => sendSubscriptionCancelledEmail(email));
      }
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId =
      typeof invoice.customer === "string" ? invoice.customer : null;

    // Notify the customer but keep their access: Stripe retries failed
    // payments automatically and the subscription moves to "past_due".
    // If every retry fails, Stripe cancels the subscription and the
    // customer.subscription.deleted handler above removes access.
    if (customerId) {
      const profile = await getProfileByStripeCustomer(
        supabaseAdmin,
        customerId,
      );

      const email = profile?.email;
      if (email) {
        await sendEmailBestEffort(() => sendPaymentFailedEmail(email));
      }
    }
  }

  } catch (error) {
    console.error("[stripe-webhook] event processing failed", error instanceof Error ? error.name : "Unknown");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
