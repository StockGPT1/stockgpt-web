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

const RANKING_SELECT = "id,rank,previous_rank,ticker,company,sector,score,price,updated_at";

function mapRankingRows(data: LiveRankingRow[] | null): StableRankingRow[] {
  return (data ?? []).map((row, index) => ({
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

export type StableRankingsPageOptions = {
  limit: number;
  offset: number;
  q?: string;
  sector?: string;
  scoreFilter?: string;
};

export async function getStableRankingsPage(
  supabase: SupabaseClient,
  options: StableRankingsPageOptions,
): Promise<{ rows: StableRankingRow[]; total: number }> {
  const limit = Math.min(Math.max(Math.trunc(options.limit), 1), 100);
  const offset = Math.max(Math.trunc(options.offset), 0);
  let query = supabase
    .from("stock_rankings")
    .select(RANKING_SELECT, { count: "exact" });

  const search = options.q?.trim().replace(/[%_,().]/g, " ").replace(/\s+/g, " ");
  if (search) {
    query = query.or(`ticker.ilike.%${search}%,company.ilike.%${search}%`);
  }

  if (options.sector && options.sector !== "all") {
    query = query.eq("sector", options.sector);
  }

  if (options.scoreFilter === "elite") query = query.gte("score", 25000);
  if (options.scoreFilter === "strong") query = query.gte("score", 16000);
  if (options.scoreFilter === "positive") query = query.gte("score", 9000);
  if (options.scoreFilter === "mixed") query = query.gte("score", 4500).lt("score", 9000);
  if (options.scoreFilter === "weak") query = query.gt("score", 0).lt("score", 4500);

  const { data, error, count } = await query
    .order("rank", { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[stable-rankings] paged live read error", error);
    return { rows: [], total: 0 };
  }

  return {
    rows: mapRankingRows((data ?? []) as LiveRankingRow[]),
    total: count ?? 0,
  };
}

export async function getRankingSectors(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("stock_rankings")
    .select("sector")
    .not("sector", "is", null)
    .order("sector", { ascending: true })
    .limit(1000);

  if (error) {
    console.error("[stable-rankings] sector read error", error);
    return [];
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => (typeof row.sector === "string" ? row.sector.trim() : ""))
        .filter(Boolean),
    ),
  );
}

export async function getStableRankings(supabase: SupabaseClient): Promise<StableRankingRow[]> {
  const { data, error } = await supabase
    .from("stock_rankings")
    .select(RANKING_SELECT)
    .order("rank", { ascending: true, nullsFirst: false })
    .limit(1000);

  if (error) {
    console.error("[stable-rankings] live read error", error);
    return [];
  }

  return mapRankingRows((data ?? []) as LiveRankingRow[]);
}
