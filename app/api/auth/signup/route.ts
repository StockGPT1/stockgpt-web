import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  auditSecurityEvent,
  checkRateLimit,
  getClientIp,
  rateKey,
  tooManyRequests,
} from "@/lib/security/rate-limit";
import { validateSignupPayload } from "@/lib/security/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_SIGNUP_MESSAGE =
  "If this email is eligible, check your inbox to continue.";

export async function POST(req: NextRequest) {
  const ipKey = rateKey(["signup-ip", getClientIp(req)]);
  const ipLimit = await checkRateLimit({
    action: "signup_ip",
    key: ipKey,
    limit: 5,
    windowSeconds: 60 * 60,
  });

  if (!ipLimit.allowed) {
    return tooManyRequests(ipLimit.retryAfterSeconds);
  }

  const body = await req.json().catch(() => null);
  const validated = validateSignupPayload(body);

  if (!validated.ok) {
    await auditSecurityEvent({
      req,
      eventType: "signup_validation_failed",
      metadata: { reason: validated.message },
    });

    return NextResponse.json({ error: validated.message }, { status: 400 });
  }

  const emailKey = rateKey(["signup-email", validated.data.email]);
  const emailLimit = await checkRateLimit({
    action: "signup_email",
    key: emailKey,
    limit: 3,
    windowSeconds: 24 * 60 * 60,
  });

  if (!emailLimit.allowed) {
    return tooManyRequests(emailLimit.retryAfterSeconds);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: validated.data.email,
    password: validated.data.password,
    options: {
      emailRedirectTo: "https://stockgpt.pro/auth/callback?next=/dashboard",
      data: {
        first_name: validated.data.firstName,
        last_name: validated.data.lastName,
        full_name: validated.data.fullName,
        date_of_birth: validated.data.dob,
        phone: validated.data.phone,
      },
    },
  });

  if (error) {
    await auditSecurityEvent({
      req,
      eventType: "signup_supabase_error",
      metadata: {
        code: error.code ?? null,
        status: error.status ?? null,
      },
    });

    // Do not reveal whether the email already exists.
    return NextResponse.json({
      ok: true,
      message: GENERIC_SIGNUP_MESSAGE,
    });
  }

  await auditSecurityEvent({
    req,
    eventType: "signup_requested",
    metadata: { email_hash: emailKey },
  });

  return NextResponse.json({
    ok: true,
    message: GENERIC_SIGNUP_MESSAGE,
  });
}
