import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  auditSecurityEvent,
  checkRateLimit,
  getClientIp,
  rateKey,
  tooManyRequests,
} from "@/lib/security/rate-limit";
import { cleanEmail, isValidEmail } from "@/lib/security/validation";
import { normaliseInternalRedirect } from "@/lib/auth/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const email = cleanEmail(record.email);
  const password = typeof record.password === "string" ? record.password : "";
  const redirectTo = normaliseInternalRedirect(record.next);

  if (!email || !password || !isValidEmail(email)) {
    await auditSecurityEvent({
      req,
      eventType: "login_validation_failed",
    });

    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 400 },
    );
  }

  const ipKey = rateKey(["login-ip", getClientIp(req)]);
  const emailKey = rateKey(["login-email", email]);

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

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    await auditSecurityEvent({
      req,
      eventType: "login_failed",
      metadata: { email_hash: emailKey },
    });

    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );
  }

  await auditSecurityEvent({
    req,
    eventType: "login_success",
    userId: data.user.id,
    metadata: { email_hash: emailKey },
  });

  return NextResponse.json({ ok: true, redirectTo });
}
