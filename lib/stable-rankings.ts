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

type SnapshotRow = {
  ticker: string | null;
  rank: number | null;
  score: number | string | null;
  price: number | string | null;
  company: string | null;
  sector: string | null;
  snapshot_at: string | null;
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

const MIN_COMPLETE_SNAPSHOT_ROWS = 400;

function tickerId(ticker: string | null, fallback: number) {
  return ticker && ticker.trim().length > 0 ? ticker.trim().toUpperCase() : `snapshot-${fallback}`;
}

async function getLatestSnapshotAt(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("stock_rank_snapshots")
    .select("snapshot_at")
    .order("snapshot_at", { ascending: false })
    .limit(12);

  const snapshotTimes = Array.from(
    new Set(
      ((data ?? []) as Array<{ snapshot_at: string | null }>)
        .map((row) => row.snapshot_at)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  for (const snapshotAt of snapshotTimes) {
    const { count, error } = await supabase
      .from("stock_rank_snapshots")
      .select("ticker", { count: "exact", head: true })
      .eq("snapshot_at", snapshotAt)
      .not("ticker", "is", null);

    if (!error && typeof count === "number" && count >= MIN_COMPLETE_SNAPSHOT_ROWS) {
      return snapshotAt;
    }
  }

  return null;
}

async function getSnapshotRankings(supabase: SupabaseClient): Promise<StableRankingRow[] | null> {
  const snapshotAt = await getLatestSnapshotAt(supabase);
  if (!snapshotAt) return null;

  const { data, error } = await supabase
    .from("stock_rank_snapshots")
    .select("ticker,rank,score,price,company,sector,snapshot_at")
    .eq("snapshot_at", snapshotAt)
    .order("rank", { ascending: true, nullsFirst: false })
    .limit(1000);

  if (error) {
    console.error("[stable-rankings] snapshot read error", error);
    return null;
  }

  const rows = ((data ?? []) as SnapshotRow[]).filter((row) => row.ticker);
  if (rows.length < MIN_COMPLETE_SNAPSHOT_ROWS) return null;

  return rows.map((row, index) => ({
    id: tickerId(row.ticker, index),
    rank: row.rank,
    previous_rank: null,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    score: row.score,
    price: row.price,
    updated_at: row.snapshot_at,
  }));
}

async function getLiveRankings(supabase: SupabaseClient): Promise<StableRankingRow[]> {
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

export async function getStableRankings(supabase: SupabaseClient): Promise<StableRankingRow[]> {
  const snapshotRankings = await getSnapshotRankings(supabase);
  if (snapshotRankings?.length) return snapshotRankings;

  return getLiveRankings(supabase);
}
