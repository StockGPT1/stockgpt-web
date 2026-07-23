import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  auditSecurityEvent,
  getClientIp,
  precheckRateLimit,
  rateKey,
  recordRateLimitAttempts,
  tooManyRequests,
} from "@/lib/security/rate-limit";
import { validateSignupPayload } from "@/lib/security/validation";
import { normaliseInternalRedirect } from "@/lib/auth/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_SIGNUP_MESSAGE =
  "If this email is eligible, check your inbox to continue.";

/* Same latency structure as the login route: one round-trip of
   rate-limit counts, then the Supabase signUp with attempt recording
   running concurrently, and audit writes deferred via after(). */
export async function POST(req: NextRequest) {
  const ipKey = rateKey(["signup-ip", getClientIp(req)]);

  const body = await req.json().catch(() => null);
  const validated = validateSignupPayload(body);
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const next = normaliseInternalRedirect(record.next);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;

  if (!validated.ok) {
    /* Invalid payloads still count against the IP limit so a client
       can't probe the validator without ever being throttled. */
    const ipLimit = await precheckRateLimit({
      action: "signup_ip",
      key: ipKey,
      limit: 5,
      windowSeconds: 60 * 60,
    });

    if (!ipLimit.allowed) {
      return tooManyRequests(ipLimit.retryAfterSeconds);
    }

    after(() =>
      Promise.all([
        recordRateLimitAttempts([{ action: "signup_ip", key: ipKey }]),
        auditSecurityEvent({
          req,
          eventType: "signup_validation_failed",
          metadata: { reason: validated.message },
        }),
      ]),
    );

    return NextResponse.json({ error: validated.message }, { status: 400 });
  }

  const emailKey = rateKey(["signup-email", validated.data.email]);

  const [ipLimit, emailLimit] = await Promise.all([
    precheckRateLimit({
      action: "signup_ip",
      key: ipKey,
      limit: 5,
      windowSeconds: 60 * 60,
    }),
    precheckRateLimit({
      action: "signup_email",
      key: emailKey,
      limit: 3,
      windowSeconds: 24 * 60 * 60,
    }),
  ]);

  if (!ipLimit.allowed) {
    return tooManyRequests(ipLimit.retryAfterSeconds);
  }

  if (!emailLimit.allowed) {
    return tooManyRequests(emailLimit.retryAfterSeconds);
  }

  const supabase = await createClient();

  const [{ error }] = await Promise.all([
    supabase.auth.signUp({
      email: validated.data.email,
      password: validated.data.password,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
        data: {
          first_name: validated.data.firstName,
          last_name: validated.data.lastName,
          full_name: validated.data.fullName,
          date_of_birth: validated.data.dob,
          marketing_consent: validated.data.marketingConsent,
          email_consent: validated.data.emailConsent,
          terms_accepted: validated.data.termsAccepted,
          newsletter_digest_consent: validated.data.newsletterDigestConsent,
          consent_captured_at: validated.data.consentCapturedAt,
        },
      },
    }),
    recordRateLimitAttempts([
      { action: "signup_ip", key: ipKey },
      { action: "signup_email", key: emailKey },
    ]),
  ]);

  if (error) {
    after(() =>
      auditSecurityEvent({
        req,
        eventType: "signup_supabase_error",
        metadata: {
          code: error.code ?? null,
          status: error.status ?? null,
        },
      }),
    );

    // Do not reveal whether the email already exists.
    return NextResponse.json({
      ok: true,
      message: GENERIC_SIGNUP_MESSAGE,
    });
  }

  after(() =>
    auditSecurityEvent({
      req,
      eventType: "signup_requested",
      metadata: {
        email_hash: emailKey,
        marketing_consent: validated.data.marketingConsent,
        email_consent: validated.data.emailConsent,
        terms_accepted: validated.data.termsAccepted,
        newsletter_digest_consent: validated.data.newsletterDigestConsent,
      },
    }),
  );

  return NextResponse.json({
    ok: true,
    message: GENERIC_SIGNUP_MESSAGE,
  });
}
