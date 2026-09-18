import { createAdminClient } from "@/utils/supabase/admin";
import {
  enrichHoldings,
  type AlertSeverity,
  type HoldingAlert,
  type RiskTolerance,
} from "@/lib/portfolio-alerts";

export type IOSPushCandidate = {
  key: string;
  title: string;
  body: string;
  path: string;
  severity: AlertSeverity;
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

function weeklyKey(portfolioId: string, ticker: string, type: string, dateStr: string) {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const week = Math.floor(
    (d.getTime() - new Date(year, 0, 1).getTime()) /
      (7 * 24 * 60 * 60 * 1000),
  );
  return `${portfolioId}:${ticker}:${type}:${year}w${week}`;
}

function levelKey(portfolioId: string, ticker: string, type: string, level: number) {
  return `${portfolioId}:${ticker}:${type}:${level.toFixed(2)}`;
}

function cleanBody(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}…` : compact;
}

export async function getIOSPushCandidates(userId: string): Promise<IOSPushCandidate[]> {
  const supabase = createAdminClient();
  const { data: portfoliosData, error: portfoliosError } = await supabase
    .from("user_portfolios")
    .select("id,name,risk_tolerance")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (portfoliosError) throw portfoliosError;
  const portfolios = (portfoliosData ?? []) as PortfolioRow[];
  if (portfolios.length === 0) return [];

  const portfolioIds = portfolios.map((portfolio) => portfolio.id);
  const [{ data: holdingsData, error: holdingsError }, { data: dismissalsData }] = await Promise.all([
    supabase
      .from("portfolio_holdings")
      .select(
        "portfolio_id,ticker,entry_price,score_at_entry,rank_at_entry,risk_level_at_entry,target_level_at_entry,added_at,last_reviewed_at,shares,allocation_pct,purchase_date,source,notes",
      )
      .in("portfolio_id", portfolioIds),
    supabase
      .from("notification_dismissals")
      .select("alert_key")
      .eq("user_id", userId),
  ]);

  if (holdingsError) throw holdingsError;
  const holdings = (holdingsData ?? []) as HoldingRow[];
  if (holdings.length === 0) return [];

  const dismissed = new Set(
    (dismissalsData ?? []).map((row) => String(row.alert_key)),
  );
  const today = new Date().toISOString();
  const candidates: IOSPushCandidate[] = [];

  await Promise.all(
    portfolios.map(async (portfolio) => {
      const portfolioHoldings = holdings.filter(
        (holding) => holding.portfolio_id === portfolio.id && holding.ticker,
      );
      if (portfolioHoldings.length === 0) return;

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
        (portfolio.risk_tolerance as RiskTolerance) ?? null,
      );

      const storedLevels = new Map(
        portfolioHoldings.map((holding) => [
          String(holding.ticker).toUpperCase(),
          {
            risk: holding.risk_level_at_entry,
            target: holding.target_level_at_entry,
          },
        ]),
      );

      for (const holding of enriched) {
        for (const alert of holding.alerts.filter(
          (item: HoldingAlert) => item.type === "trim_action",
        )) {
          const key = weeklyKey(portfolio.id, holding.ticker, alert.type, today);
          if (!dismissed.has(key)) {
            candidates.push({
              key,
              title: alert.title || `${holding.ticker} portfolio review`,
              body: cleanBody(alert.message || alert.recommendation),
              path: `/portfolio?portfolio=${encodeURIComponent(portfolio.id)}&section=holdings`,
              severity: alert.severity,
            });
          }
        }

        const levels = storedLevels.get(holding.ticker);
        const currentPrice = Number(holding.currentPrice);
        if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !levels) continue;

        if (
          levels.risk != null &&
          Number.isFinite(levels.risk) &&
          levels.risk > 0 &&
          currentPrice <= levels.risk
        ) {
          const key = levelKey(portfolio.id, holding.ticker, "entry_risk_level_hit", levels.risk);
          if (!dismissed.has(key)) {
            candidates.push({
              key,
              title: `${holding.ticker} hit its risk level`,
              body: `Price is $${currentPrice.toFixed(2)}, at or below the buy-time risk level near $${levels.risk.toFixed(2)}.`,
              path: `/stock/${encodeURIComponent(holding.ticker)}`,
              severity: "critical",
            });
          }
        }

        if (
          levels.target != null &&
          Number.isFinite(levels.target) &&
          levels.target > 0 &&
          currentPrice >= levels.target
        ) {
          const key = levelKey(portfolio.id, holding.ticker, "entry_target_level_hit", levels.target);
          if (!dismissed.has(key)) {
            candidates.push({
              key,
              title: `${holding.ticker} hit its target level`,
              body: `Price is $${currentPrice.toFixed(2)}, at or above the buy-time target near $${levels.target.toFixed(2)}.`,
              path: `/stock/${encodeURIComponent(holding.ticker)}`,
              severity: "success",
            });
          }
        }
      }
    }),
  );

  const severityOrder: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  };

  return candidates
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .filter((candidate, index, all) => all.findIndex((item) => item.key === candidate.key) === index);
}
