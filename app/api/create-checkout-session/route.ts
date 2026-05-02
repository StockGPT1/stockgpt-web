import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  const stripe = new Stripe(key);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    line_items: [
      {
        price: process.env.STRIPE_BASIC_PRICE_ID!,
        quantity: 1,
      },
    ],
    metadata: {
      user_id: user.id,
    },
    success_url: `${siteUrl}/account?success=true`,
    cancel_url: `${siteUrl}/pricing`,
  });

  return NextResponse.redirect(session.url!, 303);
}