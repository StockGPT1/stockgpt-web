import type { ChartPoint, TimeRange } from "@/components/StockChart";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import type { EnrichedHolding } from "@/lib/portfolio-alerts";

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

const EPSILON = 0.000001;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function safeDateMs(value: string | null | undefined, fallbackMs = Date.now()) {
  if (!value) return fallbackMs;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : fallbackMs;
}

function displayedPerformanceBasis(summary: PortfolioHealthSummary) {
  const valueLessPnl = summary.totalValue - summary.totalPnl;
  if (Number.isFinite(valueLessPnl) && valueLessPnl > 0) return valueLessPnl;

  if (Math.abs(summary.totalPnlPct) > EPSILON) {
    const basisFromDisplayedPct = summary.totalPnl / (summary.totalPnlPct / 100);
    if (Number.isFinite(basisFromDisplayedPct) && basisFromDisplayedPct > 0) {
      return basisFromDisplayedPct;
    }
  }

  return Math.max(summary.totalValue, 1);
}

function fallbackPortfolioChart(
  summary: PortfolioHealthSummary,
  createdAtMs: number,
): Partial<Record<TimeRange, ChartPoint[]>> {
  const basis = displayedPerformanceBasis(summary);
  const now = Date.now();
  const endValue = Math.max(0, roundMoney(basis + summary.totalPnl));
  const startValue = Math.max(0, roundMoney(basis));

  const maxPoints = [
    { date: new Date(createdAtMs).toISOString(), close: startValue },
    { date: new Date(now).toISOString(), close: endValue },
  ];

  return {
    MAX: maxPoints,
  };
}

export async function buildPortfolioPageChart({
  portfolio,
  summary,
}: {
  portfolio: PortfolioLike;
  enriched: EnrichedHolding[];
  transactions: TransactionLike[];
  summary: PortfolioHealthSummary;
}): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  const createdAtMs = safeDateMs(portfolio.created_at, Date.now());

  // Keep the first render fast. Short ranges are added only when real cached
  // holding chart data is available via /api/portfolio-chart.
  return fallbackPortfolioChart(summary, createdAtMs);
}
