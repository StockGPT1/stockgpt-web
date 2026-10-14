import { NextRequest, NextResponse } from "next/server";
import { getFinancialMetricMap, getFundamentalSnapshots } from "@/lib/yahoo-financials";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanTicker(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

export async function GET(req: NextRequest) {
  const ticker = cleanTicker(req.nextUrl.searchParams.get("ticker"));
  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker" }, { status: 400 });
  }

  // Use the caller's session: RLS controls access to premium stored data.
  // Anonymous callers retain the existing public quote/chart fallback.
  const supabase = await createClient();
  const snapshots = await getFundamentalSnapshots([ticker], supabase);
  const metrics = (await getFinancialMetricMap([ticker], snapshots)).get(ticker) ?? null;
  return NextResponse.json({ ticker, metrics });
}
