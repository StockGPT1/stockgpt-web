import { NextResponse, type NextRequest } from "next/server";
import {
  buildCurrentPortfolioSnapshotPoint,
  buildMinimalCurrentChartData,
  saveLatestPortfolioSnapshotFromChartData,
  savePortfolioSnapshotsFromChartData,
} from "@/lib/portfolio-snapshots";
import { buildPortfolioValueTimeline } from "@/lib/portfolio-value-timeline";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HISTORICAL_SNAPSHOT_SOURCES = new Set(["backfill", "chart_rebuild"]);
const LIVE_SNAPSHOT_SOURCES = new Set(["cron_refresh", "page_current_value", "page", "health_repair_live"]);
const DEFAULT_STALE_LIVE_MS = 20 * 60 * 1000;
const DEFAULT_MIN_HISTORY_AGE_MS = 30 * 60 * 1000;
const DEFAULT_BACKFILL_LIVE_BUFFER_MS = 10 * 60 * 1000;

type PortfolioRow = {
  id: string;
  user_id: string;
  cash_balance: number | null;
  cash_deposited_total?: number | null;
  investment_amount?: number | null;
  created_at?: string | null;
};

type HoldingRow = {
  portfolio_id: string;
  ticker: string | null;
  shares: number | null;
  entry_price: number | null;
  purchase_date?: string | null;
  added_at?: string | null;
};

type TransactionRow = {
  portfolio_id: string;
  ticker: string | null;
  type: string | null;
  shares: number | null;
  price: number | null;
  amount: number | null;
  realised_pnl: number | null;
  created_at: string | null;
};

type SnapshotRow = {
  portfolio_id: string;
  source: string | null;
  snapshot_at: string | null;
  value: number | string | null;
  cash: number | string | null;
  basis: number | string | null;
};

type PortfolioHealth = {
  portfolio: PortfolioRow;
  snapshotRows: SnapshotRow[];
  hasLive: boolean;
  latestLiveMs: number | null;
  hasHistorical: boolean;
  hasInvalidSnapshot: boolean;
  hasHistoricalAfterLive: boolean;
  isLiveStale: boolean;
  isMissingHistorical: boolean;
};

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return (req.headers.get("authorization") ?? "") === `Bearer ${cronSecret}`;
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeDateMs(value: string | null | undefined) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function cleanTicker(ticker?: string | null) {
  return String(ticker ?? "").trim().toUpperCase();
}

function cleanSource(source?: string | null) {
  return String(source ?? "").trim().toLowerCase();
}

function isHistoricalSource(source?: string | null) {
  return HISTORICAL_SNAPSHOT_SOURCES.has(cleanSource(source));
}

function isLiveSource(source?: string | null) {
  return LIVE_SNAPSHOT_SOURCES.has(cleanSource(source));
}

function groupByPortfolio<T extends { portfolio_id: string }>(rows: T[]) {
  return rows.reduce((map, row) => {
    const list = map.get(row.portfolio_id) ?? [];
    list.push(row);
    map.set(row.portfolio_id, list);
    return map;
  }, new Map<string, T[]>());
}

function latestLiveSnapshotMs(rows: SnapshotRow[]) {
  return rows.reduce<number | null>((latest, row) => {
    if (!isLiveSource(row.source)) return latest;
    const ms = safeDateMs(row.snapshot_at);
    if (ms == null) return latest;
    return latest == null || ms > latest ? ms : latest;
  }, null);
}

function hasInvalidSnapshot(rows: SnapshotRow[]) {
  return rows.some((row) => {
    const value = toNumber(row.value, Number.NaN);
    const cash = toNumber(row.cash, Number.NaN);
    const basis = toNumber(row.basis, Number.NaN);
    return !Number.isFinite(value) || value < 0 || !Number.isFinite(cash) || cash < 0 || !Number.isFinite(basis) || basis < 0;
  });
}

function hasHistoricalAfterLive(rows: SnapshotRow[], latestLiveMs: number | null) {
  if (latestLiveMs == null) return false;
  return rows.some((row) => {
    if (!isHistoricalSource(row.source)) return false;
    const ms = safeDateMs(row.snapshot_at);
    return ms != null && ms > latestLiveMs;
  });
}

function buildHealthRows({
  portfolios,
  snapshotsByPortfolio,
  nowMs,
  staleLiveMs,
  minHistoryAgeMs,
}: {
  portfolios: PortfolioRow[];
  snapshotsByPortfolio: Map<string, SnapshotRow[]>;
  nowMs: number;
  staleLiveMs: number;
  minHistoryAgeMs: number;
}) {
  return portfolios.map<PortfolioHealth>((portfolio) => {
    const snapshotRows = snapshotsByPortfolio.get(portfolio.id) ?? [];
    const latestLiveMs = latestLiveSnapshotMs(snapshotRows);
    const hasLive = latestLiveMs != null;
    const hasHistorical = snapshotRows.some((row) => isHistoricalSource(row.source));
    const createdMs = safeDateMs(portfolio.created_at) ?? nowMs;
    const oldEnoughForHistory = nowMs - createdMs >= minHistoryAgeMs;

    return {
      portfolio,
      snapshotRows,
      hasLive,
      latestLiveMs,
      hasHistorical,
      hasInvalidSnapshot: hasInvalidSnapshot(snapshotRows),
      hasHistoricalAfterLive: hasHistoricalAfterLive(snapshotRows, latestLiveMs),
      isLiveStale: !hasLive || nowMs - latestLiveMs > staleLiveMs,
      isMissingHistorical: oldEnoughForHistory && !hasHistorical,
    };
  });
}

