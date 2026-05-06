import type { SupabaseClient } from "@supabase/supabase-js";

export type SnapshotRank = {
  ticker: string;
  rank: number | null;
};

export type RankMove24h = {
  label: string;
  tone: "up" | "down" | "flat" | "none";
  title: string;
};

type SnapshotRow = {
  ticker: string | null;
  rank: number | null;
  snapshot_at: string | null;
};

export function getRankMove24h(
  currentRank: number | null,
  rank24hAgo: number | null | undefined,
): RankMove24h {
  if (currentRank == null || rank24hAgo == null) {
    return {
      label: "—",
      tone: "none",
      title: "No 24-hour rank snapshot available yet",
    };
  }

  const difference = rank24hAgo - currentRank;

  if (difference > 0) {
    return {
      label: `↑ ${difference}`,
      tone: "up",
      title: `Moved up ${difference} place${difference === 1 ? "" : "s"} versus the 24-hour snapshot`,
    };
  }

  if (difference < 0) {
    const abs = Math.abs(difference);

    return {
      label: `↓ ${abs}`,
      tone: "down",
      title: `Moved down ${abs} place${abs === 1 ? "" : "s"} versus the 24-hour snapshot`,
    };
  }

  return {
    label: "—",
    tone: "flat",
    title: "Rank unchanged versus the 24-hour snapshot",
  };
}

export function moveClassName(tone: RankMove24h["tone"]) {
  if (tone === "up") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  }

  if (tone === "down") {
    return "border-red-500/25 bg-red-500/10 text-red-700";
  }

  if (tone === "flat") {
    return "border-[#072116]/10 bg-[#072116]/5 text-[#072116]/45";
  }

  return "border-[#072116]/8 bg-transparent text-[#072116]/35";
}

export async function getRankSnapshotMapAround24hAgo(
  supabase: SupabaseClient,
): Promise<Map<string, number>> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: latestSnapshot } = await supabase
    .from("stock_rank_snapshots")
    .select("snapshot_at")
    .lte("snapshot_at", cutoff)
    .order("snapshot_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const snapshotAt = latestSnapshot?.snapshot_at as string | undefined;

  if (!snapshotAt) {
    return new Map();
  }

  const { data } = await supabase
    .from("stock_rank_snapshots")
    .select("ticker,rank,snapshot_at")
    .eq("snapshot_at", snapshotAt);

  const rows = (data ?? []) as SnapshotRow[];

  return new Map(
    rows
      .filter((row) => row.ticker && row.rank != null)
      .map((row) => [row.ticker as string, row.rank as number]),
  );
}

export async function getDaysAtTop(
  supabase: SupabaseClient,
  ticker: string,
  currentRank: number | null,
): Promise<number | null> {
  if (currentRank !== 1) return 0;

  const todayKey = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("stock_rank_snapshots")
    .select("snapshot_at,rank")
    .eq("ticker", ticker)
    .order("snapshot_at", { ascending: false })
    .limit(400);

  const rows = ((data ?? []) as Array<{
    snapshot_at: string | null;
    rank: number | null;
  }>).filter((row) => row.snapshot_at);

  if (rows.length === 0) {
    return 1;
  }

  const uniqueByDate = new Map<string, number | null>();

  for (const row of rows) {
    if (!row.snapshot_at) continue;

    const dateKey = row.snapshot_at.slice(0, 10);

    if (!uniqueByDate.has(dateKey)) {
      uniqueByDate.set(dateKey, row.rank);
    }
  }

  const orderedDates = Array.from(uniqueByDate.keys()).sort((a, b) =>
    b.localeCompare(a),
  );

  let days = 0;
  let countedToday = false;

  for (const dateKey of orderedDates) {
    const rank = uniqueByDate.get(dateKey);

    if (dateKey === todayKey) {
      countedToday = true;
    }

    if (rank === 1) {
      days += 1;
    } else {
      break;
    }
  }

  if (!countedToday) {
    days += 1;
  }

  return Math.max(days, 1);
}
