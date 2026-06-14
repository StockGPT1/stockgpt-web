import { NextRequest, NextResponse } from "next/server";
import { getFinancialMetricMap } from "@/lib/yahoo-financials";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanTicker(value: string | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

async function getDiagnostics(ticker: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("stock_factor_diagnostics")
      .select("ticker,diagnosis,factor_contributions,top_positive_factors,top_negative_factors,quality_score,growth_score,value_score,momentum_score,risk_score,income_score,factor_coverage,data_confidence,updated_at")
      .eq("ticker", ticker)
      .maybeSingle();

    if (error) return null;
    return data ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const ticker = cleanTicker(req.nextUrl.searchParams.get("ticker"));
  if (!ticker) {
    return NextResponse.json({ metrics: null, diagnostics: null, reason: "Missing ticker." }, { status: 400 });
  }

  const [metrics, diagnostics] = await Promise.all([
    getFinancialMetricMap([ticker]).then((map) => map.get(ticker) ?? null),
    getDiagnostics(ticker),
  ]);

  return NextResponse.json({ metrics, diagnostics });
}
