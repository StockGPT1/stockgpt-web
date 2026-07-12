import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import { getStableRankingsPage } from "@/lib/stable-rankings";
import { getOneDayMoveMap } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

function clean(value: string | null, max = 80) {
  return String(value ?? "").trim().slice(0, max);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("subscription_status").eq("id", user.id).maybeSingle();
  if (!hasActiveSubscription(profile?.subscription_status)) return NextResponse.json({ error: "Active subscription required." }, { status: 403 });

  const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const limit = 50;
  const result = await getStableRankingsPage(supabase, {
    limit,
    offset: (page - 1) * limit,
    q: clean(request.nextUrl.searchParams.get("q")),
    sector: clean(request.nextUrl.searchParams.get("sector")) || "all",
    scoreFilter: clean(request.nextUrl.searchParams.get("score")) || "all",
  });
  const tickers = result.rows.map((row) => row.ticker).filter((ticker): ticker is string => Boolean(ticker));
  const moves = await getOneDayMoveMap(tickers);
  return NextResponse.json({
    rows: result.rows,
    dailyMoves: Object.fromEntries(tickers.map((ticker) => [ticker, moves.get(ticker)?.changePct ?? null])),
    page,
    total: result.total,
    totalPages: Math.max(1, Math.ceil(result.total / limit)),
  }, { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=60" } });
}
