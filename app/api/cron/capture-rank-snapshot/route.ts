import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RankingRow = {
  ticker: string | null;
  rank: number | null;
  score: number | string | null;
  price: number | string | null;
  company: string | null;
  sector: string | null;
};

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = req.headers.get("authorization");

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const admin = createAdminClient();
    const snapshotAt = new Date().toISOString();

    const { data: rankingsData, error: rankingsError } = await admin
      .from("stock_rankings")
      .select("ticker,rank,score,price,company,sector")
      .order("rank", { ascending: true })
      .limit(1000);

    if (rankingsError) {
      console.error("[capture-rank-snapshot] rankings error", rankingsError);

      return NextResponse.json(
        { error: "Could not fetch current rankings." },
        { status: 500 },
      );
    }

    const rows = ((rankingsData ?? []) as RankingRow[])
      .filter((row) => row.ticker)
      .map((row) => ({
        snapshot_at: snapshotAt,
        ticker: row.ticker,
        rank: row.rank,
        score: toNumber(row.score),
        price: toNumber(row.price),
        company: row.company,
        sector: row.sector,
      }));

    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        inserted: 0,
        message: "No rankings found to snapshot.",
      });
    }

    const { error: insertError } = await admin
      .from("stock_rank_snapshots")
      .upsert(rows, {
        onConflict: "snapshot_at,ticker",
      });

    if (insertError) {
      console.error("[capture-rank-snapshot] insert error", insertError);

      return NextResponse.json(
        { error: "Could not insert rank snapshot." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      snapshot_at: snapshotAt,
      inserted: rows.length,
    });
  } catch (error) {
    console.error("[capture-rank-snapshot]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected snapshot error.",
      },
      { status: 500 },
    );
  }
}
