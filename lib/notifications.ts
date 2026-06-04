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
  portfolioId: string;
  portfolioName: string;
};

type BuiltNotification = Notification & {
  dismissalKeys: string[];
};

type PortfolioRow = {
  id: string;
  name: string | null;
  risk_tolerance: string | null;
};

type HoldingRow = {
  portfolio_id: string;
  ticker: string | null;
  entry_price: number | null;
  score_at_entry: number | null;
  rank_at_entry: number | null;
  added_at: string | null;
  last_reviewed_at: string | null;
  shares: number | null;
  allocation_pct: number | null;
  purchase_date?: string | null;
  source?: string | null;
  notes?: string | null;
};

function cleanName(name: string | null | undefined, fallback: string) {
  const value = String(name ?? "").trim();
  return value || fallback;
}

function buildAlertKey({
  portfolioId,
  ticker,
  type,
  dateStr,
}: {
  portfolioId: string;
  ticker: string;
  type: string;
  dateStr: string;
}): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const week = Math.floor(
    (d.getTime() - new Date(year, 0, 1).getTime()) /
      (7 * 24 * 60 * 60 * 1000),
  );

  return `${portfolioId}:${ticker}:${type}:${year}w${week}`;
}

function buildLegacyAlertKey(ticker: string, type: string, dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const week = Math.floor(
    (d.getTime() - new Date(year, 0, 1).getTime()) /
      (7 * 24 * 60 * 60 * 1000),
  );

  return `${ticker}:${type}:${year}w${week}`;
}

function buildTriggerKey({
  portfolioId,
  ticker,
  type,
  level,
}: {
  portfolioId: string;
  ticker: string;
  type: string;
  level: number;
}): string {
  return `${portfolioId}:${ticker}:${type}:${level.toFixed(2)}`;
}

function buildLegacyTriggerKey(ticker: string, type: string, level: number): string {
  return `${ticker}:${type}:${level.toFixed(2)}`;
}

function extractDollarLevel(text: string): number | null {
  const match = text.match(/\$([0-9]+(?:,[0-9]{3})*(?:\.\d+)?)/);
  if (!match) return null;

  const level = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(level) && level > 0 ? level : null;
}

function stripInternal(notification: BuiltNotification): Notification {
  const { dismissalKeys: _dismissalKeys, ...clean } = notification;
  return clean;
}

function buildTriggeredPriceNotification({
  portfolioId,
  portfolioName,
  ticker,
  company,
  currentPrice,
  trigger,
  today,
}: {
  portfolioId: string;
  portfolioName: string;
  ticker: string;
  company: string | null;
  currentPrice: number;
  trigger: HoldingTrigger;
  today: string;
}): BuiltNotification | null {
  const level = extractDollarLevel(trigger.condition);

  if (!level || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return null;
  }

  if (trigger.type === "take_profit" && currentPrice >= level) {
    const key = buildTriggerKey({
      portfolioId,
      ticker,
      type: "take_profit_hit",
      level,
    });

    return {
      key,
      dismissalKeys: [
        key,
        buildLegacyTriggerKey(ticker, "take_profit_hit", level),
      ],
      portfolioId,
      portfolioName,
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
    const key = buildTriggerKey({
      portfolioId,
      ticker,
      type: "stop_loss_hit",
      level,
    });

    return {
      key,
      dismissalKeys: [
        key,
        buildLegacyTriggerKey(ticker, "stop_loss_hit", level),
      ],
      portfolioId,
      portfolioName,
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

  const { data: portfoliosData } = await supabase
    .from("user_portfolios")
    .select("id, name, risk_tolerance")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  const portfolios = (portfoliosData ?? []) as PortfolioRow[];

  if (portfolios.length === 0) {
    return { unread: [], read: [], unreadCount: 0 };
  }

  const portfolioIds = portfolios.map((portfolio) => portfolio.id);

  const { data: holdingsData } = await supabase
    .from("portfolio_holdings")
    .select(
      "portfolio_id, ticker, entry_price, score_at_entry, rank_at_entry, added_at, last_reviewed_at, shares, allocation_pct, purchase_date, source, notes",
    )
    .in("portfolio_id", portfolioIds);

  const holdings = (holdingsData ?? []) as HoldingRow[];

  if (holdings.length === 0) {
    return { unread: [], read: [], unreadCount: 0 };
  }

  const { data: dismissalsData } = await supabase
    .from("notification_dismissals")
    .select("alert_key")
    .eq("user_id", user.id);

  const dismissedKeys = new Set(
    (dismissalsData ?? []).map((dismissal) => String(dismissal.alert_key)),
  );

  const today = new Date().toISOString();
  const allNotifications: BuiltNotification[] = [];

  await Promise.all(
    portfolios.map(async (portfolio, index) => {
      const portfolioHoldings = holdings.filter(
        (holding) => holding.portfolio_id === portfolio.id && holding.ticker,
      );

      if (portfolioHoldings.length === 0) return;

      const portfolioName = cleanName(portfolio.name, `Portfolio ${index + 1}`);
      const riskTolerance = (portfolio.risk_tolerance as RiskTolerance) ?? null;

      const enriched = await enrichHoldings(
        portfolioHoldings.map((holding) => ({
          ticker: String(holding.ticker).toUpperCase(),
          entry_price: holding.entry_price,
          score_at_entry: holding.score_at_entry,
          rank_at_entry: holding.rank_at_entry,
          shares: holding.shares,
          allocation_pct: holding.allocation_pct,
          added_at: holding.added_at ?? today,
          last_reviewed_at: holding.last_reviewed_at ?? holding.added_at ?? today,
          purchase_date: holding.purchase_date ?? null,
          source: holding.source ?? null,
          notes: holding.notes ?? null,
        })),
        riskTolerance,
      );

      enriched.forEach((holding) => {
        holding.alerts.forEach((alert: HoldingAlert) => {
          const key = buildAlertKey({
            portfolioId: portfolio.id,
            ticker: holding.ticker,
            type: alert.type,
            dateStr: today,
          });

          allNotifications.push({
            key,
            dismissalKeys: [
              key,
              buildLegacyAlertKey(holding.ticker, alert.type, today),
            ],
            portfolioId: portfolio.id,
            portfolioName,
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
            portfolioId: portfolio.id,
            portfolioName,
            ticker: holding.ticker,
            company: holding.company,
            currentPrice: holding.currentPrice,
            trigger,
            today,
          });

          if (notification) allNotifications.push(notification);
        });
      });
    }),
  );

  const severityOrder: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  };

  allNotifications.sort((a, b) => {
    const severityDifference = severityOrder[a.severity] - severityOrder[b.severity];

    if (severityDifference !== 0) return severityDifference;

    const portfolioDifference = a.portfolioName.localeCompare(b.portfolioName);
    if (portfolioDifference !== 0) return portfolioDifference;

    return a.ticker.localeCompare(b.ticker);
  });

  const isDismissed = (notification: BuiltNotification) =>
    notification.dismissalKeys.some((key) => dismissedKeys.has(key));

  const unread = allNotifications.filter((notification) => !isDismissed(notification));
  const read = includeDismissed
    ? allNotifications.filter((notification) => isDismissed(notification))
    : [];

  return {
    unread: unread.map(stripInternal),
    read: read.map(stripInternal),
    unreadCount: unread.length,
  };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { unreadCount } = await getUserNotifications();
  return unreadCount;
}
