import { NextResponse, type NextRequest } from "next/server";
import type { ChartPoint, TimeRange } from "@/components/StockChart";
import { getStockChart } from "@/lib/yahoo";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RANGES: TimeRange[] = ["1D", "1M", "6M", "1Y", "MAX"];
const RANGE_DAYS: Partial<Record<TimeRange, number>> = {
  "1D": 1,
  "1M": 30,
  "6M": 182,
  "1Y": 365,
};

type HoldingRow = {
  ticker: string | null;
  shares: number | null;
  entry_price: number | null;
  purchase_date?: string | null;
  added_at?: string | null;
};

type PortfolioRow = {
  id: string;
  user_id: string;
  cash_balance: number | null;
  cash_deposited_total?: number | null;
  investment_amount?: number | null;
  created_at?: string | null;
};

type Holding = {
  ticker: string;
  shares: number;
  entryPrice: number;
  startMs: number;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function safeDateMs(value: string | null | undefined) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isDateOnly(value: string | null | undefined) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function holdingStartMs(row: HoldingRow) {
  const addedMs = safeDateMs(row.added_at) ?? Date.now();
  const purchaseMs = safeDateMs(row.purchase_date);

  // Date-only manual/import purchases do not contain an execution time. Use added_at
  // so charts do not pretend the position existed before the portfolio was created.
  if (!purchaseMs || isDateOnly(row.purchase_date)) return addedMs;
  return purchaseMs;
}

function normalisePointDate(point: ChartPoint) {
  return new Date(point.date).getTime();
}

function samplePoints(points: ChartPoint[]) {
  if (points.length <= 260) return points;
  const step = Math.ceil(points.length / 260);
  const sampled = points.filter((_, index) => index % step === 0);
  const last = points.at(-1);
  if (last && sampled.at(-1)?.date !== last.date) sampled.push(last);
  return sampled;
}

function buildRangeValueSeries({
  holdings,
  charts,
  cash,
  range,
  portfolioStartMs,
  currentPrices,
}: {
  holdings: Holding[];
  charts: Map<string, ChartPoint[]>;
  cash: number;
  range: TimeRange;
  portfolioStartMs: number;
  currentPrices: Map<string, number>;
}) {
  const now = Date.now();
  const rangeStartMs = RANGE_DAYS[range]
    ? Math.max(portfolioStartMs, now - RANGE_DAYS[range]! * 86_400_000)
    : portfolioStartMs;

  const times = new Set<number>([rangeStartMs, now]);
  const seriesByTicker = new Map<string, Array<{ ms: number; price: number }>>();

  holdings.forEach((holding) => {
    const startMs = Math.max(rangeStartMs, holding.startMs);
    const rawPoints = charts.get(`${holding.ticker}:${range}`) ?? charts.get(`${holding.ticker}:MAX`) ?? [];
    const points = rawPoints
      .map((point) => ({ ms: normalisePointDate(point), price: point.close }))
      .filter((point) => Number.isFinite(point.ms) && point.ms >= startMs)
      .sort((a, b) => a.ms - b.ms);

    const currentPrice = currentPrices.get(holding.ticker) ?? points.at(-1)?.price ?? holding.entryPrice;
    const fullSeries = [
      { ms: startMs, price: holding.entryPrice },
      ...points,
      { ms: now, price: currentPrice },
    ]
      .filter((point, index, all) => index === 0 || point.ms !== all[index - 1].ms)
      .sort((a, b) => a.ms - b.ms);

    fullSeries.forEach((point) => times.add(point.ms));
    seriesByTicker.set(holding.ticker, fullSeries);
  });

  const sortedTimes = Array.from(times).sort((a, b) => a - b);
  const points = sortedTimes.map((ms) => {
    const holdingsValue = holdings.reduce((sum, holding) => {
      if (ms < holding.startMs) return sum;
      const series = seriesByTicker.get(holding.ticker) ?? [];
      let price = holding.entryPrice;
      for (const point of series) {
        if (point.ms > ms) break;
        price = point.price;
      }
      return sum + price * holding.shares;
    }, 0);

    return {
      date: new Date(ms).toISOString(),
      close: roundMoney(cash + holdingsValue),
    };
  });

  const deduped = points.filter(
    (point, index, all) => index === 0 || point.date !== all[index - 1].date,
  );

  if (deduped.length <= 1) return [];
  return samplePoints(deduped);
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
    .select("id,user_id,cash_balance,cash_deposited_total,investment_amount,created_at")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (portfolioError || !portfolio) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const { data: holdingRows, error: holdingsError } = await supabase
    .from("portfolio_holdings")
    .select("ticker,shares,entry_price,purchase_date,added_at")
    .eq("portfolio_id", portfolioId)
    .not("ticker", "is", null);

  if (holdingsError) return NextResponse.json({ error: "Could not load holdings" }, { status: 500 });

  const portfolioRow = portfolio as PortfolioRow;
  const holdings = ((holdingRows ?? []) as HoldingRow[])
    .map((row) => ({
      ticker: String(row.ticker ?? "").toUpperCase(),
      shares: toNumber(row.shares, 0),
      entryPrice: toNumber(row.entry_price, 0),
      startMs: holdingStartMs(row),
    }))
    .filter((row) => row.ticker && row.shares > 0 && row.entryPrice > 0);

  if (holdings.length === 0) return NextResponse.json({ chartData: {} });

  const portfolioCreatedMs = safeDateMs(portfolioRow.created_at) ?? Math.min(...holdings.map((holding) => holding.startMs));
  const portfolioStartMs = Math.min(portfolioCreatedMs, ...holdings.map((holding) => holding.startMs));

  const [{ data: currentRows }, ...chartResults] = await Promise.all([
    supabase.from("stock_rankings").select("ticker,price").in("ticker", holdings.map((holding) => holding.ticker)),
    ...holdings.map((holding) => getStockChart(holding.ticker, RANGES)),
  ]);

  const currentPrices = new Map(
    ((currentRows ?? []) as Array<{ ticker: string | null; price: number | null }>).map((row) => [
      String(row.ticker ?? "").toUpperCase(),
      toNumber(row.price, 0),
    ]),
  );

  const charts = new Map<string, ChartPoint[]>();
  holdings.forEach((holding, index) => {
    const chart = chartResults[index] as Partial<Record<TimeRange, ChartPoint[]>>;
    RANGES.forEach((range) => {
      const points = chart[range] ?? [];
      if (points.length > 1) charts.set(`${holding.ticker}:${range}`, points);
    });
  });

  const cash = toNumber(portfolioRow.cash_balance, 0);
  const chartData = RANGES.reduce<Partial<Record<TimeRange, ChartPoint[]>>>((acc, range) => {
    const points = buildRangeValueSeries({
      holdings,
      charts,
      cash,
      range,
      portfolioStartMs,
      currentPrices,
    });
    if (points.length > 1) acc[range] = points;
    return acc;
  }, {});

  return NextResponse.json({ chartData });
}
