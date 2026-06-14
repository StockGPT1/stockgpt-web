import { NextRequest, NextResponse } from "next/server";
import { getFinancialMetricMap } from "@/lib/yahoo-financials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanTicker(value: string | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

export async function GET(req: NextRequest) {
  const ticker = cleanTicker(req.nextUrl.searchParams.get("ticker"));
  if (!ticker) {
    return NextResponse.json({ metrics: null, reason: "Missing ticker." }, { status: 400 });
  }

  const metrics = (await getFinancialMetricMap([ticker])).get(ticker) ?? null;
  return NextResponse.json({ metrics });
}
