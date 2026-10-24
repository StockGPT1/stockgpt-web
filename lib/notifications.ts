import { after } from "next/server";
import { getServerViewer } from "@/lib/server-viewer";
import { saveUnreadNotificationSummary } from "@/lib/notification-summary";
import { hasUsableAlertQuote } from "@/lib/portfolio-alert-data";
import {
  enrichHoldingGroups,
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
  createdAt: string | null;
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
  risk_level_at_entry: number | null;
  target_level_at_entry: number | null;
  added_at: string | null;
  last_reviewed_at: string | null;
  shares: number | null;
  allocation_pct: number | null;
  purchase_date?: string | null;
  source?: string | null;
  notes?: string | null;
};

function persistSummaryAfterResponse(userId: string, unreadCount: number) {
  after(async () => {
    try {
      await saveUnreadNotificationSummary(userId, unreadCount);
    } catch (error) {
      console.warn("[notifications] could not persist unread summary", error);
    }
  });
}

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
  const { dismissalKeys, ...clean } = notification;
  void dismissalKeys;
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
    createdAt: alert.dataUpdatedAt ?? alert.triggeredAt ?? alert.generatedAt ?? null,
  };
}

function buildStoredTradeLevelNotifications({
  portfolioId,
  portfolioName,
  ticker,
  company,
  currentPrice,
  priceUpdatedAt,
  riskLevelAtEntry,
  targetLevelAtEntry,
}: {
  portfolioId: string;
  portfolioName: string;
  ticker: string;
  company: string | null;
  currentPrice: number;
  priceUpdatedAt: string | null | undefined;
  riskLevelAtEntry: number | null;
  targetLevelAtEntry: number | null;
}): BuiltNotification[] {
  if (!hasUsableAlertQuote(currentPrice, priceUpdatedAt)) {
    return [];
  }

  const notifications: BuiltNotification[] = [];

  if (
    riskLevelAtEntry !== null &&
    Number.isFinite(riskLevelAtEntry) &&
    riskLevelAtEntry > 0 &&
    currentPrice <= riskLevelAtEntry
  ) {
    const key = buildLevelKey({
      portfolioId,
      ticker,
      type: "entry_risk_level_hit",
      level: riskLevelAtEntry,
    });

    notifications.push({
      key,
      dismissalKeys: [
        key,
        buildLegacyLevelKey(ticker, "entry_risk_level_hit", riskLevelAtEntry),
        buildLegacyLevelKey(ticker, "stop_loss_hit", riskLevelAtEntry),
      ],
      portfolioId,
      portfolioName,
      ticker,
      company,
      type: "price_event",
      severity: "critical",
      title: `${ticker} has hit its buy-time risk level`,
      message: `Current price is $${currentPrice.toFixed(
        2,
      )}, at or below the stored buy-time risk level near $${riskLevelAtEntry.toFixed(
        2,
      )}.`,
      recommendation:
        "Review the position against the risk level saved when the holding was bought.",
      createdAt: null,
    });
  }

  if (
    targetLevelAtEntry !== null &&
    Number.isFinite(targetLevelAtEntry) &&
    targetLevelAtEntry > 0 &&
    currentPrice >= targetLevelAtEntry
  ) {
    const key = buildLevelKey({
      portfolioId,
      ticker,
      type: "entry_target_level_hit",
      level: targetLevelAtEntry,
    });

    notifications.push({
      key,
      dismissalKeys: [
        key,
        buildLegacyLevelKey(ticker, "entry_target_level_hit", targetLevelAtEntry),
        buildLegacyLevelKey(ticker, "take_profit_hit", targetLevelAtEntry),
      ],
      portfolioId,
      portfolioName,
      ticker,
      company,
      type: "price_event",
      severity: "success",
      title: `${ticker} has hit its buy-time target level`,
      message: `Current price is $${currentPrice.toFixed(
        2,
      )}, at or above the stored buy-time target level near $${targetLevelAtEntry.toFixed(
        2,
      )}.`,
      recommendation:
        "Review whether the target saved when the holding was bought has now been met.",
      createdAt: null,
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
  status: "ok" | "error" | "unauthenticated";
}> {
  const { supabase, user } = await getServerViewer();

  if (!user) return { unread: [], read: [], unreadCount: 0, status: "unauthenticated" };

  const { data: portfoliosData, error: portfoliosError } = await supabase
    .from("user_portfolios")
    .select("id, name, risk_tolerance")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (portfoliosError) {
    console.error("[notifications] portfolio read failed", portfoliosError);
    return { unread: [], read: [], unreadCount: 0, status: "error" };
  }
  const portfolios = (portfoliosData ?? []) as PortfolioRow[];

  if (portfolios.length === 0) {
    persistSummaryAfterResponse(user.id, 0);
    return { unread: [], read: [], unreadCount: 0, status: "ok" };
  }

  const portfolioIds = portfolios.map((portfolio) => portfolio.id);

  const [{ data: holdingsData, error: holdingsError }, { data: dismissalsData, error: dismissalsError }] = await Promise.all([
    supabase
      .from("portfolio_holdings")
      .select("portfolio_id, ticker, entry_price, score_at_entry, rank_at_entry, risk_level_at_entry, target_level_at_entry, added_at, last_reviewed_at, shares, allocation_pct, purchase_date, source, notes")
      .in("portfolio_id", portfolioIds),
    supabase.from("notification_dismissals").select("alert_key").eq("user_id", user.id),
  ]);

  if (holdingsError) {
    console.error("[notifications] holdings read failed", holdingsError);
    return { unread: [], read: [], unreadCount: 0, status: "error" };
  }
  const holdings = (holdingsData ?? []) as HoldingRow[];

  if (holdings.length === 0) {
    persistSummaryAfterResponse(user.id, 0);
    return { unread: [], read: [], unreadCount: 0, status: "ok" };
  }

  if (dismissalsError) {
    console.error("[notifications] dismissal read failed", dismissalsError);
    return { unread: [], read: [], unreadCount: 0, status: "error" };
  }

  const dismissedKeys = new Set(
    (dismissalsData ?? []).map((dismissal) => String(dismissal.alert_key)),
  );

  const today = new Date().toISOString();
  const allNotifications: BuiltNotification[] = [];

  const holdingGroups = portfolios.map(portfolio => ({
    portfolioHoldings: holdings.filter(
        (holding) => holding.portfolio_id === portfolio.id && holding.ticker,
    ),
    riskTolerance: (portfolio.risk_tolerance as RiskTolerance) ?? null,
  }));
  const enrichedGroups = await enrichHoldingGroups(supabase, holdingGroups.map(({ portfolioHoldings, riskTolerance }) => ({
    holdings: portfolioHoldings.map(holding => ({
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
  })));

  portfolios.forEach((portfolio, index) => {
      const { portfolioHoldings } = holdingGroups[index];
      const portfolioName = cleanName(portfolio.name, `Portfolio ${index + 1}`);
      const enriched = enrichedGroups[index];

      const storedLevelsByTicker = new Map(
        portfolioHoldings.map((holding) => [
          String(holding.ticker).toUpperCase(),
          {
            riskLevelAtEntry: holding.risk_level_at_entry,
            targetLevelAtEntry: holding.target_level_at_entry,
          },
        ]),
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

        const storedLevels = storedLevelsByTicker.get(holding.ticker) ?? {
          riskLevelAtEntry: null,
          targetLevelAtEntry: null,
        };

        allNotifications.push(
          ...buildStoredTradeLevelNotifications({
            portfolioId: portfolio.id,
            portfolioName,
            ticker: holding.ticker,
            company: holding.company,
            currentPrice: holding.currentPrice,
            priceUpdatedAt: holding.priceUpdatedAt,
            riskLevelAtEntry: storedLevels.riskLevelAtEntry,
            targetLevelAtEntry: storedLevels.targetLevelAtEntry,
          }),
        );
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

  persistSummaryAfterResponse(user.id, unread.length);

  return {
    unread: unread.map(stripInternal),
    read: read.map(stripInternal),
    unreadCount: unread.length,
    status: "ok",
  };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { unreadCount } = await getUserNotifications();
  return unreadCount;
}
