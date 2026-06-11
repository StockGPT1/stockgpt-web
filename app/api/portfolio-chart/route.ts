import { NextResponse, type NextRequest } from "next/server";
import type { ChartPoint, TimeRange } from "@/components/StockChart";
import { getJsonCache, setJsonCache } from "@/lib/redis-cache";
import { hashPortfolioInputs } from "@/lib/portfolio-speed-cache";
import { getCachedStockChart } from "@/lib/yahoo";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RANGES: TimeRange[] = ["1D", "1M", "6M", "1Y", "MAX"];
const PORTFOLIO_CHART_CACHE_TTL_SECONDS = Number(
  process.env.PORTFOLIO_CHART_CACHE_TTL_SECONDS ?? 15 * 60,
);
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

type TransactionRow = {
  ticker: string | null;
  type: string | null;
  shares: number | null;
  price: number | null;
  amount: number | null;
  realised_pnl: number | null;
  created_at: string | null;
};

type PortfolioRow = {
  id: string;
  user_id: string;
  cash_balance: number | null;
  cash_deposited_total?: number | null;
  investment_amount?: number | null;
  created_at?: string | null;
};

type Lot = {
  ticker: string;
  shares: number;
  entryPrice: number;
  startMs: number;
};

type CashEvent = {
  ms: number;
  amount: number;
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

function normaliseTransactionType(type: string | null | undefined) {
  return String(type ?? "").trim().toLowerCase();
}

function portfolioChartCacheKey({
  userId,
  portfolioId,
  inputHash,
}: {
  userId: string;
  portfolioId: string;
  inputHash: string;
}) {
  return `portfolio:chart:${userId}:${portfolioId}:${inputHash}`;
}

function buildLotsFromLedger({
  transactions,
  holdings,
  currentCashBalance,
}: {
  transactions: TransactionRow[];
  holdings: HoldingRow[];
  currentCashBalance: number;
}) {
  const lots: Lot[] = [];
  let cashEvents: CashEvent[] = [];
  const holdingLedgerTransactions = transactions.filter((transaction) => {
    const type = normaliseTransactionType(transaction.type);
    return type === "buy" || type === "sell" || type === "log_existing" || type === "import_holding";
  });

  const sortedTransactions = [...transactions].sort(
    (a, b) => (safeDateMs(a.created_at) ?? 0) - (safeDateMs(b.created_at) ?? 0),
  );

  sortedTransactions.forEach((transaction) => {
    const type = normaliseTransactionType(transaction.type);
    const ms = safeDateMs(transaction.created_at) ?? Date.now();
    const amount = toNumber(transaction.amount, 0);
    const ticker = String(transaction.ticker ?? "").toUpperCase();
    const shares = toNumber(transaction.shares, 0);
    const price = toNumber(transaction.price, 0);

    if (type === "deposit" || type === "import" || type === "cash_adjustment") {
      if (amount > 0) cashEvents.push({ ms, amount });
      return;
    }

    if (type === "withdrawal") {
      if (amount > 0) cashEvents.push({ ms, amount: -amount });
      return;
    }

    if ((type === "buy" || type === "log_existing" || type === "import_holding") && ticker && shares > 0 && price > 0) {
      lots.push({ ticker, shares, entryPrice: price, startMs: ms });
      cashEvents.push({ ms, amount: -(amount || shares * price) });
      return;
    }

    if (type === "sell" && ticker && shares > 0) {
      let remaining = shares;
      for (const lot of lots) {
        if (lot.ticker !== ticker || remaining <= 0) continue;
        const sold = Math.min(lot.shares, remaining);
        lot.shares -= sold;
        remaining -= sold;
      }
      cashEvents.push({ ms, amount: amount || shares * price });
    }
  });

  // Legacy/imported portfolios often have one import/deposit row plus current holdings,
  // but no buy rows. In that case, the import amount represents funding for the holdings,
  // not extra cash. Use holdings + actual current cash balance only to avoid double counting.
  if (holdingLedgerTransactions.length === 0) {
    cashEvents = [];
    let firstHoldingMs: number | null = null;

    holdings.forEach((row) => {
      const ticker = String(row.ticker ?? "").toUpperCase();
      const shares = toNumber(row.shares, 0);
      const entryPrice = toNumber(row.entry_price, 0);
      const startMs = holdingStartMs(row);
      if (!ticker || shares <= 0 || entryPrice <= 0) return;
      lots.push({ ticker, shares, entryPrice, startMs });
      firstHoldingMs = firstHoldingMs == null ? startMs : Math.min(firstHoldingMs, startMs);
    });

    if (currentCashBalance > 0 && firstHoldingMs != null) {
      cashEvents.push({ ms: firstHoldingMs, amount: currentCashBalance });
    }
  }

  return {
    lots: lots.filter((lot) => lot.shares > 0),
    cashEvents,
  };
}

function cashAtTime(cashEvents: CashEvent[], ms: number) {
  return cashEvents.reduce((sum, event) => (event.ms <= ms ? sum + event.amount : sum), 0);
}

function priceAtTime({
  ticker,
  targetMs,
  entryPrice,
  startMs,
  charts,
  range,
  currentPrices,
}: {
  ticker: string;
  targetMs: number;
  entryPrice: number;
  startMs: number;
  charts: Map<string, ChartPoint[]>;
  range: TimeRange;
  currentPrices: Map<string, number>;
}) {
  if (targetMs <= startMs) return entryPrice;

  const rawPoints = charts.get(`${ticker}:${range}`) ?? charts.get(`${ticker}:MAX`) ?? [];
  let price = entryPrice;

  for (const point of rawPoints) {
    const pointMs = normalisePointDate(point);
    if (!Number.isFinite(pointMs) || pointMs < startMs) continue;
    if (pointMs > targetMs) break;
    price = point.close;
  }

  if (targetMs >= Date.now() - 60_000) {
    return currentPrices.get(ticker) || price;
  }

  return price;
}

function buildRangeValueSeries({
  lots,
  cashEvents,
  charts,
  range,
  portfolioStartMs,
  currentPrices,
}: {
  lots: Lot[];
  cashEvents: CashEvent[];
  charts: Map<string, ChartPoint[]>;
  range: TimeRange;
  portfolioStartMs: number;
  currentPrices: Map<string, number>;
}) {
  const now = Date.now();
  const rangeStartMs = RANGE_DAYS[range]
    ? Math.max(portfolioStartMs, now - RANGE_DAYS[range]! * 86_400_000)
    : portfolioStartMs;

  const times = new Set<number>([rangeStartMs, now]);

  lots.forEach((lot) => {
    if (lot.startMs >= rangeStartMs && lot.startMs <= now) times.add(lot.startMs);
    const rawPoints = charts.get(`${lot.ticker}:${range}`) ?? charts.get(`${lot.ticker}:MAX`) ?? [];
    rawPoints.forEach((point) => {
      const ms = normalisePointDate(point);
      if (Number.isFinite(ms) && ms >= Math.max(rangeStartMs, lot.startMs) && ms <= now) times.add(ms);
    });
  });

  cashEvents.forEach((event) => {
    if (event.ms >= rangeStartMs && event.ms <= now) times.add(event.ms);
  });

  const points = Array.from(times)
    .sort((a, b) => a - b)
    .map((ms) => {
      const holdingsValue = lots.reduce((sum, lot) => {
        if (ms < lot.startMs) return sum;
        return (
          sum +
          lot.shares *
            priceAtTime({
              ticker: lot.ticker,
              targetMs: ms,
              entryPrice: lot.entryPrice,
              startMs: lot.startMs,
              charts,
              range,
              currentPrices,
            })
        );
      }, 0);

      return {
        date: new Date(ms).toISOString(),
        close: roundMoney(cashAtTime(cashEvents, ms) + holdingsValue),
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

  const [{ data: holdingRows, error: holdingsError }, { data: transactionRows, error: transactionError }] =
    await Promise.all([
      supabase
        .from("portfolio_holdings")
        .select("ticker,shares,entry_price,purchase_date,added_at")
        .eq("portfolio_id", portfolioId)
        .not("ticker", "is", null),
      supabase
        .from("portfolio_transactions")
        .select("ticker,type,shares,price,amount,realised_pnl,created_at")
        .eq("portfolio_id", portfolioId)
        .order("created_at", { ascending: true })
        .limit(2000),
    ]);

  if (holdingsError || transactionError) {
    return NextResponse.json({ error: "Could not load portfolio history" }, { status: 500 });
  }

  const portfolioRow = portfolio as PortfolioRow;
  const { lots, cashEvents } = buildLotsFromLedger({
    transactions: (transactionRows ?? []) as TransactionRow[],
    holdings: (holdingRows ?? []) as HoldingRow[],
    currentCashBalance: toNumber(portfolioRow.cash_balance, 0),
  });

  if (lots.length === 0 && cashEvents.length === 0) return NextResponse.json({ chartData: {} });

  const portfolioCreatedMs = safeDateMs(portfolioRow.created_at) ?? Date.now();
  const firstLotMs = lots.length > 0 ? Math.min(...lots.map((lot) => lot.startMs)) : portfolioCreatedMs;
  const firstCashMs = cashEvents.length > 0 ? Math.min(...cashEvents.map((event) => event.ms)) : portfolioCreatedMs;
  const portfolioStartMs = Math.max(portfolioCreatedMs, Math.min(firstLotMs, firstCashMs));
  const tickers = Array.from(new Set(lots.map((lot) => lot.ticker)));

  const { data: currentRows } =
    tickers.length > 0
      ? await supabase.from("stock_rankings").select("ticker,price").in("ticker", tickers)
      : { data: [] };

  const chartInputHash = hashPortfolioInputs({
    version: "portfolio-chart-v2",
    portfolio: portfolioRow,
    holdings: holdingRows,
    transactions: transactionRows,
    prices: ((currentRows ?? []) as Array<{ ticker: string | null; price: number | null }>)
      .map((row) => ({
        ticker: String(row.ticker ?? "").toUpperCase(),
        price: toNumber(row.price, 0),
      }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker)),
  });
  const cacheKey = portfolioChartCacheKey({
    userId: user.id,
    portfolioId,
    inputHash: chartInputHash,
  });
  const cachedChartData =
    await getJsonCache<Partial<Record<TimeRange, ChartPoint[]>>>(cacheKey);
  if (cachedChartData) return NextResponse.json({ chartData: cachedChartData });

  const chartResults = await Promise.all(
    tickers.map((ticker) => getCachedStockChart(ticker, RANGES)),
  );

  const currentPrices = new Map(
    ((currentRows ?? []) as Array<{ ticker: string | null; price: number | null }>).map((row) => [
      String(row.ticker ?? "").toUpperCase(),
      toNumber(row.price, 0),
    ]),
  );

  const charts = new Map<string, ChartPoint[]>();
  tickers.forEach((ticker, index) => {
    const chart = chartResults[index] as Partial<Record<TimeRange, ChartPoint[]>>;
    RANGES.forEach((range) => {
      const points = chart[range] ?? [];
      if (points.length > 1) charts.set(`${ticker}:${range}`, points);
    });
  });

  const chartData = RANGES.reduce<Partial<Record<TimeRange, ChartPoint[]>>>((acc, range) => {
    const points = buildRangeValueSeries({
      lots,
      cashEvents,
      charts,
      range,
      portfolioStartMs,
      currentPrices,
    });
    if (points.length > 1) acc[range] = points;
    return acc;
  }, {});

  if (Object.keys(chartData).length === 0) {
    return NextResponse.json({ pending: true }, { status: 202 });
  }

  void setJsonCache(cacheKey, chartData, PORTFOLIO_CHART_CACHE_TTL_SECONDS);

  return NextResponse.json({ chartData });
}
