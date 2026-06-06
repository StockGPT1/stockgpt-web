import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";

const LEGAL_VERSION = "2026-05-17";

type BillingPlan = "monthly" | "annual";

function getTrialPeriodDays() {
  const rawValue = process.env.STRIPE_CORE_TRIAL_DAYS;

  if (!rawValue) return undefined;

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("STRIPE_CORE_TRIAL_DAYS must be a positive whole number");
  }

  return value;
}

function normaliseBillingPlan(value: FormDataEntryValue | null): BillingPlan {
  return value === "annual" ? "annual" : "monthly";
}

function getPriceId(plan: BillingPlan) {
  if (plan === "annual") {
    const annualPriceId = process.env.STRIPE_CORE_ANNUAL_PRICE_ID;

    if (!annualPriceId) {
      throw new Error("Missing STRIPE_CORE_ANNUAL_PRICE_ID");
    }

    return annualPriceId;
  }

  const monthlyPriceId =
    process.env.STRIPE_CORE_MONTHLY_PRICE_ID ??
    process.env.STRIPE_CORE_PRICE_ID ??
    process.env.STRIPE_BASIC_PRICE_ID;

  if (!monthlyPriceId) {
    throw new Error(
      "Missing STRIPE_CORE_MONTHLY_PRICE_ID, STRIPE_CORE_PRICE_ID or STRIPE_BASIC_PRICE_ID",
    );
  }

  return monthlyPriceId;
}

async function createCheckoutSession(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  const formData = await request.formData();
  const plan = normaliseBillingPlan(formData.get("plan"));
  const legalAcknowledgement = String(
    formData.get("legal_acknowledgement") ?? "",
  );

  if (legalAcknowledgement !== "accepted") {
    return NextResponse.redirect(
      new URL(`/checkout/confirm?plan=${plan}&legal=missing`, request.url),
      { status: 303 },
    );
  }

  const priceId = getPriceId(plan);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stockgpt.pro";
  const trialPeriodDays = getTrialPeriodDays();
  const endorselyReferral = String(formData.get("endorsely_referral") ?? "");

  const stripe = new Stripe(key);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.redirect(new URL("/login", request.url), {
      status: 303,
    });
  }

  const legalMetadata = {
    user_id: user.id,
    plan: `core_${plan}`,
    billing_interval: plan,
    endorsely_referral: endorselyReferral,
    legal_version: LEGAL_VERSION,
    legal_acknowledgement: "research_software",
    legal_acknowledged_at: new Date().toISOString(),
    terms_url: `${siteUrl}/legal#terms`,
    subscription_terms_url: `${siteUrl}/legal#subscription`,
    privacy_url: `${siteUrl}/legal#privacy`,
    disclaimer_url: `${siteUrl}/legal#disclaimer`,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    allow_promotion_codes: true,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: legalMetadata,
    subscription_data: {
      ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
      metadata: legalMetadata,
    },
    success_url: `${siteUrl}/account?success=true`,
    cancel_url: `${siteUrl}/pricing`,
  });

  return NextResponse.redirect(session.url!, {
    status: 303,
  });
}

export async function POST(request: Request) {
  return createCheckoutSession(request);
}
