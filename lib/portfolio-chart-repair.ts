import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCurrentPortfolioSnapshotPoint,
  getFirstLiveSnapshotMs,
  saveLatestPortfolioSnapshotFromChartData,
  savePortfolioSnapshotsFromChartData,
  type PortfolioSnapshotSourceRow,
} from "@/lib/portfolio-snapshots";
import { buildPortfolioValueTimeline } from "@/lib/portfolio-value-timeline";
import { createAdminClient } from "@/utils/supabase/admin";

type SupabaseLike = {
  from: SupabaseClient["from"];
};

type PortfolioRow = {
  id: string;
  user_id: string;
  cash_balance: number | null;
  cash_deposited_total?: number | null;
  investment_amount?: number | null;
  created_at?: string | null;
};

type HoldingRow = {
  portfolio_id?: string;
  ticker: string | null;
  shares: number | null;
  entry_price: number | null;
  purchase_date?: string | null;
  added_at?: string | null;
};

type TransactionRow = {
  portfolio_id?: string;
  ticker: string | null;
  type: string | null;
  shares: number | null;
  price: number | null;
  amount: number | null;
  realised_pnl: number | null;
  created_at: string | null;
};

const DEFAULT_BACKFILL_LIVE_BUFFER_MS = 10 * 60 * 1000;

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanTicker(ticker?: string | null) {
  return String(ticker ?? "").trim().toUpperCase();
}

function uniqueTickers(holdings: HoldingRow[]) {
  return Array.from(new Set(holdings.map((holding) => cleanTicker(holding.ticker)).filter(Boolean)));
}

async function loadCurrentPrices(supabase: SupabaseLike, holdings: HoldingRow[]) {
  const tickers = uniqueTickers(holdings);
  if (tickers.length === 0) return {};

  const { data } = await supabase.from("stock_rankings").select("ticker,price").in("ticker", tickers);

  return Object.fromEntries(
    ((data ?? []) as Array<{ ticker: string | null; price: number | null }>)
      .map((row) => [cleanTicker(row.ticker), toNumber(row.price, 0)] as const)
      .filter(([ticker, price]) => Boolean(ticker) && price > 0),
  );
}

async function writeLiveSnapshot({
  supabase,
  portfolio,
  holdings,
  currentPrices,
  source,
}: {
  supabase: SupabaseLike;
  portfolio: PortfolioRow;
  holdings: HoldingRow[];
  currentPrices: Record<string, number>;
  source: string;
}) {
  const point = buildCurrentPortfolioSnapshotPoint({
    portfolio,
    holdings,
    currentPrices,
  });

  return saveLatestPortfolioSnapshotFromChartData({
    supabase,
    portfolioId: portfolio.id,
    userId: portfolio.user_id,
    chartData: { "1D": [point] },
    source,
  });
}

async function loadSnapshotBoundaries(supabase: SupabaseLike, portfolioId: string) {
  const { data } = await supabase
    .from("portfolio_snapshots")
    .select("source,snapshot_at")
    .eq("portfolio_id", portfolioId)
    .order("snapshot_at", { ascending: true })
    .limit(10_000);

  return (data ?? []) as PortfolioSnapshotSourceRow[];
}

export async function repairPortfolioChartForPortfolio({
  portfolioId,
  userId,
  reason,
  includeHistorical,
  source = "page-repair",
}: {
  portfolioId: string;
  userId: string;
  reason: string;
  includeHistorical: boolean;
  source?: string;
}) {
  const startedAt = performance.now();
  const supabase = createAdminClient();

  const { data: portfolio, error: portfolioError } = await supabase
    .from("user_portfolios")
    .select("id,user_id,cash_balance,cash_deposited_total,investment_amount,created_at")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();

  if (portfolioError || !portfolio) {
    console.warn(
      `[portfolio-chart-repair] portfolioId=${portfolioId} source=${source} status=missing_portfolio reason=${reason}`,
    );
    return { liveWritten: false, historicalWritten: false };
  }

  const portfolioRow = portfolio as PortfolioRow;
  const [{ data: holdingRows }, { data: transactionRows }, snapshotRows] = await Promise.all([
    supabase
      .from("portfolio_holdings")
      .select("portfolio_id,ticker,shares,entry_price,purchase_date,added_at")
      .eq("portfolio_id", portfolioId)
      .not("ticker", "is", null),
    supabase
      .from("portfolio_transactions")
      .select("portfolio_id,ticker,type,shares,price,amount,realised_pnl,created_at")
      .eq("portfolio_id", portfolioId)
      .order("created_at", { ascending: true })
      .limit(Number(process.env.PORTFOLIO_REPAIR_TRANSACTION_LIMIT ?? 5000)),
    loadSnapshotBoundaries(supabase, portfolioId),
  ]);

  const holdings = (holdingRows ?? []) as HoldingRow[];
  const transactions = (transactionRows ?? []) as TransactionRow[];
  const currentPrices = await loadCurrentPrices(supabase, holdings);
  const liveWritten = await writeLiveSnapshot({
    supabase,
    portfolio: portfolioRow,
    holdings,
    currentPrices,
    source: "health_repair_live",
  });
  let historicalWritten = false;

  if (includeHistorical && (holdings.length > 0 || transactions.length > 0)) {
    const firstLiveMs = getFirstLiveSnapshotMs(snapshotRows);
    const maxSnapshotAtBefore = new Date(
      firstLiveMs ?? Date.now() - Number(process.env.PORTFOLIO_BACKFILL_LIVE_BUFFER_MS ?? DEFAULT_BACKFILL_LIVE_BUFFER_MS),
    );
    const chartData = await buildPortfolioValueTimeline({
      portfolio: portfolioRow,
      holdings,
      transactions,
      currentPrices,
    });

    historicalWritten = await savePortfolioSnapshotsFromChartData({
      supabase,
      portfolioId,
      userId,
      chartData,
      source: "backfill",
      maxSnapshotAtBefore,
    });
  }

  console.info(
    [
      "[portfolio-chart-repair]",
      `portfolioId=${portfolioId}`,
      `source=${source}`,
      `reason=${reason}`,
      `holdings=${holdings.length}`,
      `transactions=${transactions.length}`,
      `liveWritten=${liveWritten}`,
      `historicalWritten=${historicalWritten}`,
      `elapsedMs=${Math.round(performance.now() - startedAt)}`,
    ].join(" "),
  );

  return { liveWritten, historicalWritten };
}

export function shouldRepairHistorical(status: string, reason: string) {
  return (
    status === "missing" ||
    status === "sparse" ||
    status === "flat" ||
    status === "building" ||
    reason === "latest_portfolio_input_not_covered"
  );
}
