import { NextRequest, NextResponse } from "next/server";

export function isAuthorizedCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export function unauthorizedCron() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
