import type { ChartPoint, TimeRange } from "@/components/StockChart";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import type { EnrichedHolding } from "@/lib/portfolio-alerts";
import {
  getLatestPortfolioChart,
  saveLatestPortfolioChart,
} from "@/lib/portfolio-chart-cache";
import { buildPortfolioValueTimeline } from "@/lib/portfolio-value-timeline";
import { getCachedStockChart } from "@/lib/yahoo";

type PortfolioLike = {
  id: string;
  name: string | null;
  risk_tolerance: string | null;
  time_horizon: string | null;
  investment_amount: number | null;
  cash_balance: number | null;
  cash_deposited_total?: number | null;
  currency: string | null;
  created_at?: string | null;
};

type TransactionLike = {
  id?: string | null;
  portfolio_id?: string | null;
  ticker?: string | null;
  type?: string | null;
  shares?: number | null;
  price?: number | null;
  amount?: number | null;
  realised_pnl?: number | null;
  currency?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function buildPortfolioPageChart({
  portfolio,
  enriched,
  transactions,
  summary,
}: {
  portfolio: PortfolioLike;
  enriched: EnrichedHolding[];
  transactions: TransactionLike[];
  summary: PortfolioHealthSummary;
}): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  const cachedChart = await getLatestPortfolioChart({ portfolioId: portfolio.id, summary });
  if (cachedChart) return cachedChart;

  const chartData = await buildPortfolioValueTimeline({
    portfolio: {
      id: portfolio.id,
      cash_balance: portfolio.cash_balance,
      created_at: portfolio.created_at,
    },
    holdings: enriched.map((holding) => ({
      ticker: holding.ticker,
      shares: holding.shares,
      entryPrice: holding.entryPrice,
      currentPrice: holding.currentPrice,
      currentValue: holding.currentValue,
      purchaseDate: holding.purchaseDate,
      addedAt: holding.addedAt,
    })),
    transactions,
    currentPrices: Object.fromEntries(
      enriched.map((holding) => [holding.ticker, toNumber(holding.currentPrice, 0)]),
    ),
    priceFetcher: getCachedStockChart,
  });

  await saveLatestPortfolioChart({
    portfolioId: portfolio.id,
    summary,
    chartData,
  });

  return chartData;
}
