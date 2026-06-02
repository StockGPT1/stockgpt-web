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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, a reset link has been sent.";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const email = cleanEmail(record.email);

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ message: GENERIC_RESET_MESSAGE });
  }

  const ipKey = rateKey(["forgot-ip", getClientIp(req)]);
  const emailKey = rateKey(["forgot-email", email]);

  const [ipLimit, emailLimit] = await Promise.all([
    checkRateLimit({
      action: "forgot_password_ip",
      key: ipKey,
      limit: 10,
      windowSeconds: 60 * 60,
    }),
    checkRateLimit({
      action: "forgot_password_email",
      key: emailKey,
      limit: 3,
      windowSeconds: 60 * 60,
    }),
  ]);

  if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfterSeconds);
  if (!emailLimit.allowed) return tooManyRequests(emailLimit.retryAfterSeconds);

  const supabase = await createClient();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://stockgpt.pro/update-password",
  });

  await auditSecurityEvent({
    req,
    eventType: "password_reset_requested",
    metadata: { email_hash: emailKey },
  });

  return NextResponse.json({ message: GENERIC_RESET_MESSAGE });
}
