import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  sendCoreSubscriptionActivatedEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCancelledEmail,
} from "@/lib/transactional-email";

type ProfileEmailRow = {
  email: string | null;
};

async function getProfileEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  const profile = data as ProfileEmailRow | null;

  return profile?.email ?? null;
}

async function getProfileEmailByStripeCustomer(
  supabaseAdmin: ReturnType<typeof createClient>,
  customerId: string,
) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  const profile = data as ProfileEmailRow | null;

  return profile?.email ?? null;
}

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceRole) {
    return NextResponse.json(
      { error: "Missing webhook environment variables" },
      { status: 500 },
    );
  }

  const stripe = new Stripe(stripeKey);
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const customerId =
      typeof session.customer === "string" ? session.customer : null;

    if (userId) {
      await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: "basic",
          stripe_customer_id: customerId,
        })
        .eq("id", userId);

      const email =
        session.customer_details?.email ??
        session.customer_email ??
        (await getProfileEmail(supabaseAdmin, userId));

      if (email) {
        await sendCoreSubscriptionActivatedEmail(email);
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : null;

    if (customerId) {
      const email = await getProfileEmailByStripeCustomer(
        supabaseAdmin,
        customerId,
      );

      await supabaseAdmin
        .from("profiles")
        .update({ subscription_status: "none" })
        .eq("stripe_customer_id", customerId);

      if (email) {
        await sendSubscriptionCancelledEmail(email);
      }
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId =
      typeof invoice.customer === "string" ? invoice.customer : null;

    if (customerId) {
      const email = await getProfileEmailByStripeCustomer(
        supabaseAdmin,
        customerId,
      );

      await supabaseAdmin
        .from("profiles")
        .update({ subscription_status: "none" })
        .eq("stripe_customer_id", customerId);

      if (email) {
        await sendPaymentFailedEmail(email);
      }
    }
  }

  return NextResponse.json({ received: true });
}
