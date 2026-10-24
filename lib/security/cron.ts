import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export function isAuthorizedCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization");
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(authorization);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function unauthorizedCron() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
