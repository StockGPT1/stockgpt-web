import type { ChartPoint, TimeRange } from "@/components/StockChart";
import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import type { PortfolioChartMeta } from "@/lib/portfolio-chart-health";
import type { DashboardPortfolioOpportunity } from "@/lib/dashboard-portfolio";

export type PortfolioSection = "overview" | "holdings" | "activity";
export type HoldingsView = "list" | "map";
export type ExposureView = "map" | "treemap";
export type HoldingFilter =
  | "all"
  | "oversized"
  | "reviews"
  | "gainers"
  | "losers"
  | "missing";
export type HoldingSort =
  | "value"
  | "allocation"
  | "best"
  | "worst"
  | "score"
  | "rank"
  | "urgent"
  | "ticker";
export type ActivityFilter = "all" | "transactions" | "ai" | "reviews";

export type PortfolioOption = {
  id: string;
  name: string;
  createdAt: string | null;
};

export type StockOption = {
  ticker: string;
  company: string | null;
  sector: string | null;
  rank: number | null;
  score: number | null;
  price: number | null;
};

export type PortfolioTransaction = {
  id: string;
  portfolioId: string;
  ticker: string | null;
  type: string;
  shares: number | null;
  price: number | null;
  amount: number | null;
  realisedPnl: number | null;
  currency: string;
  notes: string | null;
  createdAt: string;
};

export type PortfolioMeta = {
  name: string;
  objective: string | null;
  riskTolerance: string | null;
  timeHorizon: string | null;
  createdAt: string | null;
  cashBalance: number;
  cashDepositedTotal: number;
  currency: string;
};

export type PortfolioWorkspaceProps = {
  portfolioId: string;
  portfolios: PortfolioOption[];
  portfolioMeta: PortfolioMeta;
  summary: PortfolioHealthSummary;
  holdings: ExtendedHolding[];
  stockOptions: StockOption[];
  transactions: PortfolioTransaction[];
  chartData: Partial<Record<TimeRange, ChartPoint[]>>;
  chartMeta: PortfolioChartMeta;
  opportunities: DashboardPortfolioOpportunity[];
  usdToDisplayRate: number;
  canUsePremium: boolean;
  initialSection: PortfolioSection;
};

export type ActivityItem = {
  id: string;
  kind: "transaction" | "ai" | "review";
  date: string;
  ticker: string | null;
  title: string;
  detail: string;
  tone: "positive" | "negative" | "neutral" | "warning";
};
