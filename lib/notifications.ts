import { createClient } from "@/utils/supabase/server";
import {
  enrichHoldings,
  type AlertSeverity,
  type AlertType,
  type HoldingAlert,
  type HoldingTrigger,
  type RiskTolerance,
} from "@/lib/portfolio-alerts";

export type Notification = {
  key: string;
  ticker: string;
  company: string | null;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  recommendation: string;
  createdAt: string;
};

function buildAlertKey(ticker: string, type: string, dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const week = Math.floor(
    (d.getTime() - new Date(year, 0, 1).getTime()) /
      (7 * 24 * 60 * 60 * 1000),
  );

  return `${ticker}:${type}:${year}w${week}`;
}

function buildTriggerKey(ticker: string, type: string, level: number): string {
  return `${ticker}:${type}:${level.toFixed(2)}`;
}

function extractDollarLevel(text: string): number | null {
  const match = text.match(/\$([0-9]+(?:,[0-9]{3})*(?:\.\d+)?)/);
  if (!match) return null;

  const level = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(level) && level > 0 ? level : null;
}

function buildTriggeredPriceNotification({
  ticker,
  company,
  currentPrice,
  trigger,
  today,
}: {
  ticker: string;
  company: string | null;
  currentPrice: number;
  trigger: HoldingTrigger;
  today: string;
}): Notification | null {
  const level = extractDollarLevel(trigger.condition);

  if (!level || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return null;
  }

  if (trigger.type === "take_profit" && currentPrice >= level) {
    return {
      key: buildTriggerKey(ticker, "take_profit_hit", level),
      ticker,
      company,
      type: "price_event",
      severity: "success",
      title: `${ticker} has hit its take-profit area`,
      message: `Current price is $${currentPrice.toFixed(
        2,
      )}, above the take-profit level near $${level.toFixed(2)}.`,
      recommendation: trigger.action,
      createdAt: today,
    };
  }

  if (trigger.type === "stop_loss" && currentPrice <= level) {
    return {
      key: buildTriggerKey(ticker, "stop_loss_hit", level),
      ticker,
      company,
      type: "price_event",
      severity: "critical",
      title: `${ticker} has hit its stop-loss area`,
      message: `Current price is $${currentPrice.toFixed(
        2,
      )}, below the risk level near $${level.toFixed(2)}.`,
      recommendation: trigger.action,
      createdAt: today,
    };
  }

  return null;
}

export async function getUserNotifications({
  includeDismissed = false,
}: {
  includeDismissed?: boolean;
} = {}): Promise<{
  unread: Notification[];
  read: Notification[];
  unreadCount: number;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { unread: [], read: [], unreadCount: 0 };

  const { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id, risk_tolerance")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) return { unread: [], read: [], unreadCount: 0 };

  const { data: holdingsData } = await supabase
    .from("portfolio_holdings")
    .select(
      "ticker, entry_price, score_at_entry, rank_at_entry, added_at, last_reviewed_at, shares, allocation_pct",
    )
    .eq("portfolio_id", portfolio.id);

  if (!holdingsData || holdingsData.length === 0) {
    return { unread: [], read: [], unreadCount: 0 };
  }

  const riskTolerance = (portfolio.risk_tolerance as RiskTolerance) ?? null;

  const enriched = await enrichHoldings(
    holdingsData.map((h) => ({
      ticker: h.ticker as string,
      entry_price: h.entry_price as number | null,
      score_at_entry: h.score_at_entry as number | null,
      rank_at_entry: h.rank_at_entry as number | null,
      shares: h.shares as number | null,
      allocation_pct: h.allocation_pct as number | null,
      added_at: h.added_at as string,
      last_reviewed_at: h.last_reviewed_at as string,
    })),
    riskTolerance,
  );

  const { data: dismissalsData } = await supabase
    .from("notification_dismissals")
    .select("alert_key")
    .eq("user_id", user.id);

  const dismissedKeys = new Set(
    (dismissalsData ?? []).map((dismissal) => dismissal.alert_key as string),
  );

  const today = new Date().toISOString();
  const allNotifications: Notification[] = [];

  enriched.forEach((holding) => {
    holding.alerts.forEach((alert: HoldingAlert) => {
      const key = buildAlertKey(holding.ticker, alert.type, today);

      allNotifications.push({
        key,
        ticker: holding.ticker,
        company: holding.company,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        recommendation: alert.recommendation,
        createdAt: today,
      });
    });

    holding.triggers.forEach((trigger) => {
      const notification = buildTriggeredPriceNotification({
        ticker: holding.ticker,
        company: holding.company,
        currentPrice: holding.currentPrice,
        trigger,
        today,
      });

      if (notification) allNotifications.push(notification);
    });
  });

  const severityOrder: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  };

  allNotifications.sort((a, b) => {
    const severityDifference = severityOrder[a.severity] - severityOrder[b.severity];

    return severityDifference !== 0
      ? severityDifference
      : a.ticker.localeCompare(b.ticker);
  });

  const unread = allNotifications.filter(
    (notification) => !dismissedKeys.has(notification.key),
  );

  const read = includeDismissed
    ? allNotifications.filter((notification) =>
        dismissedKeys.has(notification.key),
      )
    : [];

  return { unread, read, unreadCount: unread.length };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { unreadCount } = await getUserNotifications();
  return unreadCount;
}
