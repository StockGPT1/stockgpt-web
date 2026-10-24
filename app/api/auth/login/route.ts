import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  auditSecurityEvent,
  getClientIp,
  checkRateLimit,
  rateKey,
  tooManyRequests,
} from "@/lib/security/rate-limit";
import { cleanEmail, isValidEmail } from "@/lib/security/validation";
import { normaliseInternalRedirect } from "@/lib/auth/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Concurrent login requests consume rate-limit slots atomically before
   calling Supabase auth. Local development skips the DB-backed limiter
   for iPhone tunnel testing; Supabase's own auth limits still apply. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const email = cleanEmail(record.email);
  const password = typeof record.password === "string" ? record.password : "";
  const redirectTo = normaliseInternalRedirect(record.next);
  const isDevelopment = process.env.NODE_ENV === "development";

  if (!email || !password || !isValidEmail(email)) {
    if (!isDevelopment) {
      after(() =>
        auditSecurityEvent({
          req,
          eventType: "login_validation_failed",
        }),
      );
    }

    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 400 },
    );
  }

  const ipKey = rateKey(["login-ip", getClientIp(req)]);
  const emailKey = rateKey(["login-email", email]);

  if (!isDevelopment) {
    const [ipLimit, emailLimit] = await Promise.all([
      checkRateLimit({
        action: "login_ip",
        key: ipKey,
        limit: 20,
        windowSeconds: 15 * 60,
      }),
      checkRateLimit({
        action: "login_email",
        key: emailKey,
        limit: 5,
        windowSeconds: 15 * 60,
      }),
    ]);

    if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfterSeconds);
    if (!emailLimit.allowed) return tooManyRequests(emailLimit.retryAfterSeconds);
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    if (!isDevelopment) {
      after(() =>
        auditSecurityEvent({
          req,
          eventType: "login_failed",
          metadata: { email_hash: emailKey },
        }),
      );
    }

    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );
  }

  const userId = data.user.id;

  if (!isDevelopment) {
    after(() =>
      auditSecurityEvent({
        req,
        eventType: "login_success",
        userId,
        metadata: { email_hash: emailKey },
      }),
    );
  }

  return NextResponse.json({ ok: true, redirectTo });
}
