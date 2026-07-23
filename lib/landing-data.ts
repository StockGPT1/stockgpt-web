import { createAdminClient } from "@/utils/supabase/admin";
import { getOneDayMoveMap, getTickerTape } from "@/lib/yahoo";
import type { DashboardRow } from "@/app/landing/LandingVisuals";
import type { LandingTicker } from "@/app/landing/LandingClient";

const PUBLIC_TICKER_UNIVERSE = [
  "^GSPC",
  "^IXIC",
  "^DJI",
  "^VIX",
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "JPM",
  "V",
  "MA",
];

export type LandingMetricsData = {
  totalStocks: number;
  bullishPct: number;
  sentiment: string;
  lastUpdatedLabel: string;
};

export type LandingData = {
  tickerTape: LandingTicker[];
  metrics: LandingMetricsData;
  topRankings: DashboardRow[];
};

type TopRankingRow = {
  rank: number | null;
  ticker: string | null;
  company: string | null;
  price: number | string | null;
  score: number | string | null;
};

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return "Awaiting live update";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function getSentiment(bullishPct: number) {
  if (bullishPct >= 50) return "Strong market";
  if (bullishPct >= 35) return "Healthy market";
  if (bullishPct >= 20) return "Cautious market";
  return "Weak market";
}

function formatRowPrice(value: number | string | null) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : "—";
}

function formatRowScore(value: number | string | null) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n).toLocaleString("en-US") : "—";
}

/**
 * Public landing metrics and the 5-row rankings teaser.
 *
 * stock_rankings is RLS-locked to active subscribers, so the anon/session
 * client returns nothing for logged-out visitors — which used to render
 * the hero as "0% bullish / Weak market / Awaiting live update". These
 * reads run server-side with the service-role client (read-only, capped
 * at 5 teaser rows) so the marketing page shows real data.
 */
export async function getLandingData(): Promise<LandingData> {
  const tickerTapePromise = getTickerTape(PUBLIC_TICKER_UNIVERSE).catch(() => []);

  let totalStocks = 0;
  let bullishPct = 0;
  let latestUpdate: string | null = null;
  let topRankings: DashboardRow[] = [];

  try {
    const admin = createAdminClient();

    const [{ count: totalCount }, { count: bullishCount }, { data: latestRows }, { data: topRows }] =
      await Promise.all([
        admin.from("stock_rankings").select("*", { count: "exact", head: true }),
        admin
          .from("stock_rankings")
          .select("*", { count: "exact", head: true })
          .gte("score", 7000),
        admin
          .from("stock_rankings")
          .select("updated_at")
          .order("updated_at", { ascending: false })
          .limit(1),
        admin
          .from("stock_rankings")
          .select("rank,ticker,company,price,score")
          .order("rank", { ascending: true })
          .limit(5),
      ]);

    totalStocks = totalCount ?? 0;
    bullishPct =
      totalStocks > 0 ? Math.round(((bullishCount ?? 0) / totalStocks) * 100) : 0;
    latestUpdate = latestRows?.[0]?.updated_at ?? null;

    const rows = ((topRows ?? []) as TopRankingRow[]).filter((row) => row.ticker);
    const moveMap = await getOneDayMoveMap(
      rows.map((row) => row.ticker as string),
    ).catch(() => new Map());

    topRankings = rows.map((row, index) => {
      const changePct = moveMap.get(row.ticker as string)?.changePct;
      const hasMove = Number.isFinite(changePct);

      return {
        rank: String(row.rank ?? index + 1),
        ticker: row.ticker as string,
        company: row.company ?? "—",
        price: formatRowPrice(row.price),
        score: formatRowScore(row.score),
        move: hasMove ? `${Number(changePct) >= 0 ? "+" : ""}${Number(changePct).toFixed(1)}%` : "—",
        moveUp: hasMove ? Number(changePct) >= 0 : true,
      };
    });
  } catch (error) {
    console.error("[landing-data] falling back to static content", error);
  }

  const tickerTape = (await tickerTapePromise).map((item) => ({
    symbol: item.symbol,
    yahooSymbol: item.yahooSymbol,
    price: item.price,
    change: item.change,
    changePct: item.changePct,
  }));

  return {
    tickerTape,
    metrics: {
      totalStocks,
      bullishPct,
      sentiment: getSentiment(bullishPct),
      lastUpdatedLabel: formatUpdatedAt(latestUpdate),
    },
    topRankings,
  };
}
