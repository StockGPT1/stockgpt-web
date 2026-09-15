import { NextRequest, NextResponse } from "next/server";
import { runBoundedBrokerSyncWorker } from "@/lib/brokerage/sync-worker";
import { isAuthorizedCron, unauthorizedCron } from "@/lib/security/cron";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return unauthorizedCron();
  try {
    const result = await runBoundedBrokerSyncWorker(createAdminClient());
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Broker sync worker unavailable" }, { status: 503 });
  }
}
