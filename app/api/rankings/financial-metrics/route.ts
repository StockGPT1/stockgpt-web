import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
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

async function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (url && serviceKey) {
    return createSupabaseClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as SupabaseClient;
  }
  return createServerSupabaseClient();
}

async function getDiagnostics(ticker: string) {
  try {
    const supabase = await getSupabaseClient();
    const variants = tickerVariants(ticker);
    const { data, error } = await supabase
      .from("stock_factor_diagnostics")
      .select("ticker,diagnosis,factor_contributions,top_positive_factors,top_negative_factors,quality_score,growth_score,value_score,momentum_score,risk_score,income_score,factor_coverage,updated_at")
      .in("ticker", variants)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) return null;
    return Array.isArray(data) ? data[0] ?? null : data ?? null;
  } catch {
    return null;
  }
}

async function getRankingRow(ticker: string) {
  try {
    const supabase = await getSupabaseClient();
    const variants = tickerVariants(ticker);
    const { data, error } = await supabase
      .from("stock_rankings")
      .select("ticker,rank,score,price,momentum,pe,risk,factor_coverage,data_confidence,updated_at")
      .in("ticker", variants)
      .limit(1);

    if (error) return null;
    return Array.isArray(data) ? data[0] ?? null : data ?? null;
  } catch {
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
    getDiagnostics(ticker),
    getRankingRow(ticker),
  ]);

  return NextResponse.json({ metrics, diagnostics, ranking });
}
