import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { stripe } from "@/lib/stripe";

type Profile = {
  stripe_customer_id: string | null;
};

function redirectToSubscriptionError(request: Request, message: string) {
  const url = new URL("/subscription", request.url);
  url.searchParams.set("billing_error", message);
  return NextResponse.redirect(url, { status: 303 });
}

function redirectToPricing(request: Request) {
  const url = new URL("/pricing", request.url);
  url.searchParams.set("feature", "billing");
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
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
    return redirectToPricing(request);
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

    if (
      message.includes("no such customer") ||
      message.includes("customer") ||
      message.includes("configuration") ||
      message.includes("portal")
    ) {
      return redirectToPricing(request);
    }

    return redirectToSubscriptionError(
      request,
      "Stripe could not open the billing portal. Please try again or contact support.",
    );
  }
}
