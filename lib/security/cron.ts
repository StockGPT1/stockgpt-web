import { NextRequest, NextResponse } from "next/server";

/**
 * Returns true only when CRON_SECRET is set AND the request carries the
 * matching Bearer token.  Deliberately fails-closed: if the secret env var
 * is absent the route is unreachable, preventing accidental open access on
 * misconfigured deployments.
 */
export function isAuthorizedCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error(
      "[cron-auth] CRON_SECRET is not set — rejecting request. " +
        "Set CRON_SECRET in your environment variables.",
    );
    return false;
  }

  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export function unauthorizedCron() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
