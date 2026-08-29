import "server-only";

import {
  buildCanonicalNotificationCandidates,
  stripNotificationDismissalKeys,
  type Notification,
} from "@/lib/canonical-notifications";
import type { Tables } from "@/lib/database.types";
import { saveUnreadNotificationSummary } from "@/lib/notification-summary";
import type {
  CurrentDiagnosticFact,
  CurrentHoldingFact,
  CurrentPortfolioFact,
  CurrentRankingFact,
} from "@/lib/current-portfolio-intelligence";
import { createClient } from "@/utils/supabase/server";

export type { Notification } from "@/lib/canonical-notifications";

type PortfolioRow = CurrentPortfolioFact & Pick<Tables<"user_portfolios">, "name">;
type RankingRow = CurrentRankingFact & Pick<Tables<"stock_rankings">, "company">;

function cleanName(name: string | null | undefined, fallback: string) {
  const value = String(name ?? "").trim();
  return value || fallback;
}

function tickerKey(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function errorResult(): {
  unread: Notification[];
  read: Notification[];
  unreadCount: number;
  status: "error";
} {
  return { unread: [], read: [], unreadCount: 0, status: "error" };
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { unread: [], read: [], unreadCount: 0, status: "unauthenticated" };
  }
  const asOf = new Date().toISOString();

  const { data: portfoliosData, error: portfoliosError } = await supabase
    .from("user_portfolios")
    .select(
      "id,name,risk_tolerance,objective,time_horizon,cash_balance,currency",
    )
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (portfoliosError) {
    console.error("[notifications] portfolio read failed", portfoliosError);
    return errorResult();
  }
  const portfolios: PortfolioRow[] = portfoliosData ?? [];
  if (portfolios.length === 0) {
    await saveUnreadNotificationSummary(user.id, 0);
    return { unread: [], read: [], unreadCount: 0, status: "ok" };
  }

  const portfolioIds = portfolios.map((portfolio) => portfolio.id);
  const { data: holdingsData, error: holdingsError } = await supabase
    .from("portfolio_holdings")
    .select(
      "id,portfolio_id,ticker,shares,entry_price,score_at_entry,rank_at_entry,allocation_pct,source,risk_level_at_entry,target_level_at_entry",
    )
    .in("portfolio_id", portfolioIds)
    .order("portfolio_id", { ascending: true })
    .order("ticker", { ascending: true });

  if (holdingsError) {
    console.error("[notifications] holdings read failed", holdingsError);
    return errorResult();
  }
  const holdings: CurrentHoldingFact[] = holdingsData ?? [];
  const tickers = [
    ...new Set(holdings.map((holding) => tickerKey(holding.ticker)).filter(Boolean)),
  ];
  const dismissalsPromise = supabase
    .from("notification_dismissals")
    .select("alert_key")
    .eq("user_id", user.id);

  let rankings: RankingRow[] = [];
  let diagnostics: CurrentDiagnosticFact[] = [];
  let rankingUniverseSize: number | null = null;
  let dismissedKeys = new Set<string>();

  if (tickers.length > 0) {
    const [rankingResult, diagnosticsResult, universeResult, dismissalsResult] =
      await Promise.all([
        supabase
          .from("stock_rankings")
          .select(
            "ticker,company,score,rank,price,last_price_update,last_ranking_update",
          )
          .in("ticker", tickers)
          .order("ticker", { ascending: true }),
        supabase
          .from("stock_factor_diagnostics")
          .select("ticker,current_score,previous_score,updated_at")
          .in("ticker", tickers)
          .order("ticker", { ascending: true }),
        supabase
          .from("stock_rankings")
          .select("rank", { count: "exact", head: true })
          .not("rank", "is", null),
        dismissalsPromise,
      ]);

    if (rankingResult.error || diagnosticsResult.error || universeResult.error) {
      console.error("[notifications] canonical fact read failed", {
        rankings: rankingResult.error,
        diagnostics: diagnosticsResult.error,
        universe: universeResult.error,
      });
      return errorResult();
    }
    if (dismissalsResult.error) {
      console.error("[notifications] dismissal read failed", dismissalsResult.error);
      return errorResult();
    }
    rankings = rankingResult.data ?? [];
    diagnostics = diagnosticsResult.data ?? [];
    rankingUniverseSize = universeResult.count;
    dismissedKeys = new Set(
      (dismissalsResult.data ?? []).map((item) => String(item.alert_key)),
    );
  } else {
    const dismissalsResult = await dismissalsPromise;
    if (dismissalsResult.error) {
      console.error("[notifications] dismissal read failed", dismissalsResult.error);
      return errorResult();
    }
    dismissedKeys = new Set(
      (dismissalsResult.data ?? []).map((item) => String(item.alert_key)),
    );
  }

  const companiesByTicker = Object.fromEntries(
    rankings.map((ranking) => [tickerKey(ranking.ticker), ranking.company]),
  );
  const candidates = buildCanonicalNotificationCandidates({
    asOf,
    portfolios: portfolios.map((portfolio, index) => ({
      portfolioName: cleanName(portfolio.name, `Portfolio ${index + 1}`),
      companiesByTicker,
      facts: {
        portfolio,
        holdings: holdings.filter(
          (holding) => holding.portfolio_id === portfolio.id,
        ),
        rankings,
        diagnostics,
        rankingUniverseSize,
      },
    })),
  });
  const isRead = (candidate: (typeof candidates)[number]) =>
    candidate.dismissalKeys.some((key) => dismissedKeys.has(key));
  const unreadCandidates = candidates.filter((candidate) => !isRead(candidate));
  const readCandidates = includeDismissed
    ? candidates.filter((candidate) => isRead(candidate))
    : [];

  await saveUnreadNotificationSummary(user.id, unreadCandidates.length);
  return {
    unread: unreadCandidates.map(stripNotificationDismissalKeys),
    read: readCandidates.map(stripNotificationDismissalKeys),
    unreadCount: unreadCandidates.length,
    status: "ok",
  };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { unreadCount } = await getUserNotifications();
  return unreadCount;
}
