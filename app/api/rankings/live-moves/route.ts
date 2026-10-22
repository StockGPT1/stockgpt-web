import { NextRequest, NextResponse } from "next/server";
import { getServerViewer } from "@/lib/server-viewer";
import { hasActiveSubscription } from "@/lib/subscription";
import { getOneDayMoveMap } from "@/lib/yahoo";
import { parseRankingLiveQuotes, rankingQuoteTickers } from "@/lib/rankings-live-moves";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { supabase, user } = await getServerViewer();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("subscription_status").eq("id", user.id).maybeSingle();
  if (!hasActiveSubscription(profile?.subscription_status)) return NextResponse.json({ error: "Active subscription required." }, { status: 403 });
  const tickers = rankingQuoteTickers((request.nextUrl.searchParams.get("tickers") ?? "").split(","));
  if (!tickers.length) return NextResponse.json({ quotes: {} });
  const moves = await getOneDayMoveMap(tickers);
  const quotes = parseRankingLiveQuotes(Object.fromEntries(moves), tickers);
  return NextResponse.json({ quotes }, { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=60" } });
}
