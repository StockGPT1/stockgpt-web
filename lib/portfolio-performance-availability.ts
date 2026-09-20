export type PortfolioPerformanceLimitation =
  | "holding_correction"
  | "holding_removed_from_tracking"
  | "trading212_holdings_replacement"
  | "neutral_state_rewrite"
  | "connected_source_history_unavailable";

export type PortfolioPerformanceAvailability =
  | { status: "available"; limitations: [] }
  | { status: "unavailable"; limitations: PortfolioPerformanceLimitation[] };

export type PortfolioContinuityLedgerEntry = {
  type?: string | null;
  notes?: string | null;
};

export const PORTFOLIO_PERFORMANCE_UNAVAILABLE_TITLE = "Performance unavailable";
export const PORTFOLIO_PERFORMANCE_UNAVAILABLE_MESSAGE =
  "This Portfolio includes tracking changes that prevent StockGPT from calculating a reliable since-inception return from the recorded history.";

export const CONNECTED_PORTFOLIO_PERFORMANCE_UNAVAILABLE_MESSAGE =
  "Connected Portfolio performance will be available after broker history is supported.";

export function connectedPortfolioPerformanceAvailability(): PortfolioPerformanceAvailability {
  return { status: "unavailable", limitations: ["connected_source_history_unavailable"] };
}

const CORRECTION_NOTE = "Holding facts corrected.";
const REMOVAL_NOTE = "Holding removed from tracking; no sale recorded.";
const TRADING212_REPLACEMENT_NOTE =
  "Tracked holdings replaced from Trading 212 CSV; cash, net contribution and prior ledger history were preserved.";

export function assessPortfolioPerformanceAvailability(
  transactions: PortfolioContinuityLedgerEntry[],
): PortfolioPerformanceAvailability {
  const limitations = new Set<PortfolioPerformanceLimitation>();

  for (const transaction of transactions) {
    const type = String(transaction.type ?? "").trim().toLowerCase();
    const notes = String(transaction.notes ?? "").trim();

    if (type === "adjustment") {
      if (notes === CORRECTION_NOTE) limitations.add("holding_correction");
      else if (notes === REMOVAL_NOTE) limitations.add("holding_removed_from_tracking");
      else limitations.add("neutral_state_rewrite");
    } else if (type === "cash_adjustment") {
      limitations.add("neutral_state_rewrite");
    } else if (type === "import" && notes === TRADING212_REPLACEMENT_NOTE) {
      limitations.add("trading212_holdings_replacement");
    }
  }

  const ordered = Array.from(limitations).sort();
  return ordered.length === 0
    ? { status: "available", limitations: [] }
    : { status: "unavailable", limitations: ordered };
}

export function suppressUnavailablePortfolioPerformance<T extends {
  pnl?: number;
  pnlPct?: number;
}>(
  point: T,
  availability: PortfolioPerformanceAvailability,
): T | Omit<T, "pnl" | "pnlPct"> {
  if (availability.status === "available") return point;
  return { ...point, pnl: undefined, pnlPct: undefined };
}
