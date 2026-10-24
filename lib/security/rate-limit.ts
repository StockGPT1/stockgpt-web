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

/** Atomically count and consume a request slot in Supabase.
 * Requires the 20261024152100_atomic_security_rate_limit.sql migration before deployment.
 */
export async function checkRateLimit({
  action,
  key,
  limit,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("consume_security_rate_limit", {
      p_action: action,
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    }).single();

    if (error || !data) {
      console.error("[rate-limit] atomic consume failed", {
        action,
        message: error?.message ?? "No database response",
      });
      return { allowed: false, retryAfterSeconds: 60 };
    }

    const result = data as {
      allowed: boolean;
      remaining: number;
      retry_after_seconds: number;
    };
    return result.allowed
      ? { allowed: true, remaining: result.remaining }
      : { allowed: false, retryAfterSeconds: result.retry_after_seconds };
  } catch (error) {
    console.error("[rate-limit] atomic consume unavailable", {
      action,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return { allowed: false, retryAfterSeconds: 60 };
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
