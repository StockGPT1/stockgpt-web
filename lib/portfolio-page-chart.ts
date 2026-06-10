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

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

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
  const endValue = roundMoney(basis + summary.totalPnl);

  const maxPoints = [
    { date: new Date(createdAtMs).toISOString(), close: roundMoney(basis) },
    { date: new Date(now).toISOString(), close: Math.max(0, endValue) },
  ];

  const intradayStart = roundMoney(Math.max(0, endValue - summary.dayChange));
  const intradayPoints = [
    { date: new Date(now - 86_400_000).toISOString(), close: intradayStart },
    { date: new Date(now).toISOString(), close: Math.max(0, endValue) },
  ];

  return {
    MAX: maxPoints,
    "1D": intradayPoints,
    "1M": maxPoints,
    "6M": maxPoints,
    "1Y": maxPoints,
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

  // Keep portfolio initial render fast. Detailed contribution-adjusted chart reconstruction
  // previously fetched historical data for every holding and could block mobile loads.
  return fallbackPortfolioChart(summary, createdAtMs);
}
