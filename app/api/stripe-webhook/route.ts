import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;

    if (userId) {
      await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: "basic",
          stripe_customer_id: session.customer as string,
        })
        .eq("id", userId);
    }
  }

  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "invoice.payment_failed"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    await supabaseAdmin
      .from("profiles")
      .update({ subscription_status: "none" })
      .eq("stripe_customer_id", customerId);
  }

  return NextResponse.json({ received: true });
}