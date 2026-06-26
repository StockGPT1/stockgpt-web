import { NextRequest, NextResponse } from "next/server";
import { getDataFreshness, getStaleFreshnessItems } from "@/lib/data-freshness";
import { sendDataFreshnessAlertEmail } from "@/lib/founder-alerts";
import { createAdminClient } from "@/utils/supabase/admin";
import { isAuthorizedCron, unauthorizedCron } from "@/lib/security/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return unauthorizedCron();

  try {
    const admin = createAdminClient();
    const freshness = await getDataFreshness(admin);
    const staleItems = getStaleFreshnessItems(freshness);

    if (staleItems.length > 0) {
      await sendDataFreshnessAlertEmail({ freshness, staleItems });
    }

    return NextResponse.json({
      ok: true,
      stale: staleItems.length > 0,
      emailed: staleItems.length > 0,
      freshness,
    });
  } catch (error) {
    console.error("[data-freshness] check failed", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected data freshness check failure.",
      },
      { status: 500 },
    );
  }
}