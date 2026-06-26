import { NextResponse, type NextRequest } from "next/server";
import { buildPortfolioHealthSummary } from "@/lib/portfolio-health";
import { buildPortfolioPageChart } from "@/lib/portfolio-page-chart";
import { enrichHoldingsAdmin, type RiskTolerance } from "@/lib/portfolio-alerts";
import {
  getCachedPortfolioNews,
  getCachedPortfolioStockUniverse,
  hashPortfolioInputs,
  savePortfolioPageSnapshot,
} from "@/lib/portfolio-speed-cache";
import {
  enrichArticleWithStockInsights,
  type BaseNewsArticle,
  type StockLike,
} from "@/lib/news-intelligence";
import { redisCommand } from "@/lib/redis";
import { createAdminClient } from "@/utils/supabase/admin";
import { isAuthorizedCron, unauthorizedCron } from "@/lib/security/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PORTFOLIO_SNAPSHOT_VERSION = "portfolio-fast-v10";

type StockRecord = {
  ticker?: string | null;
  company?: string | null;
  sector?: string | null;
  rank?: string | number | null;
  score?: string | number | null;
  price?: string | number | null;
};

type WarmPortfolioRow = {
  id: string;
  user_id: string;
  name: string | null;
  risk_tolerance: string | null;
  time_horizon: string | null;
  investment_amount: number | string | null;
  cash_balance: number | string | null;
  cash_deposited_total: number | string | null;
  currency: string | null;
  created_at: string | null;
};

type WarmHoldingRow = {
  portfolio_id: string;
  ticker: string | null;
  entry_price: number | null;
  score_at_entry: number | null;
  rank_at_entry: number | null;
  added_at: string | null;
  last_reviewed_at: string | null;
  shares: number | null;
  allocation_pct: number | null;
  purchase_date: string | null;
  source: string | null;
  notes: string | null;
};

type WarmTransactionRow = {
  id: string;
  portfolio_id: string;
  ticker: string | null;
  type: string;
  shares: number | null;
  price: number | null;
  amount: number | null;
  realised_pnl: number | null;
  currency: string | null;
  notes: string | null;
  created_at: string;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanTicker(ticker?: string | null) {
  return String(ticker ?? "").trim().toUpperCase();
}

function parseAffectedTickers(value: BaseNewsArticle["affected_tickers"]) {
  if (Array.isArray(value)) return value.map((ticker) => cleanTicker(String(ticker))).filter(Boolean);
  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map((ticker) => cleanTicker(String(ticker))).filter(Boolean);
  } catch {
    // Fallback to simple splitting below.
  }

  return trimmed.split(/[\s,;|]+/).map((ticker) => cleanTicker(ticker)).filter(Boolean);
}

function buildPortfolioNews({
  newsData,
  stockUniverse,
  portfolioTickerSet,
}: {
  newsData: BaseNewsArticle[];
  stockUniverse: StockLike[];
  portfolioTickerSet: Set<string>;
}) {
  const portfolioStocks = stockUniverse.filter((stock) => portfolioTickerSet.has(cleanTicker(stock.ticker)));
  const knownPortfolioTickers = new Set(portfolioStocks.map((stock) => cleanTicker(stock.ticker)));

  portfolioTickerSet.forEach((ticker) => {
    if (knownPortfolioTickers.has(ticker)) return;
    portfolioStocks.push({ ticker, company: null, sector: null, rank: null, score: null, price: null });
  });

  return newsData
    .map((article) => {
      const directTickers = parseAffectedTickers(article.affected_tickers);
      const hasDirectPortfolioMatch = directTickers.some((ticker) => portfolioTickerSet.has(ticker));
      const enriched = enrichArticleWithStockInsights(article, portfolioStocks, 10);
      return { enriched, hasDirectPortfolioMatch };
    })
    .filter(({ enriched, hasDirectPortfolioMatch }) => {
      if (hasDirectPortfolioMatch) return true;
      return enriched.affectedStocks.some((stock) => portfolioTickerSet.has(stock.ticker));
    })
    .sort(
      (a, b) =>
        new Date(b.enriched.published_at ?? 0).getTime() -
        new Date(a.enriched.published_at ?? 0).getTime(),
    )
    .slice(0, 30)
    .map(({ enriched }) => enriched);
}

