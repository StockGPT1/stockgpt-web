import type { SupabaseClient } from "@supabase/supabase-js";

export type StableRankingRow = {
  id: string | number;
  rank: number | null;
  previous_rank?: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
  updated_at?: string | null;
};

type LiveRankingRow = {
  id: string | number | null;
  rank: number | null;
  previous_rank?: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
  updated_at?: string | null;
};

function tickerId(ticker: string | null, fallback: number) {
  return ticker && ticker.trim().length > 0 ? ticker.trim().toUpperCase() : `ranking-${fallback}`;
}

export async function getStableRankings(supabase: SupabaseClient): Promise<StableRankingRow[]> {
  const { data, error } = await supabase
    .from("stock_rankings")
    .select("id,rank,previous_rank,ticker,company,sector,score,price,updated_at")
    .order("rank", { ascending: true, nullsFirst: false })
    .limit(1000);

  if (error) {
    console.error("[stable-rankings] live read error", error);
    return [];
  }

  return ((data ?? []) as LiveRankingRow[]).map((row, index) => ({
    id: row.id ?? tickerId(row.ticker, index),
    rank: row.rank,
    previous_rank: row.previous_rank ?? null,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    score: row.score,
    price: row.price,
    updated_at: row.updated_at ?? null,
  }));
}