function priceMapFromRows(rows: Array<{ ticker: string | null; price: number | null }>) {
  return new Map(
    rows
      .map((row) => [cleanTicker(row.ticker), toNumber(row.price, 0)] as const)
      .filter(([ticker, price]) => Boolean(ticker) && price > 0),
  );
}

async function repairLiveSnapshots({
  supabase,
  portfolios,
  holdingsByPortfolio,
  priceMap,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  portfolios: PortfolioRow[];
  holdingsByPortfolio: Map<string, HoldingRow[]>;
  priceMap: Map<string, number>;
}) {
  let repaired = 0;
  let failed = 0;

  for (const portfolio of portfolios) {
    const holdings = holdingsByPortfolio.get(portfolio.id) ?? [];
    const currentPrices = Object.fromEntries(
      Array.from(new Set(holdings.map((holding) => cleanTicker(holding.ticker)).filter(Boolean))).map((ticker) => [
        ticker,
        priceMap.get(ticker) ?? 0,
      ]),
    );

    const currentPoint = buildCurrentPortfolioSnapshotPoint({
      portfolio,
      holdings,
      currentPrices,
    });

    const ok = await saveLatestPortfolioSnapshotFromChartData({
      supabase,
      portfolioId: portfolio.id,
      userId: portfolio.user_id,
      chartData: buildMinimalCurrentChartData(currentPoint),
      source: "health_repair_live",
    });

    if (ok) repaired += 1;
    else failed += 1;
  }

  return { repaired, failed };
}

