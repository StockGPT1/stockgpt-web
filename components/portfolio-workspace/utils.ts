import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import type { PortfolioChartMeta } from "@/lib/portfolio-chart-health";
import type {
  ActivityItem,
  PortfolioTransaction,
} from "@/components/portfolio-workspace/types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function money(value: number, currency: string, compact = false) {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    notation: compact && Math.abs(safe) >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(safe) >= 1000 ? 0 : 2,
  }).format(safe);
}

export function signedMoney(value: number, currency: string) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe >= 0 ? "+" : "−"}${money(Math.abs(safe), currency)}`;
}

export function signedPct(value: number, digits = 1) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe >= 0 ? "+" : ""}${safe.toFixed(digits)}%`;
}

export function number(value: number, digits = 4) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return withTime
    ? date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export function relativeFreshness(value: string | null | undefined) {
  if (!value) return "Update time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Update time unavailable";
  const diff = Date.now() - date.getTime();
  if (diff >= 0 && diff < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(diff / 60_000));
    return `Updated ${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }
  if (diff >= 0 && diff < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.round(diff / (60 * 60 * 1000)));
    return `Updated ${hours} hr${hours === 1 ? "" : "s"} ago`;
  }
  return `Updated ${formatDate(value)}`;
}

export function freshnessCopy(meta: PortfolioChartMeta) {
  const state = meta.health.displayState;
  if (state === "ready") return relativeFreshness(meta.health.latestSnapshotAt);
  if (state === "updating") return "Refreshing portfolio data";
  if (state === "building") return "Building chart history";
  if (state === "repairing") return "Repairing chart history";
  if (state === "error_with_cache") return "Showing cached chart";
  if (state === "error_no_cache") return "Chart history unavailable";
  if (state === "empty") return "Add holdings to begin";
  return "Portfolio data available";
}

export function toneClass(value: number) {
  if (value > 0.0001) return "text-[#61d7ab]";
  if (value < -0.0001) return "text-[#f1908d]";
  return "text-[#faf6f0]/52";
}

export function toneBackground(value: number) {
  if (value > 0.0001) return "bg-[#61d7ab]/12 text-[#61d7ab]";
  if (value < -0.0001) return "bg-[#f1908d]/12 text-[#f1908d]";
  return "bg-[#faf6f0]/6 text-[#faf6f0]/58";
}

export function statusForHolding(
  holding: ExtendedHolding,
  riskTolerance: string | null,
) {
  if (holding.currentPrice <= 0 && holding.shares > 0) return "Price unavailable";
  if (holding.actionAlerts.length > 0) {
    return holding.actionAlerts[0]?.action === "trim" ? "Review size" : "Review";
  }
  const cap =
    riskTolerance === "conservative"
      ? 18
      : riskTolerance === "aggressive"
        ? 32
        : 24;
  if (holding.currentAllocationPct > cap) return "Oversized";
  if (holding.pnlPercent >= 12) return "Strong contributor";
  if (holding.pnlPercent <= -10) return "Under pressure";
  return "Healthy";
}

export function statusTone(status: string) {
  if (status === "Healthy" || status === "Strong contributor") {
    return "text-[#61d7ab]";
  }
  if (status === "Under pressure" || status === "Price unavailable") {
    return "text-[#f1908d]";
  }
  if (status === "Review" || status === "Review size" || status === "Oversized") {
    return "text-[#e8bd61]";
  }
  return "text-[#faf6f0]/48";
}

export function transactionTitle(type: string, ticker: string | null) {
  if (type === "deposit") return "Cash added";
  if (type === "withdrawal") return "Cash withdrawn";
  if (type === "buy") return ticker ? `Bought ${ticker}` : "Holding bought";
  if (type === "sell") return ticker ? `Sold ${ticker}` : "Holding sold";
  if (type === "import") return "Portfolio imported";
  if (type === "log_existing") return ticker ? `Added ${ticker}` : "Holding added";
  if (type === "adjustment") return ticker ? `Adjusted ${ticker}` : "Holding adjusted";
  if (type === "cash_adjustment") return "Cash adjusted";
  return type.replace(/_/g, " ");
}

export function transactionDetail(
  transaction: PortfolioTransaction,
  currency: string,
) {
  if (transaction.shares != null && transaction.price != null) {
    return `${number(transaction.shares, 6)} shares at ${money(transaction.price, currency)}`;
  }
  if (transaction.amount != null) return money(transaction.amount, currency);
  return transaction.notes ?? "Portfolio activity";
}

export function buildActivityItems(
  transactions: PortfolioTransaction[],
  holdings: ExtendedHolding[],
  currency: string,
): ActivityItem[] {
  const transactionItems: ActivityItem[] = transactions.map((transaction) => ({
    id: `transaction-${transaction.id}`,
    kind: "transaction",
    date: transaction.createdAt,
    ticker: transaction.ticker,
    title: transactionTitle(transaction.type, transaction.ticker),
    detail: transactionDetail(transaction, currency),
    tone:
      transaction.type === "deposit" || transaction.type === "buy"
        ? "positive"
        : transaction.type === "withdrawal" || transaction.type === "sell"
          ? "negative"
          : "neutral",
  }));

  const alertItems: ActivityItem[] = holdings.flatMap((holding) => [
    ...holding.actionAlerts.map((alert) => ({
      id: `action-${holding.ticker}-${alert.id}`,
      kind: "review" as const,
      date: alert.triggeredAt ?? alert.dataUpdatedAt ?? alert.generatedAt ?? holding.lastReviewedAt,
      ticker: holding.ticker,
      title: alert.title || `${holding.ticker} review triggered`,
      detail: alert.recommendation || alert.message,
      tone: alert.severity === "critical" ? "negative" as const : "warning" as const,
    })),
    ...holding.eventAlerts.map((alert) => ({
      id: `event-${holding.ticker}-${alert.id}`,
      kind: "ai" as const,
      date: alert.triggeredAt ?? alert.dataUpdatedAt ?? alert.generatedAt ?? holding.lastReviewedAt,
      ticker: holding.ticker,
      title: alert.title || `${holding.ticker} portfolio event`,
      detail: alert.message || alert.recommendation,
      tone:
        alert.severity === "success"
          ? "positive" as const
          : alert.severity === "critical"
            ? "negative" as const
            : "neutral" as const,
    })),
  ]);

  return [...transactionItems, ...alertItems]
    .filter((item) => Number.isFinite(new Date(item.date).getTime()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function dateGroupLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startToday.getTime() - startDate.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString("en-GB", { weekday: "long" });
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}
