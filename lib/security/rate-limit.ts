import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

type RateLimitOptions = {
  action: string;
  key: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

const FALLBACK_SALT = "stockgpt-rate-limit-v1";

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function getClientIp(req: NextRequest | Request) {
  const headers = req.headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function getUserAgent(req: NextRequest | Request) {
  return req.headers.get("user-agent") || "unknown";
}

export function rateKey(parts: Array<string | null | undefined>) {
  const salt = process.env.RATE_LIMIT_SALT || FALLBACK_SALT;
  return sha256(`${salt}:${parts.filter(Boolean).join(":")}`);
}

export async function checkRateLimit({
  action,
  key,
  limit,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error } = await admin
    .from("security_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("action", action)
    .eq("key", key)
    .gte("created_at", since);

  if (error) {
    console.error("[rate-limit] count failed", {
      action,
      message: error.message,
    });

    // Fail closed for auth routes. Fail open only if you intentionally choose to.
    return { allowed: false, retryAfterSeconds: 60 };
  }

  const used = count ?? 0;

  if (used >= limit) {
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }

  const { error: insertError } = await admin.from("security_rate_limits").insert({
    action,
    key,
    success: true,
  });

  if (insertError) {
    console.error("[rate-limit] insert failed", {
      action,
      message: insertError.message,
    });

    return { allowed: false, retryAfterSeconds: 60 };
  }

  return { allowed: true, remaining: Math.max(0, limit - used - 1) };
}

/**
 * Latency-optimised two-phase variant of checkRateLimit for hot auth
 * routes: precheckRateLimit does the count only, so the caller can run
 * recordRateLimitAttempts concurrently with the actual auth call
 * instead of paying two more sequential round-trips. Semantics match
 * checkRateLimit: counts fail closed, attempts are only recorded when
 * the request was allowed.
 */
export async function precheckRateLimit({
  action,
  key,
  limit,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error } = await admin
    .from("security_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("action", action)
    .eq("key", key)
    .gte("created_at", since);

  if (error) {
    console.error("[rate-limit] count failed", {
      action,
      message: error.message,
    });

    return { allowed: false, retryAfterSeconds: 60 };
  }

  const used = count ?? 0;

  if (used >= limit) {
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }

  return { allowed: true, remaining: Math.max(0, limit - used - 1) };
}

export async function recordRateLimitAttempts(
  attempts: Array<{ action: string; key: string }>,
) {
  const admin = createAdminClient();

  const { error } = await admin
    .from("security_rate_limits")
    .insert(attempts.map(({ action, key }) => ({ action, key, success: true })));

  if (error) {
    /* Recording runs concurrently with the auth call, so by the time an
       insert failure surfaces the attempt has already been made — fail
       open here. A DB outage still fails closed at precheck time. */
    console.error("[rate-limit] record failed", { message: error.message });
  }
}

export function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: "Too many attempts. Please wait and try again.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

export async function auditSecurityEvent({
  req,
  eventType,
  userId = null,
  metadata = {},
}: {
  req: NextRequest | Request;
  eventType: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();

    await admin.from("security_audit_events").insert({
      user_id: userId,
      event_type: eventType,
      ip_hash: rateKey(["ip", getClientIp(req)]),
      user_agent_hash: rateKey(["ua", getUserAgent(req)]),
      metadata,
    });
  } catch (error) {
    console.warn("[security-audit] failed", error);
  }
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