async function repairHistoricalBackfill({
  supabase,
  healthRows,
  holdingsByPortfolio,
  transactionsByPortfolio,
  priceMap,
  limit,
  liveBufferMs,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  healthRows: PortfolioHealth[];
  holdingsByPortfolio: Map<string, HoldingRow[]>;
  transactionsByPortfolio: Map<string, TransactionRow[]>;
  priceMap: Map<string, number>;
  limit: number;
  liveBufferMs: number;
}) {
  let repaired = 0;
  let failed = 0;
  const selected = healthRows
    .filter((row) => row.isMissingHistorical)
    .sort((a, b) => (safeDateMs(a.portfolio.created_at) ?? 0) - (safeDateMs(b.portfolio.created_at) ?? 0))
    .slice(0, Math.max(0, limit));

  for (const row of selected) {
    const portfolio = row.portfolio;
    const holdings = holdingsByPortfolio.get(portfolio.id) ?? [];
    const transactions = transactionsByPortfolio.get(portfolio.id) ?? [];
    const currentPrices = Object.fromEntries(
      Array.from(new Set(holdings.map((holding) => cleanTicker(holding.ticker)).filter(Boolean))).map((ticker) => [
        ticker,
        priceMap.get(ticker) ?? 0,
      ]),
    );
    const cutoffMs = (row.latestLiveMs ?? Date.now()) - Math.max(0, liveBufferMs);

    try {
      const chartData = await buildPortfolioValueTimeline({
        portfolio,
        holdings,
        transactions,
        currentPrices,
      });

      const ok = await savePortfolioSnapshotsFromChartData({
        supabase,
        portfolioId: portfolio.id,
        userId: portfolio.user_id,
        chartData,
        source: "backfill",
        maxSnapshotAtBefore: new Date(cutoffMs),
      });

      if (ok) repaired += 1;
      else failed += 1;
    } catch (error) {
      console.warn("Portfolio health backfill repair failed", error);
      failed += 1;
    }
  }

  return { selected: selected.length, repaired, failed };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const nowMs = Date.now();
  const repair = req.nextUrl.searchParams.get("repair") !== "0";
  const portfolioLimit = Number(req.nextUrl.searchParams.get("portfolioLimit") ?? process.env.PORTFOLIO_HEALTH_PORTFOLIO_LIMIT ?? 500);
  const repairLimit = Number(req.nextUrl.searchParams.get("repairLimit") ?? process.env.PORTFOLIO_HEALTH_REPAIR_LIMIT ?? 2);
  const liveRepairLimit = Number(req.nextUrl.searchParams.get("liveRepairLimit") ?? process.env.PORTFOLIO_HEALTH_LIVE_REPAIR_LIMIT ?? 20);
  const staleLiveMs = Number(process.env.PORTFOLIO_HEALTH_STALE_LIVE_MS ?? DEFAULT_STALE_LIVE_MS);
  const minHistoryAgeMs = Number(process.env.PORTFOLIO_HEALTH_MIN_HISTORY_AGE_MS ?? DEFAULT_MIN_HISTORY_AGE_MS);
  const liveBufferMs = Number(process.env.PORTFOLIO_BACKFILL_LIVE_BUFFER_MS ?? DEFAULT_BACKFILL_LIVE_BUFFER_MS);

  const { data: portfolioRows, error: portfolioError } = await supabase
    .from("user_portfolios")
    .select("id,user_id,cash_balance,cash_deposited_total,investment_amount,created_at")
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(portfolioLimit);

  if (portfolioError) {
    return NextResponse.json({ error: "Could not load portfolios" }, { status: 500 });
  }

  const portfolios = (portfolioRows ?? []) as PortfolioRow[];
  const portfolioIds = portfolios.map((portfolio) => portfolio.id);

  if (portfolioIds.length === 0) {
    return NextResponse.json({ ok: true, portfolios: 0, issues: {}, repairs: {} });
  }

  const [{ data: snapshotRows, error: snapshotError }, { data: holdingRows, error: holdingsError }, { data: transactionRows, error: transactionError }] = await Promise.all([
    supabase
      .from("portfolio_snapshots")
      .select("portfolio_id,source,snapshot_at,value,cash,basis")
      .in("portfolio_id", portfolioIds)
      .order("snapshot_at", { ascending: false })
      .limit(Number(process.env.PORTFOLIO_HEALTH_SNAPSHOT_SCAN_LIMIT ?? 25_000)),
    supabase
      .from("portfolio_holdings")
      .select("portfolio_id,ticker,shares,entry_price,purchase_date,added_at")
      .in("portfolio_id", portfolioIds)
      .not("ticker", "is", null),
    supabase
      .from("portfolio_transactions")
      .select("portfolio_id,ticker,type,shares,price,amount,realised_pnl,created_at")
      .in("portfolio_id", portfolioIds)
      .order("created_at", { ascending: true })
      .limit(Number(process.env.PORTFOLIO_HEALTH_TRANSACTION_SCAN_LIMIT ?? 25_000)),
  ]);

  if (snapshotError || holdingsError || transactionError) {
    return NextResponse.json({ error: "Could not load portfolio health inputs" }, { status: 500 });
  }

  const snapshotsByPortfolio = groupByPortfolio((snapshotRows ?? []) as SnapshotRow[]);
  const holdings = (holdingRows ?? []) as HoldingRow[];
  const holdingsByPortfolio = groupByPortfolio(holdings);
  const transactionsByPortfolio = groupByPortfolio((transactionRows ?? []) as TransactionRow[]);
  const tickers = Array.from(new Set(holdings.map((holding) => cleanTicker(holding.ticker)).filter(Boolean)));
  const { data: currentRows } =
    tickers.length > 0
      ? await supabase.from("stock_rankings").select("ticker,price").in("ticker", tickers)
      : { data: [] };
  const priceMap = priceMapFromRows((currentRows ?? []) as Array<{ ticker: string | null; price: number | null }>);

  const healthRows = buildHealthRows({
    portfolios,
    snapshotsByPortfolio,
    nowMs,
    staleLiveMs,
    minHistoryAgeMs,
  });

  const staleLive = healthRows.filter((row) => row.isLiveStale);
  const missingHistorical = healthRows.filter((row) => row.isMissingHistorical);
  const invalidSnapshots = healthRows.filter((row) => row.hasInvalidSnapshot);
  const historicalAfterLive = healthRows.filter((row) => row.hasHistoricalAfterLive);
  const activeWithoutSnapshots = healthRows.filter((row) => row.snapshotRows.length === 0);

  let liveRepairs = { repaired: 0, failed: 0 };
  let historicalRepairs = { selected: 0, repaired: 0, failed: 0 };

  if (repair) {
    liveRepairs = await repairLiveSnapshots({
      supabase,
      portfolios: staleLive.slice(0, Math.max(0, liveRepairLimit)).map((row) => row.portfolio),
      holdingsByPortfolio,
      priceMap,
    });

    historicalRepairs = await repairHistoricalBackfill({
      supabase,
      healthRows,
      holdingsByPortfolio,
      transactionsByPortfolio,
      priceMap,
      limit: repairLimit,
      liveBufferMs,
    });
  }

  return NextResponse.json({
    ok: true,
    checkedAt: new Date(nowMs).toISOString(),
    repair,
    portfolios: portfolios.length,
    issues: {
      activeWithoutSnapshots: activeWithoutSnapshots.length,
      staleLive: staleLive.length,
      missingHistorical: missingHistorical.length,
      invalidSnapshots: invalidSnapshots.length,
      historicalAfterLive: historicalAfterLive.length,
    },
    repairs: {
      live: liveRepairs,
      historical: historicalRepairs,
    },
  });
}
