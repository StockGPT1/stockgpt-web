import { NextResponse, type NextRequest } from "next/server";
import type { ChartPoint, TimeRange } from "@/components/StockChart";
import { getStockChart } from "@/lib/yahoo";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RANGES: TimeRange[] = ["1D", "1M", "6M", "1Y", "MAX"];

type HoldingRow = {
  ticker: string | null;
  shares: number | null;
};

type PortfolioRow = {
  id: string;
  user_id: string;
  cash_balance: number | null;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function buildRangeValueSeries({
  holdings,
  charts,
  cash,
  range,
}: {
  holdings: Array<{ ticker: string; shares: number }>;
  charts: Map<string, ChartPoint[]>;
  cash: number;
  range: TimeRange;
}) {
  const dated = new Map<string, number>();

  holdings.forEach((holding) => {
    const points = charts.get(`${holding.ticker}:${range}`) ?? [];
    points.forEach((point) => {
      const date = point.date;
      const previous = dated.get(date) ?? cash;
      dated.set(date, previous + holding.shares * point.close);
    });
  });

  const points = Array.from(dated.entries())
    .map(([date, close]) => ({ date, close: roundMoney(close) }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (points.length <= 1) return [];

  if (points.length > 260) {
    const step = Math.ceil(points.length / 260);
    const sampled = points.filter((_, index) => index % step === 0);
    const last = points.at(-1);
    if (last && sampled.at(-1)?.date !== last.date) sampled.push(last);
    return sampled;
  }

  return points;
}

export async function GET(req: NextRequest) {
  const portfolioId = req.nextUrl.searchParams.get("portfolioId");
  if (!portfolioId) return NextResponse.json({ error: "Missing portfolioId" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: portfolio, error: portfolioError } = await supabase
    .from("user_portfolios")
    .select("id,user_id,cash_balance")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (portfolioError || !portfolio) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const { data: holdingRows, error: holdingsError } = await supabase
    .from("portfolio_holdings")
    .select("ticker,shares")
    .eq("portfolio_id", portfolioId)
    .not("ticker", "is", null);

  if (holdingsError) return NextResponse.json({ error: "Could not load holdings" }, { status: 500 });

  const holdings = ((holdingRows ?? []) as HoldingRow[])
    .map((row) => ({ ticker: String(row.ticker ?? "").toUpperCase(), shares: toNumber(row.shares, 0) }))
    .filter((row) => row.ticker && row.shares > 0);

  if (holdings.length === 0) return NextResponse.json({ chartData: {} });

  const charts = new Map<string, ChartPoint[]>();
  await Promise.all(
    holdings.map(async (holding) => {
      const chart = await getStockChart(holding.ticker, RANGES);
      RANGES.forEach((range) => {
        const points = chart[range] ?? [];
        if (points.length > 1) charts.set(`${holding.ticker}:${range}`, points);
      });
    }),
  );

  const cash = toNumber((portfolio as PortfolioRow).cash_balance, 0);
  const chartData = RANGES.reduce<Partial<Record<TimeRange, ChartPoint[]>>>((acc, range) => {
    const points = buildRangeValueSeries({ holdings, charts, cash, range });
    if (points.length > 1) acc[range] = points;
    return acc;
  }, {});

  return NextResponse.json({ chartData });
}
