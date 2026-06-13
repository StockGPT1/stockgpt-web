import { createClient } from "@/utils/supabase/server";
import { saveUnreadNotificationSummary } from "@/lib/notification-summary";
import {
  enrichHoldings,
  type AlertSeverity,
  type AlertType,
  type HoldingAlert,
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

const LOWER_ENTRY_LEVEL_PCT = 0.08;
const UPPER_ENTRY_LEVEL_PCT = 0.14;

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

function buildLevelKey({
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

function buildLegacyLevelKey(ticker: string, type: string, level: number): string {
  return `${ticker}:${type}:${level.toFixed(2)}`;
}

function stripInternal(notification: BuiltNotification): Notification {
  const { dismissalKeys: _dismissalKeys, ...clean } = notification;
  return clean;
}

function buildTrimNotification({
  portfolioId,
  portfolioName,
  ticker,
  company,
  alert,
  today,
}: {
  portfolioId: string;
  portfolioName: string;
  ticker: string;
  company: string | null;
  alert: HoldingAlert;
  today: string;
}): BuiltNotification {
  const key = buildAlertKey({
    portfolioId,
    ticker,
    type: alert.type,
    dateStr: today,
  });

  return {
    key,
    dismissalKeys: [key, buildLegacyAlertKey(ticker, alert.type, today)],
    portfolioId,
    portfolioName,
    ticker,
    company,
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    recommendation: alert.recommendation,
    createdAt: today,
  };
}

function buildEntryLevelNotifications({
  portfolioId,
  portfolioName,
  ticker,
  company,
  currentPrice,
  entryPrice,
  today,
}: {
  portfolioId: string;
  portfolioName: string;
  ticker: string;
  company: string | null;
  currentPrice: number;
  entryPrice: number;
  today: string;
}): BuiltNotification[] {
  if (
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0 ||
    !Number.isFinite(entryPrice) ||
    entryPrice <= 0
  ) {
    return [];
  }

  const lowerLevel = entryPrice * (1 - LOWER_ENTRY_LEVEL_PCT);
  const upperLevel = entryPrice * (1 + UPPER_ENTRY_LEVEL_PCT);
  const notifications: BuiltNotification[] = [];

  if (currentPrice <= lowerLevel) {
    const key = buildLevelKey({
      portfolioId,
      ticker,
      type: "entry_lower_level_hit",
      level: lowerLevel,
    });

    notifications.push({
      key,
      dismissalKeys: [
        key,
        buildLegacyLevelKey(ticker, "entry_lower_level_hit", lowerLevel),
        buildLegacyLevelKey(ticker, "stop_loss_hit", lowerLevel),
      ],
      portfolioId,
      portfolioName,
      ticker,
      company,
      type: "price_event",
      severity: "critical",
      title: `${ticker} has hit its lower entry level`,
      message: `Current price is $${currentPrice.toFixed(
        2,
      )}, below the original lower level near $${lowerLevel.toFixed(2)}.`,
      recommendation:
        "Review the position against the original buy-time risk level before taking any further action.",
      createdAt: today,
    });
  }

  if (currentPrice >= upperLevel) {
    const key = buildLevelKey({
      portfolioId,
      ticker,
      type: "entry_upper_level_hit",
      level: upperLevel,
    });

    notifications.push({
      key,
      dismissalKeys: [
        key,
        buildLegacyLevelKey(ticker, "entry_upper_level_hit", upperLevel),
        buildLegacyLevelKey(ticker, "take_profit_hit", upperLevel),
      ],
      portfolioId,
      portfolioName,
      ticker,
      company,
      type: "price_event",
      severity: "success",
      title: `${ticker} has hit its upper entry level`,
      message: `Current price is $${currentPrice.toFixed(
        2,
      )}, above the original upper level near $${upperLevel.toFixed(2)}.`,
      recommendation:
        "Review whether the original buy-time target has been met and whether the position size still makes sense.",
      createdAt: today,
    });
  }

  return notifications;
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
    await saveUnreadNotificationSummary(user.id, 0);
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
    await saveUnreadNotificationSummary(user.id, 0);
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
        holding.alerts
          .filter((alert: HoldingAlert) => alert.type === "trim_action")
          .forEach((alert: HoldingAlert) => {
            allNotifications.push(
              buildTrimNotification({
                portfolioId: portfolio.id,
                portfolioName,
                ticker: holding.ticker,
                company: holding.company,
                alert,
                today,
              }),
            );
          });

        allNotifications.push(
          ...buildEntryLevelNotifications({
            portfolioId: portfolio.id,
            portfolioName,
            ticker: holding.ticker,
            company: holding.company,
            currentPrice: holding.currentPrice,
            entryPrice: holding.entryPrice,
            today,
          }),
        );
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

  await saveUnreadNotificationSummary(user.id, unread.length);

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