function groupByPortfolio<T extends { portfolio_id: string }>(rows: T[]) {
  return rows.reduce((map, row) => {
    const list = map.get(row.portfolio_id) ?? [];
    list.push(row);
    map.set(row.portfolio_id, list);
    return map;
  }, new Map<string, T[]>());
}

export async function GET(req: NextRequest) {
  const startedAt = performance.now();
  if (!isAuthorizedCron(req)) return unauthorizedCron();

  const supabase = createAdminClient();
  const redisPing = await redisCommand<string>(["PING"]);
  const [stockOptionsData, newsData] = await Promise.all([
    getCachedPortfolioStockUniverse(),
    getCachedPortfolioNews(),
  ]);

  const stockRows = (stockOptionsData ?? []) as StockRecord[];
  const newsRows = (newsData ?? []) as BaseNewsArticle[];
  const portfolioLimit = Number(req.nextUrl.searchParams.get("limit") ?? process.env.PORTFOLIO_CACHE_WARM_PORTFOLIO_LIMIT ?? 25);
  const requestedPortfolioId = req.nextUrl.searchParams.get("portfolioId");

  let portfolioQuery = supabase
    .from("user_portfolios")
    .select("id,user_id,name,risk_tolerance,time_horizon,investment_amount,cash_balance,cash_deposited_total,currency,created_at")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(portfolioLimit);

  if (requestedPortfolioId) {
    portfolioQuery = portfolioQuery.eq("id", requestedPortfolioId).limit(1);
  }

  const { data: portfoliosData, error: portfoliosError } = await portfolioQuery;

  if (portfoliosError) {
    return NextResponse.json({ error: "Could not load portfolios" }, { status: 500 });
  }

  const portfolios = (portfoliosData ?? []) as WarmPortfolioRow[];
  const portfolioIds = portfolios.map((portfolio) => String(portfolio.id)).filter(Boolean);

  if (portfolioIds.length === 0) {
    console.info("[portfolio-cache-warm] portfoliosScanned=0 warmed=0 failed=0 elapsedMs=0");
    return NextResponse.json({ ok: true, mode: "portfolio-page-snapshots", redis: redisPing === "PONG" ? "ok" : "miss", portfolios: 0, warmed: 0, failed: 0 });
  }

  const [{ data: holdingRows, error: holdingsError }, { data: transactionRows, error: transactionsError }] = await Promise.all([
    supabase
      .from("portfolio_holdings")
      .select("portfolio_id,ticker,entry_price,score_at_entry,rank_at_entry,added_at,last_reviewed_at,shares,allocation_pct,purchase_date,source,notes")
      .in("portfolio_id", portfolioIds)
      .not("ticker", "is", null),
    supabase
      .from("portfolio_transactions")
      .select("id,portfolio_id,ticker,type,shares,price,amount,realised_pnl,currency,notes,created_at")
      .in("portfolio_id", portfolioIds)
      .order("created_at", { ascending: true })
      .limit(Number(process.env.PORTFOLIO_CACHE_WARM_TRANSACTION_LIMIT ?? 5000)),
  ]);

  if (holdingsError || transactionsError) {
    return NextResponse.json({ error: "Could not load portfolio inputs" }, { status: 500 });
  }

  const holdingsByPortfolio = groupByPortfolio((holdingRows ?? []) as WarmHoldingRow[]);
  const transactionsByPortfolio = groupByPortfolio((transactionRows ?? []) as WarmTransactionRow[]);
  const stockUniverse: StockLike[] = stockRows
    .filter((stock) => stock.ticker)
    .map((stock) => ({
      ticker: cleanTicker(stock.ticker),
      company: stock.company ? String(stock.company) : null,
      sector: stock.sector ? String(stock.sector) : null,
      rank: stock.rank == null ? null : Number(stock.rank),
      score: stock.score ?? null,
      price: stock.price ?? null,
    }));

  let warmed = 0;
  let failed = 0;

  for (const portfolio of portfolios) {
    try {
      const portfolioId = String(portfolio.id);
      const rawHoldings = (holdingsByPortfolio.get(portfolioId) ?? []).map((holding) => ({
        ticker: cleanTicker(holding.ticker),
        entry_price: holding.entry_price,
        score_at_entry: holding.score_at_entry,
        rank_at_entry: holding.rank_at_entry,
        shares: holding.shares,
        allocation_pct: holding.allocation_pct,
        added_at: holding.added_at ?? new Date().toISOString(),
        last_reviewed_at: holding.last_reviewed_at ?? holding.added_at ?? new Date().toISOString(),
        purchase_date: holding.purchase_date ?? null,
        source: holding.source ?? "manual",
        notes: holding.notes ?? null,
      }));
      const transactions = transactionsByPortfolio.get(portfolioId) ?? [];
      const portfolioTickerSet = new Set(rawHoldings.map((holding) => holding.ticker));
      const cashDepositedTotal = toNumber(portfolio.cash_deposited_total, toNumber(portfolio.investment_amount, 0));
      const currency = portfolio.currency ?? "USD";
      const normalisedPortfolio = {
        ...portfolio,
        name: portfolio.name ?? "Portfolio",
        cash_balance: toNumber(portfolio.cash_balance, 0),
        cash_deposited_total: cashDepositedTotal,
        investment_amount: toNumber(portfolio.investment_amount, 0),
        currency,
      };
      const inputHash = hashPortfolioInputs({
        version: PORTFOLIO_SNAPSHOT_VERSION,
        portfolio: normalisedPortfolio,
        holdings: rawHoldings,
        transactions,
      });
      const riskTolerance = (portfolio.risk_tolerance as RiskTolerance) ?? null;
      const enriched = await enrichHoldingsAdmin(rawHoldings, riskTolerance);
      const portfolioNews = buildPortfolioNews({ newsData: newsRows, stockUniverse, portfolioTickerSet });
      const summary = buildPortfolioHealthSummary({
        id: portfolioId,
        name: normalisedPortfolio.name,
        currency,
        riskTolerance: portfolio.risk_tolerance,
        holdings: enriched,
        transactions: transactions.map((transaction) => ({ realisedPnl: transaction.realised_pnl })),
        cashBalance: normalisedPortfolio.cash_balance,
        cashDepositedTotal,
      });
      const chartData = await buildPortfolioPageChart({
        portfolio: {
          id: portfolioId,
          name: normalisedPortfolio.name,
          risk_tolerance: portfolio.risk_tolerance,
          time_horizon: portfolio.time_horizon,
          investment_amount: normalisedPortfolio.investment_amount,
          cash_balance: normalisedPortfolio.cash_balance,
          cash_deposited_total: cashDepositedTotal,
          currency,
          created_at: portfolio.created_at ?? null,
          user_id: portfolio.user_id,
        },
        enriched,
        transactions,
        summary,
        ownerId: portfolio.user_id,
      });

      await savePortfolioPageSnapshot({
        portfolioId,
        ownerId: portfolio.user_id,
        inputHash,
        snapshot: { enriched, summary, chartData, portfolioNews },
      });
      warmed += 1;
    } catch (error) {
      console.warn("Portfolio page snapshot warm failed", error);
      failed += 1;
    }
  }

  const elapsedMs = Math.round(performance.now() - startedAt);
  console.info(
    `[portfolio-cache-warm] portfoliosScanned=${portfolios.length} warmed=${warmed} failed=${failed} elapsedMs=${elapsedMs}`,
  );

  return NextResponse.json({
    ok: true,
    mode: "portfolio-page-snapshots",
    redis: redisPing === "PONG" ? "ok" : "miss",
    portfolios: portfolios.length,
    warmed,
    failed,
  });
}
