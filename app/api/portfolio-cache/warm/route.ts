import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron, unauthorizedCron } from "@/lib/security/cron";

export const dynamic = "force-dynamic";

/**
 * Retained temporarily so an already-configured scheduler receives a harmless
 * response. The former whole-page snapshot warmer had no Portfolio-page read
 * consumer and is not part of the Stage 05 authoritative chart path.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return unauthorizedCron();

  return NextResponse.json({
    ok: true,
    retired: true,
    cache: "portfolio_page_snapshots",
  });
}
