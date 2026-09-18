import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFinancialMetricMap } from "@/lib/yahoo-financials";
import { createClient as createServerSupabaseClient } from "@/utils/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanTicker(value: string | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

function tickerVariants(ticker: string) {
  return Array.from(new Set([ticker, ticker.replace(/-/g, "."), ticker.replace(/\./g, "-")].map(cleanTicker).filter(Boolean)));
}

async function getDiagnostics(ticker: string, supabase: SupabaseClient) {
  try {
    const variants = tickerVariants(ticker);
    const { data, error } = await supabase
      .from("stock_factor_diagnostics")
      .select("ticker,diagnosis,factor_contributions,top_positive_factors,top_negative_factors,quality_score,growth_score,value_score,momentum_score,risk_score,income_score,factor_coverage,updated_at")
      .in("ticker", variants)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.warn("[rankings] factor diagnostics read failed", { ticker, message: error.message });
      return null;
    }
    return Array.isArray(data) ? data[0] ?? null : data ?? null;
  } catch (error) {
    console.warn("[rankings] factor diagnostics read threw", {
      ticker,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function getRankingRow(ticker: string, supabase: SupabaseClient) {
  try {
    const variants = tickerVariants(ticker);
    const { data, error } = await supabase
      .from("stock_rankings")
      .select("ticker,rank,score,price,momentum,pe,risk,factor_coverage,data_confidence,updated_at")
      .in("ticker", variants)
      .limit(1);

    if (error) {
      console.warn("[rankings] ranking detail read failed", { ticker, message: error.message });
      return null;
    }
    return Array.isArray(data) ? data[0] ?? null : data ?? null;
  } catch (error) {
    console.warn("[rankings] ranking detail read threw", {
      ticker,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function GET(req: NextRequest) {
  const authClient = await createServerSupabaseClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { data: profile } = await authClient
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .maybeSingle();
  if (!hasActiveSubscription(profile?.subscription_status)) {
    return NextResponse.json({ error: "Active subscription required." }, { status: 403 });
  }

  const ticker = cleanTicker(req.nextUrl.searchParams.get("ticker"));
  if (!ticker) {
    return NextResponse.json({ metrics: null, diagnostics: null, ranking: null, reason: "Missing ticker." }, { status: 400 });
  }

  const [metrics, diagnostics, ranking] = await Promise.all([
    getFinancialMetricMap([ticker]).then((map) => map.get(ticker) ?? null),
    getDiagnostics(ticker, authClient),
    getRankingRow(ticker, authClient),
  ]);

  return NextResponse.json({ metrics, diagnostics, ranking });
}
