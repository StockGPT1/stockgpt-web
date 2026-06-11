import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";

export const dynamic = "force-dynamic";

type RankingRow = {
  rank: number | null;
  previous_rank: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
  updated_at: string | null;
};

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
    updated_at: row.updated_at,
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

  let query = supabase
    .from("stock_rankings")
    .select("rank,previous_rank,ticker,company,sector,score,price,updated_at", {
      count: "exact",
    })
    .order("rank", { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`ticker.ilike.%${search}%,company.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[ask-stockgpt-rankings] Could not load rankings", error);
    return NextResponse.json(
      { error: "Could not load StockGPT rankings.", rankings: [] },
      { status: 500 },
    );
  }

  const rankings = ((data ?? []) as RankingRow[])
    .map(compactRanking)
    .filter((row) => row.ticker.length > 0);

  const nextOffset = offset + rankings.length;

  return NextResponse.json({
    rankings,
    limit,
    offset,
    next_offset: nextOffset,
    has_more: typeof count === "number" ? nextOffset < count : rankings.length === limit,
    total: count ?? null,
    data_as_of:
      rankings.map((row) => row.updated_at).find(Boolean) ?? new Date().toISOString(),
  });
}
