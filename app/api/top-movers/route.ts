import { NextRequest, NextResponse } from "next/server";
import type { TimeRange } from "@/components/StockChart";
import { getRankMove24h, getRankSnapshotMapAround24hAgo } from "@/lib/rank-history";
import { getStableRankings } from "@/lib/stable-rankings";
import { hasActiveSubscription } from "@/lib/subscription";
import { getOneDayMoveMap, getStockChart } from "@/lib/yahoo";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type MoveTone = "positive" | "negative" | "neutral";

type MoverPayload = {
  ticker: string;
  company: string;
  sector: string;
  price: string;
  score: string;
  rankLabel: string;
  rankTone: "up" | "down" | "flat" | "none";
  rankTitle: string;
  actualRankLabel: string;
  dailyMoveLabel: string;
  dailyMoveTone: MoveTone;
  weeklyMoveLabel?: string;
  weeklyMoveTone?: MoveTone;
  monthlyMoveLabel?: string;
  monthlyMoveTone?: MoveTone;
};

function formatPrice(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : "—";
}

function formatScore(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}

function formatRank(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `#${Math.round(n).toLocaleString()}` : "#—";
}

function formatMove(value: number | null) {
  if (!Number.isFinite(value)) return "—";
  return `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(1)}%`;
}

function moveTone(value: number | null): MoveTone {
  if (!Number.isFinite(value)) return "neutral";
  if (Number(value) > 0) return "positive";
  if (Number(value) < 0) return "negative";
  return "neutral";
}

function chartMove(points: Array<{ close: number }> | undefined) {
  if (!points || points.length < 2) return null;
  const valid = points.map((point) => point.close).filter((close) => Number.isFinite(close) && close > 0);
  if (valid.length < 2) return null;
  const first = valid[0];
  const last = valid[valid.length - 1];
  return first > 0 ? ((last - first) / first) * 100 : null;
}

async function runInBatches<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>) {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...(await Promise.all(batch.map(fn))));
  }

  return results;
}

async function periodMoveMap(tickers: string[], range: TimeRange) {
  const entries = await runInBatches(tickers, 18, async (ticker) => {
    const chart = await getStockChart(ticker, [range]);
    return [ticker, chartMove(chart[range])] as const;
  });

  return new Map(entries.filter((entry): entry is readonly [string, number] => Number.isFinite(entry[1])));
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Login required.", movers: [] }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!hasActiveSubscription(profile?.subscription_status)) {
    return NextResponse.json({ error: "Active subscription required.", movers: [] }, { status: 403 });
  }

  const period = req.nextUrl.searchParams.get("period") === "1m" ? "1m" : req.nextUrl.searchParams.get("period") === "1w" ? "1w" : "1d";
  const rankings = (await getStableRankings(supabase)).filter((stock) => stock.ticker).slice(0, 500);
  const tickers = rankings.map((stock) => String(stock.ticker).toUpperCase());
  const snapshotMap = await getRankSnapshotMapAround24hAgo(supabase);

  const moveMap = period === "1d"
    ? new Map(Array.from((await getOneDayMoveMap(tickers)).entries()).map(([ticker, move]) => [ticker, move.changePct]))
    : await periodMoveMap(tickers, period === "1w" ? "5D" : "1M");

  const movers: MoverPayload[] = rankings.map((stock) => {
    const ticker = String(stock.ticker ?? "").toUpperCase();
    const move = moveMap.get(ticker) ?? null;
    const rankMove = getRankMove24h(stock.rank, snapshotMap.get(ticker));
    const payload: MoverPayload = {
      ticker: ticker || "—",
      company: stock.company ?? "—",
      sector: stock.sector ?? "—",
      price: formatPrice(stock.price),
      score: formatScore(stock.score),
      rankLabel: rankMove.label,
      rankTone: rankMove.tone,
      rankTitle: rankMove.title,
      actualRankLabel: formatRank(stock.rank),
      dailyMoveLabel: formatMove(move),
      dailyMoveTone: moveTone(move),
    };

    if (period === "1w") {
      payload.weeklyMoveLabel = formatMove(move);
      payload.weeklyMoveTone = moveTone(move);
    }

    if (period === "1m") {
      payload.monthlyMoveLabel = formatMove(move);
      payload.monthlyMoveTone = moveTone(move);
    }

    return payload;
  });

  return NextResponse.json({ period, movers });
}
