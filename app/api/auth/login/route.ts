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
import { cleanEmail, isValidEmail } from "@/lib/security/validation";
import { normaliseInternalRedirect } from "@/lib/auth/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Login latency is the whole product experience for returning users, so
   this route keeps the Supabase round-trips down to two sequential
   phases in production. Local development skips StockGPT's DB-backed
   limiter entirely so iPhone tunnel testing does not require the
   production service-role secret. Supabase's own auth limits still apply. */
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
      precheckRateLimit({
        action: "login_ip",
        key: ipKey,
        limit: 20,
        windowSeconds: 15 * 60,
      }),
      precheckRateLimit({
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

  const authPromise = supabase.auth.signInWithPassword({
    email,
    password,
  });

  const { data, error } = isDevelopment
    ? await authPromise
    : (
        await Promise.all([
          authPromise,
          recordRateLimitAttempts([
            { action: "login_ip", key: ipKey },
            { action: "login_email", key: emailKey },
          ]),
        ])
      )[0];

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
