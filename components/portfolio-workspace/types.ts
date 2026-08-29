import type { ChartPoint, TimeRange } from "@/components/StockChart";
import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import type { PortfolioChartMeta } from "@/lib/portfolio-chart-health";
import type { PortfolioIntelligenceView } from "@/lib/portfolio-intelligence-presentation";

export type PortfolioSection = "overview" | "holdings" | "activity";
export type HoldingsView = "list" | "map";
export type ExposureView = "map" | "treemap";
export type HoldingFilter =
  | "all"
  | "urgent_review"
  | "review"
  | "monitor"
  | "on_track"
  | "concentration"
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
export type ActivityFilter = "all" | "purchases" | "sales" | "cash" | "other";

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
  occurredAt: string | null;
  recordedAt: string;
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

export type HoldingReferenceLevels = {
  entryPrice: number | null;
  savedRiskLevel: number | null;
  savedTargetLevel: number | null;
};

export type PortfolioWorkspaceProps = {
  portfolioId: string;
  portfolios: PortfolioOption[];
  portfolioMeta: PortfolioMeta;
  intelligence: PortfolioIntelligenceView;
  holdingReferenceLevels: Record<string, HoldingReferenceLevels>;
  summary: PortfolioHealthSummary;
  holdings: ExtendedHolding[];
  stockOptions: StockOption[];
  transactions: PortfolioTransaction[];
  chartData: Partial<Record<TimeRange, ChartPoint[]>>;
  chartMeta: PortfolioChartMeta;
  usdToDisplayRate: number;
  canUsePremium: boolean;
  initialSection: PortfolioSection;
};

export type ActivityItem = {
  id: string;
  kind: "purchase" | "sale" | "cash" | "other";
  date: string;
  ticker: string | null;
  title: string;
  detail: string;
  tone: "positive" | "negative" | "neutral" | "warning";
};
