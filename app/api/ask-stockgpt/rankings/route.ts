import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import { getStableRankings, type StableRankingRow } from "@/lib/stable-rankings";

export const dynamic = "force-dynamic";

type RankingRow = StableRankingRow;

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanSearch(value: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9 .&-]/g, "")
    .slice(0, 48);
}

function cleanLimit(value: string | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 25;
  return Math.min(Math.max(Math.trunc(n), 1), 50);
}

function cleanOffset(value: string | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(Math.trunc(n), 0);
}

function confidenceFromScore(score: number | null): "High" | "Medium" | "Developing" {
  if (score === null) return "Developing";
  if (score >= 7000) return "High";
  if (score >= 4500) return "Medium";
  return "Developing";
}

function compactRanking(row: RankingRow) {
  const rank = toNumber(row.rank);
  const previousRank = toNumber(row.previous_rank);
  const score = toNumber(row.score);

  return {
    rank,
    previous_rank: previousRank,
    ticker: String(row.ticker ?? "").trim().toUpperCase(),
    company: row.company ?? null,
    sector: row.sector ?? null,
    score,
    price: toNumber(row.price),
    updated_at: row.updated_at ?? null,
    confidence: confidenceFromScore(score),
    rank_move:
      rank !== null && previousRank !== null ? previousRank - rank : null,
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Login required.", rankings: [] }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!hasActiveSubscription(profile?.subscription_status)) {
    return NextResponse.json({ error: "Active subscription required.", rankings: [] }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = cleanLimit(searchParams.get("limit"));
  const offset = cleanOffset(searchParams.get("offset"));
  const search = cleanSearch(searchParams.get("search"));

  try {
    const stableRows = await getStableRankings(supabase);
    const filteredRows = stableRows.filter((row) => {
      if (!search) return true;

      const ticker = String(row.ticker ?? "").toLowerCase();
      const company = String(row.company ?? "").toLowerCase();
      const term = search.toLowerCase();

      return ticker.includes(term) || company.includes(term);
    });

    const pagedRows = filteredRows.slice(offset, offset + limit);
    const rankings = pagedRows
      .map(compactRanking)
      .filter((row) => row.ticker.length > 0);
    const nextOffset = offset + rankings.length;

    return NextResponse.json({
      rankings,
      limit,
      offset,
      next_offset: nextOffset,
      has_more: nextOffset < filteredRows.length,
      total: filteredRows.length,
      data_as_of:
        rankings.map((row) => row.updated_at).find(Boolean) ?? new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ask-stockgpt-rankings] Could not load stable rankings", error);
    return NextResponse.json(
      { error: "Could not load StockGPT rankings.", rankings: [] },
      { status: 500 },
    );
  }
}
