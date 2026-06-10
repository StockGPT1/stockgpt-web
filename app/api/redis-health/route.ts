import { NextResponse, type NextRequest } from "next/server";
import { checkRedisHealth } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return (req.headers.get("authorization") ?? "") === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await checkRedisHealth();

  return NextResponse.json({
    ok: health.ok,
    configured: health.configured,
    disabledBeforeCheck: health.disabled,
    ping: health.ping,
    set: health.set,
    get: health.get,
    del: health.del,
    latencyMs: health.latencyMs,
    error: health.error,
  });
}
