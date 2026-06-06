import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";

type Profile = {
  stripe_customer_id: string | null;
};

type BillingErrorCode =
  | "stripe_not_configured"
  | "stripe_customer_mismatch"
  | "portal_not_configured"
  | "portal_failed";

function redirectWithError(request: Request, code: BillingErrorCode) {
  const url = new URL("/subscription", request.url);
  url.searchParams.set("billing_error", code);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    return redirectWithError(request, "stripe_not_configured");
  }

  const stripe = new Stripe(stripeKey);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), {
      status: 303,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const typedProfile = profile as Profile | null;
  const customerId = typedProfile?.stripe_customer_id;

  if (!customerId) {
    return NextResponse.redirect(new URL("/pricing", request.url), {
      status: 303,
    });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stockgpt.pro";

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/subscription`,
    });

    return NextResponse.redirect(portalSession.url, {
      status: 303,
    });
  } catch (error) {
    console.error("Stripe billing portal error", error);

    const stripeError = error as { message?: string; code?: string; type?: string };
    const message = stripeError.message?.toLowerCase() ?? "";

    if (message.includes("no such customer") || message.includes("customer")) {
      return redirectWithError(request, "stripe_customer_mismatch");
    }

    if (message.includes("configuration") || message.includes("portal")) {
      return redirectWithError(request, "portal_not_configured");
    }

    return redirectWithError(request, "portal_failed");
  }
}
