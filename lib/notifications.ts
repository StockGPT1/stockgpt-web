import { createClient } from "@/utils/supabase/server";
import { enrichHoldings, type HoldingAlert } from "@/lib/portfolio-alerts";

export type Notification = {
  key: string; // unique stable identifier (used for dismissal)
  ticker: string;
  company: string | null;
  type: HoldingAlert["type"];
  severity: HoldingAlert["severity"];
  title: string;
  message: string;
  recommendation: string;
  createdAt: string; // ISO date — when this alert was first relevant
};

/**
 * Build a stable key for an alert so we can track if it's been dismissed.
 * Uses a weekly date bucket so the same alert resurfaces each week if still relevant.
 */
function buildAlertKey(ticker: string, type: string, dateStr: string): string {
  // Bucket by week — alert keys roll over weekly
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const week = Math.floor(
    (d.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  return `${ticker}:${type}:${year}w${week}`;
}

/**
 * Load all current notifications for the user, with dismissed state.
 */
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

  // Load user's portfolio holdings
  const { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) return { unread: [], read: [], unreadCount: 0 };

  const { data: holdingsData } = await supabase
    .from("portfolio_holdings")
    .select(
      "ticker, entry_price, score_at_entry, rank_at_entry, added_at, last_reviewed_at"
    )
    .eq("portfolio_id", portfolio.id);

  if (!holdingsData || holdingsData.length === 0)
    return { unread: [], read: [], unreadCount: 0 };

  const enriched = await enrichHoldings(
    holdingsData.map((h) => ({
      ticker: h.ticker as string,
      entry_price: h.entry_price as number | null,
      score_at_entry: h.score_at_entry as number | null,
      rank_at_entry: h.rank_at_entry as number | null,
      added_at: h.added_at as string,
      last_reviewed_at: h.last_reviewed_at as string,
    }))
  );

  // Load all dismissals for this user
  const { data: dismissalsData } = await supabase
    .from("notification_dismissals")
    .select("alert_key")
    .eq("user_id", user.id);

  const dismissedKeys = new Set(
    (dismissalsData ?? []).map((d) => d.alert_key as string)
  );

  // Flatten all alerts into notifications
  const today = new Date().toISOString();
  const allNotifications: Notification[] = [];

  enriched.forEach((h) => {
    h.alerts.forEach((alert) => {
      const key = buildAlertKey(h.ticker, alert.type, today);
      allNotifications.push({
        key,
        ticker: h.ticker,
        company: h.company,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        recommendation: alert.recommendation,
        createdAt: today,
      });
    });
  });

  // Sort by severity (critical first) then ticker
  const severityOrder: Record<string, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  };
  allNotifications.sort((a, b) => {
    const s = severityOrder[a.severity] - severityOrder[b.severity];
    return s !== 0 ? s : a.ticker.localeCompare(b.ticker);
  });

  const unread = allNotifications.filter((n) => !dismissedKeys.has(n.key));
  const read = includeDismissed
    ? allNotifications.filter((n) => dismissedKeys.has(n.key))
    : [];

  return {
    unread,
    read,
    unreadCount: unread.length,
  };
}

/**
 * Just the unread count — used for the sidebar badge.
 * Cheaper than getUserNotifications because it short-circuits early.
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const { unreadCount } = await getUserNotifications();
  return unreadCount;
}
