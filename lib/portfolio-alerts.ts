import { createClient } from "@/utils/supabase/server";

export type AlertSeverity = "critical" | "warning" | "info" | "success";
export type AlertType =
  | "score_drop"
  | "score_rise"
  | "rank_drop"
  | "rank_rise"
  | "price_target"
  | "price_stop"
  | "review_due"
  | "negative_news"
  | "positive_news"
  | "sector_weak"
  | "sector_strong";

export type HoldingAlert = {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  recommendation: string;
};

export type EnrichedHolding = {
  ticker: string;
  company: string | null;
  sector: string | null;
  rank: number | null;
  score: number;
  currentPrice: number;
  entryPrice: number;
  scoreAtEntry: number | null;
  rankAtEntry: number | null;
  addedAt: string;
  lastReviewedAt: string;
  // Calculated
  pnlDollars: number;
  pnlPercent: number;
  scoreChange: number; // current - entry
  rankChange: number;  // entry - current (positive = improved)
  daysSinceReview: number;
  alerts: HoldingAlert[];
  recommendation: "Hold" | "Consider Buying More" | "Consider Trimming" | "Strong Hold" | "Review Urgently";
  sectorMomentum: "Hot" | "Warm" | "Cool" | "Cold" | "Unknown";
};

// ── Sector momentum based on % of sector stocks bullish ──
async function getSectorMomentum(): Promise<Record<string, "Hot" | "Warm" | "Cool" | "Cold">> {
  const supabase = await createClient();

  // Get max score for proper normalization
  const { data: maxRow } = await supabase
    .from("stock_rankings")
    .select("score")
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxScore = Number(maxRow?.score) || 10000;
  const bullishThreshold = maxScore * 0.7;

  const { data: allStocks } = await supabase
    .from("stock_rankings")
    .select("sector, score");

  const bySector: Record<string, { total: number; bullish: number }> = {};
  (allStocks ?? []).forEach((s) => {
    const sector = s.sector ?? "—";
    if (!bySector[sector]) bySector[sector] = { total: 0, bullish: 0 };
    bySector[sector].total++;
    if (Number(s.score) >= bullishThreshold) bySector[sector].bullish++;
  });

  const result: Record<string, "Hot" | "Warm" | "Cool" | "Cold"> = {};
  Object.entries(bySector).forEach(([sector, { total, bullish }]) => {
    const pct = total > 0 ? bullish / total : 0;
    if (pct >= 0.5) result[sector] = "Hot";
    else if (pct >= 0.3) result[sector] = "Warm";
    else if (pct >= 0.15) result[sector] = "Cool";
    else result[sector] = "Cold";
  });
  return result;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function buildAlerts(h: {
  ticker: string;
  scoreChange: number;
  rankChange: number;
  pnlPercent: number;
  daysSinceReview: number;
  scoreAtEntry: number | null;
  score: number;
  rank: number | null;
  rankAtEntry: number | null;
  recentNegativeNewsCount: number;
  recentPositiveNewsCount: number;
  sectorMomentum: "Hot" | "Warm" | "Cool" | "Cold" | "Unknown";
}): HoldingAlert[] {
  const alerts: HoldingAlert[] = [];

  // ── Score drop ──
  if (h.scoreAtEntry && h.scoreAtEntry > 0) {
    const dropPct = (h.scoreChange / h.scoreAtEntry) * 100;
    if (dropPct <= -25) {
      alerts.push({
        type: "score_drop",
        severity: "critical",
        title: `${h.ticker} AI score dropped ${Math.abs(Math.round(dropPct))}%`,
        message: `Score has fallen from ${h.scoreAtEntry.toLocaleString()} to ${h.score.toLocaleString()} since you added it.`,
        recommendation: "Review this position urgently — the AI's conviction has weakened materially.",
      });
    } else if (dropPct <= -12) {
      alerts.push({
        type: "score_drop",
        severity: "warning",
        title: `${h.ticker} AI score weakening`,
        message: `Score dropped ${Math.abs(Math.round(dropPct))}% since you bought.`,
        recommendation: "Watch closely. Consider trimming if score continues to fall.",
      });
    } else if (dropPct >= 12) {
      alerts.push({
        type: "score_rise",
        severity: "success",
        title: `${h.ticker} AI score strengthening`,
        message: `Score is up ${Math.round(dropPct)}% — model conviction is growing.`,
        recommendation: "Position is performing well. Consider holding or adding on dips.",
      });
    }
  }

  // ── Rank changes ──
  if (h.rank && h.rankAtEntry) {
    const rankShift = h.rankAtEntry - h.rank; // positive = moved up
    if (rankShift <= -50) {
      alerts.push({
        type: "rank_drop",
        severity: "warning",
        title: `${h.ticker} fell ${Math.abs(rankShift)} places in rankings`,
        message: `Rank changed from #${h.rankAtEntry} to #${h.rank}.`,
        recommendation: "Significant relative weakness. Reassess if rank keeps falling.",
      });
    } else if (rankShift >= 30) {
      alerts.push({
        type: "rank_rise",
        severity: "success",
        title: `${h.ticker} climbed ${rankShift} places`,
        message: `Rank improved from #${h.rankAtEntry} to #${h.rank}.`,
        recommendation: "Strong relative outperformance — let the winner run.",
      });
    }
  }

  // ── Negative news cluster ──
  if (h.recentNegativeNewsCount >= 3) {
    alerts.push({
      type: "negative_news",
      severity: "warning",
      title: `${h.recentNegativeNewsCount} negative articles about ${h.ticker} recently`,
      message: "Multiple negative news pieces in the last 14 days.",
      recommendation: "Read the news section. If concerns are structural, consider trimming.",
    });
  } else if (h.recentPositiveNewsCount >= 4) {
    alerts.push({
      type: "positive_news",
      severity: "success",
      title: `${h.ticker} has positive news momentum`,
      message: `${h.recentPositiveNewsCount} positive articles in the last 14 days.`,
      recommendation: "Sentiment is strong — current allocation looks well-placed.",
    });
  }

  // ── P&L milestones ──
  if (h.pnlPercent >= 25) {
    alerts.push({
      type: "price_target",
      severity: "info",
      title: `${h.ticker} is up ${Math.round(h.pnlPercent)}% from your entry`,
      message: "Strong gain achieved.",
      recommendation: "Consider taking partial profits, or hold if conviction remains strong.",
    });
  } else if (h.pnlPercent <= -15) {
    alerts.push({
      type: "price_stop",
      severity: "warning",
      title: `${h.ticker} is down ${Math.abs(Math.round(h.pnlPercent))}% from your entry`,
      message: "Position is in significant drawdown.",
      recommendation: "If the AI score is still strong, this may be an averaging-down opportunity. Otherwise, reassess.",
    });
  }

  // ── Sector momentum ──
  if (h.sectorMomentum === "Cold" && h.scoreChange < 0) {
    alerts.push({
      type: "sector_weak",
      severity: "warning",
      title: `${h.ticker}'s sector is weak right now`,
      message: "Most stocks in this sector have low AI scores.",
      recommendation: "Sector headwinds add risk. Watch closely or rotate into a stronger sector.",
    });
  } else if (h.sectorMomentum === "Hot") {
    alerts.push({
      type: "sector_strong",
      severity: "success",
      title: `${h.ticker}'s sector is performing strongly`,
      message: "Most stocks in this sector have strong AI scores — a tailwind for your position.",
      recommendation: "Sector momentum supports holding. Could be a candidate to add to.",
    });
  }

  // ── Review overdue ──
  if (h.daysSinceReview >= 90) {
    alerts.push({
      type: "review_due",
      severity: "info",
      title: `${h.ticker} hasn't been reviewed in ${h.daysSinceReview} days`,
      message: "Quarterly review is recommended for medium-term positions.",
      recommendation: "Open the stock page, check the AI Trade Plan, then mark as reviewed.",
    });
  }

  return alerts;
}

function deriveRecommendation(alerts: HoldingAlert[]): EnrichedHolding["recommendation"] {
  if (alerts.some((a) => a.severity === "critical")) return "Review Urgently";

  const warnings = alerts.filter((a) => a.severity === "warning").length;
  const successes = alerts.filter((a) => a.severity === "success").length;

  if (warnings >= 2) return "Consider Trimming";
  if (successes >= 2 && warnings === 0) return "Consider Buying More";
  if (successes >= 1 && warnings === 0) return "Strong Hold";
  return "Hold";
}

export async function enrichHoldings(
  holdings: Array<{
    ticker: string;
    entry_price: number | null;
    score_at_entry: number | null;
    rank_at_entry: number | null;
    added_at: string;
    last_reviewed_at: string;
  }>
): Promise<EnrichedHolding[]> {
  if (holdings.length === 0) return [];

  const supabase = await createClient();

  const tickers = holdings.map((h) => h.ticker);

  // Fetch current data for all holdings
  const { data: currentData } = await supabase
    .from("stock_rankings")
    .select("ticker, company, sector, rank, score, price")
    .in("ticker", tickers);

  // Fetch recent news for all holdings
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentNews } = await supabase
    .from("news_articles")
    .select("impact, affected_tickers")
    .gte("published_at", fourteenDaysAgo)
    .limit(200);

  const sectorMomentum = await getSectorMomentum();

  const currentMap = new Map(
    (currentData ?? []).map((s) => [s.ticker as string, s])
  );

  const newsImpactByTicker: Record<string, { positive: number; negative: number }> = {};
  (recentNews ?? []).forEach((n) => {
    const tickers = Array.isArray(n.affected_tickers) ? n.affected_tickers : [];
    const impact = (n.impact ?? "").toLowerCase();
    tickers.forEach((t: string) => {
      if (!newsImpactByTicker[t]) newsImpactByTicker[t] = { positive: 0, negative: 0 };
      if (impact === "positive") newsImpactByTicker[t].positive++;
      else if (impact === "negative") newsImpactByTicker[t].negative++;
    });
  });

  const now = new Date();

  return holdings.map((h) => {
    const current = currentMap.get(h.ticker);
    const score = Number(current?.score) || 0;
    const currentPrice = Number(current?.price) || 0;
    const entryPrice = Number(h.entry_price) || currentPrice;
    const sector = (current?.sector as string) ?? null;

    const scoreChange = score - (h.score_at_entry ?? score);
    const rankChange = h.rank_at_entry
      ? h.rank_at_entry - (Number(current?.rank) || h.rank_at_entry)
      : 0;
    const pnlDollars = currentPrice - entryPrice;
    const pnlPercent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
    const daysSinceReview = daysBetween(now, new Date(h.last_reviewed_at));

    const news = newsImpactByTicker[h.ticker] ?? { positive: 0, negative: 0 };
    const momentum = sector ? (sectorMomentum[sector] ?? "Unknown") : "Unknown";

    const alerts = buildAlerts({
      ticker: h.ticker,
      scoreChange,
      rankChange,
      pnlPercent,
      daysSinceReview,
      scoreAtEntry: h.score_at_entry,
      score,
      rank: Number(current?.rank) || null,
      rankAtEntry: h.rank_at_entry,
      recentNegativeNewsCount: news.negative,
      recentPositiveNewsCount: news.positive,
      sectorMomentum: momentum,
    });

    return {
      ticker: h.ticker,
      company: (current?.company as string) ?? null,
      sector,
      rank: Number(current?.rank) || null,
      score,
      currentPrice,
      entryPrice,
      scoreAtEntry: h.score_at_entry,
      rankAtEntry: h.rank_at_entry,
      addedAt: h.added_at,
      lastReviewedAt: h.last_reviewed_at,
      pnlDollars: Math.round(pnlDollars * 100) / 100,
      pnlPercent: Math.round(pnlPercent * 10) / 10,
      scoreChange,
      rankChange,
      daysSinceReview,
      alerts,
      recommendation: deriveRecommendation(alerts),
      sectorMomentum: momentum,
    };
  });
}
